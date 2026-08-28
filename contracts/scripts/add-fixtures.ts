import { ethers, network } from "hardhat";
import {
  chunkLabel,
  decodeTeam,
  diffReadback,
  loadMatches,
  planFixtures,
  STAGE_LEAGUE,
  type Chunk,
  type ReadbackRow,
} from "./lib/fixtures";

/**
 * Push generated fixtures on-chain (PRD §7.3 milestone 5) — owner-only,
 * DRY RUN by default. One `addMatches` transaction per matchday-sized chunk,
 * then every pushed match is read back and diffed against the plan.
 *
 *   PROXY=0x… MATCHES=../lib/fixtures/matches.json \
 *   [PHASE=0|all] [CHUNK=18] [EXPECT_MATCHCOUNT=0] [RESUME=1] [PAUSE=1] [CONFIRM=1] \
 *   npx hardhat run scripts/add-fixtures.ts --network chiliz
 *
 * PHASE              which matches.json phase to push (default 0 = league phase)
 * EXPECT_MATCHCOUNT  matchCount the proxy held BEFORE this plan (default 0) — the
 *                    id offset. A proxy holding more refuses unless RESUME=1.
 * RESUME=1           continue an interrupted run: the matches already on-chain
 *                    beyond EXPECT_MATCHCOUNT must be exactly the plan's leading
 *                    chunks (they are read back + verified, never re-pushed).
 * PAUSE=1            pause-bracket: pause() → push → verify → unpause(). Nobody
 *                    can predict on a wrong slate; a failed verify LEAVES the
 *                    contract paused (fix, then `scripts/set-paused.ts` / /admin).
 * CONFIRM=1          actually broadcast. Without it: plan + gas estimate only.
 *
 * Pre-flight: generate-matches.mjs → verify-fixtures.mjs against the LIVE feed.
 * After: relayer/scripts/verify-onchain.mjs, generate-map.mjs.
 *
 * Public Chiliz RPCs can lag their own receipts by a few blocks — every
 * post-transaction read polls until the chain catches up before judging.
 */
const env = (k: string, d?: string) => process.env[k] ?? d;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const iso = (unix: number) => new Date(unix * 1000).toISOString().replace(".000Z", "Z");

/** Poll matchCount until it reaches `expected` (RPC lag) — returns the last value seen. */
async function waitForMatchCount(c: any, expected: number, timeoutMs = 90_000): Promise<number> {
  const started = Date.now();
  let count = Number(await c.matchCount());
  while (count < expected && Date.now() - started < timeoutMs) {
    await sleep(3_000);
    count = Number(await c.matchCount());
  }
  return count;
}

/** Read one match, retrying while the RPC still returns the empty slot. */
async function readMatch(c: any, chainId: number, attempts = 10): Promise<ReadbackRow> {
  for (let i = 0; ; i++) {
    const g = await c.matches(chainId);
    const row: ReadbackRow = {
      chainId,
      kickoff: Number(g.kickoff),
      teamA: decodeTeam(g.teamA),
      teamB: decodeTeam(g.teamB),
      stage: Number(g.stage),
    };
    if (row.kickoff !== 0 || i >= attempts - 1) return row;
    await sleep(3_000);
  }
}

async function readback(c: any, chunks: Chunk[]): Promise<ReadbackRow[]> {
  const rows: ReadbackRow[] = [];
  const BATCH = 10;
  const ids = chunks.flatMap((ch) => ch.matches.map((m) => m.chainId));
  for (let i = 0; i < ids.length; i += BATCH) {
    rows.push(...(await Promise.all(ids.slice(i, i + BATCH).map((id) => readMatch(c, id)))));
  }
  return rows;
}

