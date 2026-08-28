import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { join } from "node:path";
import {
  DEFAULT_CHUNK,
  decodeTeam,
  diffReadback,
  encodeTeam,
  loadMatches,
  planFixtures,
  selectMatches,
  stageOfPhase,
  type MatchesDoc,
  type ReadbackRow,
} from "../scripts/lib/fixtures";

/** The relayer's committed generator output for the recorded 2025/26 archive slice. */
const SAMPLE = join(__dirname, "..", "..", "relayer", "test", "output", "matches-sample.json");

/**
 * Fixture-push tooling (PRD §7.3 milestone 5, §7.4 hard gate): the exact
 * planning + encoding scripts/add-fixtures.ts broadcasts, exercised against
 * the real contract — chunking, bytes3 codes, stage mapping, id offsets and
 * the read-back diff — so the mainnet run is a rehearsed path, not a first.
 */
describe("add-fixtures tooling (scripts/lib/fixtures.ts)", () => {
  async function deploy() {
    const signers = await ethers.getSigners();
    const [owner, fee, oracle] = signers;
    const t0 = Number(await time.latest());
    const leagueClose = t0 + 10 * 86_400;
    const koClose = t0 + 40 * 86_400;
    const F = await ethers.getContractFactory("ChampionzPredictor");
    const c = await upgrades.deployProxy(
      F,
      [owner.address, fee.address, oracle.address, leagueClose, koClose],
      { kind: "uups" },
    );
    return { c, owner, t0 };
  }

  /** A full 36-team, 8-matchday league phase: 144 fixtures, 18 per matchday. */
  function syntheticLeague(t0: number): MatchesDoc {
    const codes = Array.from({ length: 36 }, (_, i) => `T${String(i + 1).padStart(2, "0")}`);
    const teams = Object.fromEntries(codes.map((code, i) => [code, { name: `Team ${i + 1}`, code, uefaId: String(1000 + i) }]));
    const matches: MatchesDoc["matches"] = [];
    for (let md = 1; md <= 8; md++) {
      for (let k = 0; k < 18; k++) {
        const a = codes[(k + md) % 36];
        const b = codes[(k + md + 18) % 36];
        matches.push({
          matchId: matches.length + 1,
          phase: 0,
          teamA: a,
          teamB: b,
          kickoffTime: t0 + 10 * 86_400 + (md - 1) * 7 * 86_400 + k * 900,
          group: "League",
          matchday: md,
          knockout: false,
          uefaMatchId: String(3_000_000 + matches.length),
          tieId: null,
          legNumber: null,
        });
      }
    }
    return { teams, matches };
  }

  async function readback(c: any, chainIds: number[]): Promise<ReadbackRow[]> {
    const rows: ReadbackRow[] = [];
    for (const id of chainIds) {
      const g = await c.matches(id);
      rows.push({ chainId: id, kickoff: Number(g.kickoff), teamA: decodeTeam(g.teamA), teamB: decodeTeam(g.teamB), stage: Number(g.stage) });
    }
    return rows;
  }

  it("encodes bytes3 team codes and refuses anything that is not 3 ASCII chars", () => {
    expect(encodeTeam("LAS")).to.equal("0x4c4153");
    expect(decodeTeam("0x4c4153")).to.equal("LAS");
    expect(decodeTeam(encodeTeam("RMA"))).to.equal("RMA");
    expect(() => encodeTeam("LASK")).to.throw(/bytes3/); // UEFA's 4-letter code
    expect(() => encodeTeam("Bø1")).to.throw(/bytes3/);
    expect(() => encodeTeam("rma")).to.throw(/bytes3/);
    expect(() => encodeTeam("Winner of Group A")).to.throw(/bytes3/);
  });

  it("maps phase 0 to the league stage and every knockout round to the knockout stage", () => {
    expect(stageOfPhase(0)).to.equal(0);
    for (const p of [1, 2, 3, 4, 5]) expect(stageOfPhase(p)).to.equal(1);
  });

  it("pushes a full 144-match league phase in 8 matchday chunks and reads it back exactly", async () => {
    const { c, owner, t0 } = await deploy();
    const doc = syntheticLeague(t0);
    const plan = planFixtures(doc, { phase: 0, now: t0 });
    expect(plan.chunks.length).to.equal(8);
    expect(plan.chunks.every((ch) => ch.matches.length === DEFAULT_CHUNK)).to.be.true;
    expect(plan.matches[0].chainId).to.equal(1);
    expect(plan.matches[143].chainId).to.equal(144);
    expect(plan.warnings).to.deep.equal([]);

    let totalGas = 0n;
    for (const ch of plan.chunks) {
      const tx = await c.connect(owner).addMatches(ch.kickoffs, ch.teamsA, ch.teamsB, ch.stageIds);
      const receipt = await tx.wait();
      totalGas += receipt!.gasUsed;
    }
    expect(await c.matchCount()).to.equal(144);
    const rows = await readback(c, plan.matches.map((m) => m.chainId));
    expect(diffReadback(plan, rows)).to.deep.equal([]);
    // evidence for the mainnet gas budget (Chiliz block limit 100M, 2,510 gwei)
    console.log(`      144-match league push: ${totalGas} gas ≈ ${ethers.formatEther(totalGas * 2_510_000_000_000n)} CHZ`);
    expect(totalGas).to.be.lessThan(30_000_000n);
  });

  it("pushes the mixed-phase archive sample after existing matches with the id offset", async () => {
    const { c, owner, t0 } = await deploy();
    // staging-style pre-existing matches (ids 1..4)
    const team = (s: string) => encodeTeam(s);
    await c.connect(owner).addMatches(
      [t0 + 86_400, t0 + 86_400, t0 + 86_400, t0 + 86_400],
      [team("AAA"), team("BBB"), team("CCC"), team("DDD")],
      [team("EEE"), team("FFF"), team("GGG"), team("HHH")],
      [0, 0, 1, 1],
    );
    const doc = loadMatches(SAMPLE);
    const plan = planFixtures(doc, { phase: null, idOffset: 4, chunk: 18, now: t0 });
    expect(plan.matches.length).to.equal(doc.matches.length);
    expect(plan.matches[0].chainId).to.equal(5);
    // archive kickoffs are in the past → every match is flagged as already locked, nothing thrown
    expect(plan.warnings.length).to.equal(doc.matches.length);
    for (const ch of plan.chunks) {
      await c.connect(owner).addMatches(ch.kickoffs, ch.teamsA, ch.teamsB, ch.stageIds);
    }
    expect(await c.matchCount()).to.equal(4 + doc.matches.length);
    const rows = await readback(c, plan.matches.map((m) => m.chainId));
    expect(diffReadback(plan, rows)).to.deep.equal([]);
    // stage mapping proven on-chain: league sample rows → 0, knockout rows → 1
    const league = plan.matches.filter((m) => m.stage === 0);
    const knockout = plan.matches.filter((m) => m.stage === 1);
    expect(league.length).to.equal(selectMatches(doc, 0).length);
    expect(knockout.length).to.equal(doc.matches.length - league.length);
  });

  it("refuses gaps, missing kickoffs, duplicate UEFA ids and placeholders before anything is broadcast", () => {
    const t0 = 1_800_000_000;
    const base = syntheticLeague(t0);
    const mutate = (fn: (d: MatchesDoc) => void) => {
      const d: MatchesDoc = JSON.parse(JSON.stringify(base));
      fn(d);
      return d;
    };
    expect(() => planFixtures(mutate((d) => d.matches.splice(3, 1)), { phase: 0, now: t0 })).to.throw(/contiguous/);
    expect(() => planFixtures(mutate((d) => (d.matches[0].kickoffTime = null)), { phase: 0, now: t0 })).to.throw(/no kickoff time/);
    expect(() => planFixtures(mutate((d) => (d.matches[1].uefaMatchId = d.matches[0].uefaMatchId)), { phase: 0, now: t0 })).to.throw(/duplicate uefaMatchId/);
    expect(() => planFixtures(mutate((d) => (d.matches[0].teamA = "Winner of Group A")), { phase: 0, now: t0 })).to.throw(/bytes3/);
    expect(() => planFixtures(mutate((d) => (d.matches[0].teamB = d.matches[0].teamA)), { phase: 0, now: t0 })).to.throw(/itself/);
    // a phase filter that is not a prefix of the numbering is a gap too
    expect(() => selectMatches(loadMatches(SAMPLE), 2)).to.throw(/contiguous/);
  });

  it("diffReadback reports a wrong kickoff, a swapped orientation and a wrong stage", () => {
    const t0 = 1_800_000_000;
    const plan = planFixtures(syntheticLeague(t0), { phase: 0, now: t0 });
    const rows: ReadbackRow[] = plan.matches.map((m) => ({ chainId: m.chainId, kickoff: m.kickoff, teamA: m.teamA, teamB: m.teamB, stage: m.stage }));
    rows[0].kickoff += 60;
    [rows[1].teamA, rows[1].teamB] = [rows[1].teamB, rows[1].teamA];
    rows[2].stage = 1;
    rows.pop();
    const problems = diffReadback(plan, rows);
    expect(problems.some((p) => p.startsWith("on-chain 1 ") && p.includes("kickoff"))).to.be.true;
    expect(problems.filter((p) => p.startsWith("on-chain 2 ")).length).to.equal(2);
    expect(problems.some((p) => p.startsWith("on-chain 3 ") && p.includes("stage"))).to.be.true;
    expect(problems.some((p) => p.startsWith("on-chain 144 ") && p.includes("MISSING"))).to.be.true;
  });
});
