import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const FULL_SEASON = ethers.parseEther("1100");
const KNOCKOUT = ethers.parseEther("550");
const STAKE = ethers.parseEther("500");
const FEE = ethers.parseEther("50");
const LOCKOUT = 3600n;
const FLAG_SUBMITTED = 1n << 20n;
const LEAGUE = 0;
const KO = 1;

function pack(a: number, b: number): bigint {
  return BigInt(a) | (BigInt(b) << 8n) | FLAG_SUBMITTED;
}

const team = (s: string) => "0x" + Buffer.from(s, "utf8").toString("hex");

describe("ChampionzPredictor v1 (two-stage economics)", () => {
  async function deploy() {
    const signers = await ethers.getSigners();
    const [owner, fee, oracle] = signers;
    const t0 = BigInt(await time.latest());
    const leagueClose = t0 + 10n * 24n * 3600n; // first MD1 kickoff
    const koClose = t0 + 40n * 24n * 3600n; // T-60 before last play-off first leg
    const F = await ethers.getContractFactory("ChampionzPredictor");
    const c = await upgrades.deployProxy(
      F,
      [owner.address, fee.address, oracle.address, leagueClose, koClose],
      { kind: "uups" },
    );
    return { c, signers, owner, fee, oracle, t0, leagueClose, koClose };
  }

  /** enough wallets to cross the floor */
  async function enterMany(c: any, signers: any[], fn: "enterFullSeason" | "enterKnockout", n: number, value: bigint) {
    for (let i = 0; i < n; i++) {
      await c.connect(signers[5 + i])[fn]({ value });
    }
  }

  describe("full season pass (D1)", () => {
    it("costs exactly 1,100 and enrolls both stages in one tx", async () => {
      const { c, signers } = await deploy();
      const alice = signers[5];
      await expect(c.connect(alice).enterFullSeason({ value: FULL_SEASON }))
        .to.emit(c, "Entered")
        .withArgs(alice.address, LEAGUE, true);
      expect(await c.entered(LEAGUE, alice.address)).to.be.true;
      expect(await c.entered(KO, alice.address)).to.be.true; // auto — no Feb tx
      expect(await c.fullSeason(alice.address)).to.be.true;
      const league = await c.stages(LEAGUE);
      const ko = await c.stages(KO);
      expect(league.pool).to.equal(STAKE);
      expect(ko.pool).to.equal(STAKE);
      expect(league.feeEscrow + ko.feeEscrow).to.equal(FEE * 2n); // 100 escrowed
    });

    it("rejects wrong amounts and double entry", async () => {
      const { c, signers } = await deploy();
      const alice = signers[5];
      await expect(
        c.connect(alice).enterFullSeason({ value: KNOCKOUT }),
      ).to.be.revertedWithCustomError(c, "InvalidStakeAmount");
      await c.connect(alice).enterFullSeason({ value: FULL_SEASON });
      await expect(
        c.connect(alice).enterFullSeason({ value: FULL_SEASON }),
      ).to.be.revertedWithCustomError(c, "AlreadyEntered");
      await expect(
        c.connect(alice).enterKnockout({ value: KNOCKOUT }),
      ).to.be.revertedWithCustomError(c, "SalesNotOpen"); // ko window not open yet anyway
    });

    it("hard-closes at the first MD1 kickoff — no late league entry", async () => {
      const { c, signers, leagueClose } = await deploy();
      await time.increaseTo(leagueClose - 2n);
      await c.connect(signers[5]).enterFullSeason({ value: FULL_SEASON }); // last moment
      await time.increaseTo(leagueClose);
      await expect(
        c.connect(signers[6]).enterFullSeason({ value: FULL_SEASON }),
      ).to.be.revertedWithCustomError(c, "SalesClosed");
    });
  });

  describe("knockout pass (D4 — the shop is never closed)", () => {
    it("opens the second season sales close and shuts at its own close", async () => {
      const { c, signers, leagueClose, koClose } = await deploy();
      await expect(
        c.connect(signers[5]).enterKnockout({ value: KNOCKOUT }),
      ).to.be.revertedWithCustomError(c, "SalesNotOpen"); // before MD1 kickoff
      await time.increaseTo(leagueClose); // season closed ⇒ ko open, same second
      await c.connect(signers[5]).enterKnockout({ value: KNOCKOUT });
      expect(await c.entered(KO, signers[5].address)).to.be.true;
      expect(await c.fullSeason(signers[5].address)).to.be.false;
      await time.increaseTo(koClose);
      await expect(
        c.connect(signers[6]).enterKnockout({ value: KNOCKOUT }),
      ).to.be.revertedWithCustomError(c, "SalesClosed");
    });

    it("full-season wallets cannot buy the knockout pass again", async () => {
      const { c, signers, leagueClose } = await deploy();
      await c.connect(signers[5]).enterFullSeason({ value: FULL_SEASON });
      await time.increaseTo(leagueClose);
      await expect(
        c.connect(signers[5]).enterKnockout({ value: KNOCKOUT }),
      ).to.be.revertedWithCustomError(c, "AlreadyEntered");
    });
  });

  describe("stage floor (D2): lock vs void", () => {
    it("19 entrants → VOID; everyone reclaims the full 550, fee included", async () => {
      const { c, signers, leagueClose } = await deploy();
      await enterMany(c, signers, "enterFullSeason", 19, FULL_SEASON);
      await time.increaseTo(leagueClose + 1n);
      await expect(c.lockStage(LEAGUE)).to.emit(c, "StageVoided").withArgs(LEAGUE, 19);
      const w = signers[5];
      const before = await ethers.provider.getBalance(w.address);
      const tx = await c.connect(w).claimRefund(LEAGUE);
      const rc = await tx.wait();
      const gas = rc!.gasUsed * rc!.gasPrice;
      expect((await ethers.provider.getBalance(w.address)) - before + gas).to.equal(
        STAKE + FEE, // 550 — the FULL per-stage gross
      );
      await expect(c.connect(w).claimRefund(LEAGUE)).to.be.revertedWithCustomError(
        c,
        "AlreadyRefunded",
      );
    });

    it("void league leaves the knockout stage untouched for full-season wallets", async () => {
      const { c, signers, leagueClose } = await deploy();
      await enterMany(c, signers, "enterFullSeason", 19, FULL_SEASON);
      await time.increaseTo(leagueClose + 1n);
      await c.lockStage(LEAGUE);
      expect(await c.entered(KO, signers[5].address)).to.be.true;
      expect((await c.stages(KO)).pool).to.equal(STAKE * 19n);
    });

    it("20 entrants → LOCKED; escrowed fees forward to the feeRecipient", async () => {
      const { c, signers, fee, leagueClose } = await deploy();
      await enterMany(c, signers, "enterFullSeason", 20, FULL_SEASON);
      const before = await ethers.provider.getBalance(fee.address);
      await time.increaseTo(leagueClose + 1n);
      await expect(c.lockStage(LEAGUE))
        .to.emit(c, "StageLocked")
        .withArgs(LEAGUE, 20, STAKE * 20n, FEE * 20n);
      expect((await ethers.provider.getBalance(fee.address)) - before).to.equal(FEE * 20n);
      await expect(c.connect(signers[5]).claimRefund(LEAGUE)).to.be.revertedWithCustomError(
        c,
        "StageNotVoid",
      );
    });

    it("cannot lock early or twice; anyone may lock after close", async () => {
      const { c, signers, leagueClose } = await deploy();
      await enterMany(c, signers, "enterFullSeason", 2, FULL_SEASON);
      await expect(c.lockStage(LEAGUE)).to.be.revertedWithCustomError(c, "StageNotClosed");
      await time.increaseTo(leagueClose + 1n);
      await c.connect(signers[9]).lockStage(LEAGUE); // permissionless
      await expect(c.lockStage(LEAGUE)).to.be.revertedWithCustomError(c, "AlreadyDecided");
    });
  });

  describe("matches, predictions & lazy scoring across stages", () => {
    async function withMatches() {
      const d = await deploy();
      const { c, owner, t0, leagueClose } = d;
      await c.connect(owner).addMatches(
        [t0 + 12n * 24n * 3600n, t0 + 13n * 24n * 3600n], // league MD1-ish
        [team("RMA"), team("LIV")],
        [team("MCI"), team("BAY")],
        [LEAGUE, LEAGUE],
      );
      await c.connect(owner).addMatches(
        [t0 + 45n * 24n * 3600n],
        [team("ARS")],
        [team("INT")],
        [KO],
      );
      return d;
    }

    it("stage gating: knockout-only wallets cannot predict league matches", async () => {
      const { c, signers, leagueClose } = await withMatches();
      await time.increaseTo(leagueClose); // ko sales open; league match 1 not yet locked (kickoff t0+12d)
      await c.connect(signers[5]).enterKnockout({ value: KNOCKOUT });
      await expect(
        c.connect(signers[5]).submitPrediction(1, pack(1, 1)),
      ).to.be.revertedWithCustomError(c, "NotEntered");
      await c.connect(signers[5]).submitPrediction(3, pack(2, 0)); // ko match fine
    });

    it("batch submit is one tx for a whole matchday", async () => {
      const { c, signers } = await withMatches();
      await c.connect(signers[5]).enterFullSeason({ value: FULL_SEASON });
      await c.connect(signers[5]).submitPredictions([1, 2], [pack(2, 1), pack(0, 0)]);
      expect(await c.predictionOf(signers[5].address, 1)).to.equal(pack(2, 1));
      expect(await c.predictionOf(signers[5].address, 2)).to.equal(pack(0, 0));
    });

    it("lazy per-stage scoring sums only that stage's completed matches", async () => {
      const { c, signers, oracle, t0 } = await withMatches();
      const w = signers[5];
      await c.connect(w).enterFullSeason({ value: FULL_SEASON });
      await c.connect(w).submitPredictions([1, 2], [pack(2, 1), pack(3, 0)]);
      await time.increaseTo(t0 + 14n * 24n * 3600n);
      await c.connect(oracle).pushResult(1, pack(2, 1)); // exact → 5
      await c.connect(oracle).pushResult(2, pack(1, 0)); // outcome → 1
      expect(await c.pointsOf(w.address, LEAGUE)).to.equal(6n);
      expect(await c.pointsOf(w.address, KO)).to.equal(0n);
    });

    it("unknown match ids revert", async () => {
      const { c, signers, oracle } = await withMatches();
      await c.connect(signers[5]).enterFullSeason({ value: FULL_SEASON });
      await expect(
        c.connect(signers[5]).submitPrediction(99, pack(1, 0)),
      ).to.be.revertedWithCustomError(c, "UnknownMatch");
      await expect(c.connect(oracle).pushResult(99, pack(1, 0))).to.be.revertedWithCustomError(
        c,
        "UnknownMatch",
      );
    });

    it("provisional lifecycle: immediate points, in-window correction, time finalization", async () => {
      const { c, signers, oracle, t0 } = await withMatches();
      const w = signers[5];
      await c.connect(w).enterFullSeason({ value: FULL_SEASON });
      await c.connect(w).submitPrediction(1, pack(2, 1));
      await time.increaseTo(t0 + 14n * 24n * 3600n);

      await c.connect(oracle).pushResult(1, pack(2, 1));
      let r = await c.resultOf(1);
      expect(r.provisional).to.be.true;
      expect(await c.pointsOf(w.address, LEAGUE)).to.equal(5n); // D9: counts immediately

      // UEFA amends the score inside the window — relayer self-corrects
      await expect(c.connect(oracle).correctResult(1, pack(3, 1)))
        .to.emit(c, "ResultCorrected");
      // re-scored automatically: 2-1 vs 3-1 = outcome only (5 → 1), no unwind tx
      expect(await c.pointsOf(w.address, LEAGUE)).to.equal(1n);

      // window passes → finalized, further oracle correction impossible
      await time.increase(25 * 3600);
      r = await c.resultOf(1);
      expect(r.provisional).to.be.false;
      await expect(
        c.connect(oracle).correctResult(1, pack(2, 1)),
      ).to.be.revertedWithCustomError(c, "ResultFinalized");
    });

    it("knockout flags round-trip through resultOf", async () => {
      const { c, oracle, t0 } = await withMatches();
      await time.increaseTo(t0 + 46n * 24n * 3600n);
      const koPacked = pack(1, 1) | (1n << 16n) | (1n << 17n) | (1n << 18n); // ET+pens, advancer=away
      await c.connect(oracle).pushResult(3, koPacked);
      const r = await c.resultOf(3);
      expect([r.scoreA, r.scoreB]).to.deep.equal([1n, 1n]);
      expect(r.extraTime).to.be.true;
      expect(r.penalties).to.be.true;
      expect(r.advancer).to.equal(1n);
    });

    it("decider bonuses (§5.2): leg 1 scores base-only, the decider adds ET/pens/advancer", async () => {
      const { c, owner, oracle, signers, t0 } = await withMatches();
      const w = signers[5];
      // match 3 (knockout) becomes the decider of tie 7; leg-1 semantics = no tieInfo
      await c.connect(owner).setTies([3], [7], [true]);
      await c.connect(w).enterFullSeason({ value: FULL_SEASON });

      // the archived Juve–Gala shape: 3-0 in 90', away advances in ET
      const ET = 1n << 16n;
      const AWAY = 1n << 18n;
      await c.connect(w).submitPrediction(3, pack(3, 0) | ET | AWAY); // calls everything
      await time.increaseTo(t0 + 46n * 24n * 3600n);
      await c.connect(oracle).pushResult(3, pack(3, 0) | ET | AWAY);
      // exact (5) + ET correct (1) + pens correct-by-omission (1) + advancer (1) = 8
      expect(await c.pointsOf(w.address, KO)).to.equal(8n);
      expect(await c.exactCountOf(w.address, KO)).to.equal(1n);
    });

    it("without decider flag the same flags earn nothing extra", async () => {
      const { c, oracle, signers, t0 } = await withMatches();
      const w = signers[5];
      await c.connect(w).enterFullSeason({ value: FULL_SEASON });
      const ET = 1n << 16n;
      await c.connect(w).submitPrediction(3, pack(3, 0) | ET);
      await time.increaseTo(t0 + 46n * 24n * 3600n);
      await c.connect(oracle).pushResult(3, pack(3, 0) | ET);
      expect(await c.pointsOf(w.address, KO)).to.equal(5n); // exact only — no tieInfo set
    });

    it("wrong decider calls still score the 90' rubric, each wrong flag earns 0", async () => {
      const { c, owner, oracle, signers, t0 } = await withMatches();
      const w = signers[5];
      await c.connect(owner).setTies([3], [7], [true]);
      await c.connect(w).enterFullSeason({ value: FULL_SEASON });
      await c.connect(w).submitPrediction(3, pack(3, 0)); // no flags: 90' in regulation, home advances
      await time.increaseTo(t0 + 46n * 24n * 3600n);
      const ET = 1n << 16n;
      const AWAY = 1n << 18n;
      await c.connect(oracle).pushResult(3, pack(3, 0) | ET | AWAY);
      // exact 5 + ET wrong 0 + pens right-by-omission 1 + advancer wrong 0 = 6
      expect(await c.pointsOf(w.address, KO)).to.equal(6n);
    });

    it("records entry timestamps per stage (tie-break #3)", async () => {
      const { c, signers } = await withMatches();
      const before = BigInt(await time.latest());
      await c.connect(signers[5]).enterFullSeason({ value: FULL_SEASON });
      const at = await c.enteredAt(LEAGUE, signers[5].address);
      expect(at).to.be.gte(before);
      expect(await c.enteredAt(KO, signers[5].address)).to.equal(at);
    });

    it("setTies is owner-only and checks match existence", async () => {
      const { c, owner, signers } = await withMatches();
      await expect(c.connect(signers[5]).setTies([3], [1], [true])).to.be.reverted;
      await expect(c.connect(owner).setTies([99], [1], [true])).to.be.revertedWithCustomError(
        c,
        "UnknownMatch",
      );
    });

    it("oracle can reschedule SCHEDULED matches only", async () => {
      const { c, oracle, signers, t0 } = await withMatches();
      const newKick = t0 + 20n * 24n * 3600n;
      await expect(c.connect(oracle).batchUpdateKickoffs([1], [newKick]))
        .to.emit(c, "KickoffUpdated")
        .withArgs(1, newKick);
      expect((await c.matches(1)).kickoff).to.equal(newKick);
      await expect(c.connect(signers[5]).batchUpdateKickoffs([1], [newKick])).to.be.revertedWithCustomError(
        c,
        "NotOracle",
      );
      await time.increaseTo(newKick + 3600n);
      await c.connect(oracle).pushResult(1, pack(0, 0));
      await expect(
        c.connect(oracle).batchUpdateKickoffs([1], [newKick]),
      ).to.be.revertedWithCustomError(c, "MatchAlreadyCompleted");
    });
  });

  describe("freeze, claims & trophy (slice 11)", () => {
    /**
     * Mini-season: 20 full-season wallets (floor exactly met), one league
     * match + one knockout decider; every wallet predicts differently so the
     * ranking is fully determined; freeze both stages; claims drain the pools.
     */
    async function miniSeason() {
      const signers = await ethers.getSigners();
      const [owner, fee, oracle] = signers;
      const t0 = BigInt(await time.latest());
      const leagueClose = t0 + 5n * 24n * 3600n;
      const koClose = t0 + 20n * 24n * 3600n;
      const F = await ethers.getContractFactory("ChampionzPredictor");
      const c = await upgrades.deployProxy(
        F,
        [owner.address, fee.address, oracle.address, leagueClose, koClose],
        { kind: "uups" },
      );
      await c.connect(owner).addMatches(
        [t0 + 6n * 24n * 3600n, t0 + 21n * 24n * 3600n],
        [team("RMA"), team("ARS")],
        [team("MCI"), team("INT")],
        [LEAGUE, KO],
      );
      await c.connect(owner).setTies([2], [1], [true]);

      const players = signers.slice(5, 25); // exactly 20
      for (const p of players) await c.connect(p).enterFullSeason({ value: FULL_SEASON });
      // player i predicts i-0 for match 1 → result 2-0: i=2 exact(5), others GD/outcome/0
      for (let i = 0; i < players.length; i++) {
        await c.connect(players[i]!).submitPrediction(1, pack(Math.min(i, 15), 0));
      }
      await time.increaseTo(t0 + 6n * 24n * 3600n + 3600n);
      await c.connect(oracle).pushResult(1, pack(2, 0));
      await time.increase(25 * 3600); // finalize the league result
      await c.lockStage(LEAGUE); // closeAt already passed
      return { c, owner, fee, oracle, players, t0 };
    }

    /** expected §5.3 order for miniSeason league: exact(2) > GD(others desc? ...) */
    function expectedLeagueOrder(players: { address: string }[]): string[] {
      // result 2-0 (diff 2): i=2 exact; i>2 same sign+wrong diff unless diff matches: i-0 diff=i → only i=2 GD;
      // i=1 (1-0): win, diff 1 → outcome 1pt; i>=3: win, wrong diff → outcome 1pt; i=0 (0-0): draw → 0.
      const exact = [players[2]!.address];
      const outcome = players
        .filter((_, i) => i !== 0 && i !== 2)
        .map((p) => p.address); // all 1 pt, 0 exacts — tie-break: entry order (earlier first)
      const zero = [players[0]!.address];
      return [...exact, ...outcome, ...zero].map((a) => a);
    }

    it("freezes with the exact §5.3 order, pays the split, dust to rank 1, pool drains to zero", async () => {
      const { c, players } = await miniSeason();
      const ranked = expectedLeagueOrder(players);
      await expect(c.freezeStage(LEAGUE, ranked)).to.emit(c, "StageFrozen");

      const pool = ethers.parseEther("500") * 20n; // 10,000 CHZ
      expect(await c.claimable(LEAGUE, ranked[0]!)).to.be.gte((pool * 25n) / 100n); // 25% + dust
      expect(await c.claimable(LEAGUE, ranked[1]!)).to.equal((pool * 15n) / 100n);
      expect(await c.claimable(LEAGUE, ranked[2]!)).to.equal((pool * 10n) / 100n);
      expect(await c.claimable(LEAGUE, ranked[5]!)).to.equal((pool * 30n) / 100n / 7n);
      expect(await c.claimable(LEAGUE, ranked[15]!)).to.equal((pool * 20n) / 100n / 10n);

      // everyone claims; pool must be exactly zero afterwards
      for (const addr of ranked) {
        const signer = await ethers.getSigner(addr);
        await c.connect(signer).claim(LEAGUE);
      }
      expect((await c.stages(LEAGUE)).pool).to.equal(0n);
    });

    it("rejects wrong order, wrong members, duplicates and double freeze", async () => {
      const { c, players, owner } = await miniSeason();
      const ranked = expectedLeagueOrder(players);

      const swapped = [...ranked];
      [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
      await expect(c.freezeStage(LEAGUE, swapped)).to.be.revertedWithCustomError(c, "InvalidRanking");

      const outsider = [...ranked];
      outsider[19] = owner.address; // never entered
      await expect(c.freezeStage(LEAGUE, outsider)).to.be.revertedWithCustomError(c, "InvalidRanking");

      const dup = [...ranked];
      dup[19] = dup[0]!;
      await expect(c.freezeStage(LEAGUE, dup)).to.be.revertedWithCustomError(c, "InvalidRanking");

      await c.freezeStage(LEAGUE, ranked);
      await expect(c.freezeStage(LEAGUE, ranked)).to.be.revertedWithCustomError(c, "AlreadyDecided");
    });

    it("cannot freeze before every stage result is finalized (D3 in code)", async () => {
      const { c, oracle, players, t0 } = await miniSeason();
      // knockout decider: push a result but do NOT wait out the 24h window
      await time.increaseTo(t0 + 21n * 24n * 3600n + 3600n);
      await c.connect(oracle).pushResult(2, pack(1, 1));
      await c.lockStage(KO); // koClose (t0+20d) already passed; 20 entrants → LOCKED
      const ranked = expectedLeagueOrder(players); // any 20 entered wallets
      // result still provisional → freeze must refuse (D3 enforced by code)
      await expect(c.freezeStage(KO, ranked)).to.be.revertedWithCustomError(c, "StageNotFinal");
    });

    it("claim guards: not frozen, no share, double claim", async () => {
      const { c, players } = await miniSeason();
      await expect(c.connect(players[0]!).claim(LEAGUE)).to.be.revertedWithCustomError(
        c,
        "StageNotFrozen",
      );
      const ranked = expectedLeagueOrder(players);
      await c.freezeStage(LEAGUE, ranked);
      const winner = await ethers.getSigner(ranked[0]!);
      await c.connect(winner).claim(LEAGUE);
      await expect(c.connect(winner).claim(LEAGUE)).to.be.revertedWithCustomError(
        c,
        "NothingToClaim",
      );
    });

    it("measures freeze gas (bounded 20-wallet recomputation)", async () => {
      const { c, players } = await miniSeason();
      const ranked = expectedLeagueOrder(players);
      const tx = await c.freezeStage(LEAGUE, ranked);
      const rc = await tx.wait();
      console.log(`      freezeStage gas (20 wallets, 2 matches): ${rc!.gasUsed}`);
      expect(rc!.gasUsed).to.be.lt(10_000_000n);
    });
  });

  describe("ChampionzTrophy (ADR-0008)", () => {
    it("owner mints one zero-fund trophy; metadata is inline; others cannot mint", async () => {
      const [owner, champion, rando] = await ethers.getSigners();
      const T = await ethers.getContractFactory("ChampionzTrophy");
      const t = await T.deploy(owner.address);
      await expect(t.connect(rando).mint(champion.address, "2026/27")).to.be.reverted;
      await expect(t.connect(owner).mint(champion.address, "2026/27")).to.emit(t, "TrophyMinted");
      expect(await t.ownerOf(1)).to.equal(champion.address);
      expect(await t.tokenURI(1)).to.contain("Ultimate");
      expect(await t.tokenURI(1)).to.contain("2026/27");
    });
  });

  describe("windows & admin", () => {
    it("owner can move a SELLING stage's window; not after it decided", async () => {
      const { c, owner, signers, leagueClose, t0 } = await deploy();
      await c.connect(owner).setStageWindow(KO, leagueClose, leagueClose + 60n * 24n * 3600n);
      await expect(
        c.connect(signers[5]).setStageWindow(KO, t0, t0 + 1n),
      ).to.be.reverted; // not owner
      await time.increaseTo(leagueClose + 1n);
      await c.lockStage(LEAGUE); // decides (void, 0 entrants)
      await expect(
        c.connect(owner).setStageWindow(LEAGUE, t0, t0 + 1n),
      ).to.be.revertedWithCustomError(c, "AlreadyDecided");
    });

    it("initialize validates windows and addresses", async () => {
      const [owner, fee, oracle] = await ethers.getSigners();
      const t0 = BigInt(await time.latest());
      const F = await ethers.getContractFactory("ChampionzPredictor");
      await expect(
        upgrades.deployProxy(F, [owner.address, fee.address, oracle.address, t0 + 100n, t0 + 50n], {
          kind: "uups",
        }),
      ).to.be.revertedWithCustomError(F, "InvalidWindow");
    });
  });
});