async function main() {
  const proxy = env("PROXY");
  const matchesPath = env("MATCHES");
  if (!proxy || !matchesPath) throw new Error("Set PROXY=0x… and MATCHES=<matches.json>");
  const phaseArg = env("PHASE", "0")!;
  const phase = phaseArg === "all" ? null : Number(phaseArg);
  const chunk = Number(env("CHUNK", "18"));
  const expectCount = Number(env("EXPECT_MATCHCOUNT", "0"));
  const resume = env("RESUME") === "1";
  const confirm = env("CONFIRM") === "1";
  const pauseBracket = env("PAUSE") === "1";

  const [signer] = await ethers.getSigners();
  const c = await ethers.getContractAt("ChampionzPredictor", proxy);
  const chainId = network.config.chainId;
  const configuredGasPrice = network.config.gasPrice;
  const gasPrice = typeof configuredGasPrice === "number" ? BigInt(configuredGasPrice) : 2_510_000_000_000n;

  const [owner, matchCountRaw, paused, league, knockout] = await Promise.all([
    c.owner(),
    c.matchCount(),
    c.paused(),
    c.stages(STAGE_LEAGUE),
    c.stages(1),
  ]);
  const matchCount = Number(matchCountRaw);

  console.log(`=== add-fixtures — ${network.name} (chainId ${chainId}) ${confirm ? "BROADCAST" : "DRY RUN"} ===`);
  console.log(`proxy:           ${proxy}`);
  console.log(`signer:          ${signer.address}`);
  console.log(`owner():         ${owner}`);
  console.log(`matchCount():    ${matchCount}  (EXPECT_MATCHCOUNT ${expectCount}${resume ? ", RESUME" : ""})`);
  console.log(`paused():        ${paused}`);
  console.log(`league window:   ${iso(Number(league.openAt))} → ${iso(Number(league.closeAt))} · ${league.entryCount} entrants`);
  console.log(`knockout window: ${iso(Number(knockout.openAt))} → ${iso(Number(knockout.closeAt))}`);

  if (owner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`signer ${signer.address} is not the owner ${owner} — addMatches is onlyOwner`);
  }
  if (matchCount < expectCount) {
    throw new Error(`proxy holds ${matchCount} matches, fewer than EXPECT_MATCHCOUNT=${expectCount} — wrong proxy or wrong offset`);
  }

  const doc = loadMatches(matchesPath);
  const plan = planFixtures(doc, { phase, idOffset: expectCount, chunk });
  console.log(`\nmatches.json: ${matchesPath} (${doc.source ?? "unknown source"})`);
  console.log(`plan: ${plan.matches.length} matches (phase ${phase ?? "all"}) in ${plan.chunks.length} tx(s), on-chain ids ${plan.matches[0].chainId}–${plan.matches[plan.matches.length - 1].chainId}`);
  console.log(`kickoffs: ${iso(plan.firstKickoff)} → ${iso(plan.lastKickoff)}`);
  for (const w of plan.warnings) console.log(`  ⚠ ${w}`);

  // Resume semantics: anything on-chain beyond the offset must be our own leading chunks.
  const alreadyPushed = matchCount - expectCount;
  if (alreadyPushed > 0 && !resume) {
    throw new Error(
      `proxy holds ${alreadyPushed} match(es) beyond EXPECT_MATCHCOUNT=${expectCount} — already pushed? ` +
        `If this is an interrupted run of THIS plan, re-run with RESUME=1; otherwise set EXPECT_MATCHCOUNT=${matchCount}.`,
    );
  }
  if (alreadyPushed > plan.matches.length) throw new Error(`proxy holds more matches (${alreadyPushed}) than this plan (${plan.matches.length}) — not a resume`);
  if (alreadyPushed % chunk !== 0) throw new Error(`proxy holds a partial chunk (${alreadyPushed} matches, chunk ${chunk}) — inspect by hand`);
  const doneChunks = alreadyPushed / chunk;
  const pending = plan.chunks.slice(doneChunks);
  if (doneChunks > 0) console.log(`\nRESUME: chunks #1–#${doneChunks} are already on-chain — they will be read back and verified, not re-pushed`);

  // D1: league sales hard-close AT the first MD1 kickoff — flag any drift.
  if (phase === 0 || phase === null) {
    const firstLeague = Math.min(...plan.matches.filter((m) => m.stage === STAGE_LEAGUE).map((m) => m.kickoff));
    const closeAt = Number(league.closeAt);
    if (firstLeague !== closeAt) {
      console.log(
        `\n⚠ league closeAt ${iso(closeAt)} ≠ first league kickoff ${iso(firstLeague)} (Δ ${Math.round((firstLeague - closeAt) / 60)} min).`,
      );
      console.log(`  D1 says hard close AT first kickoff → LEAGUE_CLOSE=${firstLeague} KO_OPEN=${firstLeague} npx hardhat run scripts/set-stage-windows.ts --network ${network.name}`);
    } else {
      console.log(`\n✓ league sales close exactly at the first league kickoff (D1)`);
    }
  }

  // gas plan
  console.log("\nchunks:");
  let totalGas = 0n;
  for (const ch of pending) {
    const gas = await c.addMatches.estimateGas(ch.kickoffs, ch.teamsA, ch.teamsB, ch.stageIds);
    totalGas += gas;
    console.log(`  ${chunkLabel(ch)} · ~${gas} gas`);
  }
  console.log(`total ≈ ${totalGas} gas ≈ ${ethers.formatEther(totalGas * gasPrice)} CHZ at ${gasPrice / 1_000_000_000n} gwei`);

  if (!confirm) {
    console.log("\nDRY RUN — nothing broadcast. Re-run with CONFIRM=1 to push" + (pauseBracket ? " (pause-bracketed)." : "."));
    return;
  }

  let wePaused = false;
  if (pauseBracket && !paused) {
    console.log("\npause() — nobody can predict until the slate is verified…");
    await (await c.pause()).wait();
    wePaused = true;
  }

  console.log("\nbroadcasting…");
  let done = matchCount;
  for (const ch of pending) {
    const tx = await c.addMatches(ch.kickoffs, ch.teamsA, ch.teamsB, ch.stageIds, { gasPrice });
    const receipt = await tx.wait();
    done += ch.matches.length;
    const count = await waitForMatchCount(c, done);
    console.log(`  ${chunkLabel(ch)} · tx ${tx.hash} · gasUsed ${receipt?.gasUsed} · matchCount ${count}`);
    if (count !== done) {
      throw new Error(
        `matchCount ${count} after chunk #${ch.index + 1} (expected ${done}) — STOP. Check the tx on the explorer; ` +
          `if it succeeded, re-run with RESUME=1 (the contract stays paused until the read-back passes).`,
      );
    }
  }

  console.log("\nreading back…");
  const rows = await readback(c, plan.chunks);
  const problems = diffReadback(plan, rows);
  if (problems.length > 0) {
    console.error(`\n✗ ${problems.length} discrepanc${problems.length === 1 ? "y" : "ies"}:`);
    for (const p of problems) console.error(`  ${p}`);
    if (wePaused || paused) console.error("\ncontract LEFT PAUSED — fix (setMatchTeams / batchUpdateKickoffs / voidMatch), then ACTION=unpause scripts/set-paused.ts");
    process.exitCode = 1;
    return;
  }
  console.log(`✓ all ${rows.length} planned matches read back exactly as planned`);

  if (wePaused || (pauseBracket && paused && resume)) {
    console.log("\nunpause() — the slate is OPEN…");
    await (await c.unpause()).wait();
    console.log(`✓ unpaused. matchCount=${await c.matchCount()}`);
  }
  console.log("\nnext: relayer/scripts/verify-onchain.mjs, generate-map.mjs → config/mainnet-map.json, bundle matches.json into lib/fixtures/.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
