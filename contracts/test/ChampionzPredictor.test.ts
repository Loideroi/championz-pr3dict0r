import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const ENTRY_GROSS = ethers.parseEther("550");
const ENTRY_FEE = ethers.parseEther("50");
const LOCKOUT = 3600n;
const FLAG_SUBMITTED = 1n << 20n;

function pack(a: number, b: number): bigint {
  return BigInt(a) | (BigInt(b) << 8n) | FLAG_SUBMITTED;
}

describe("ChampionzPredictor v0 (walking skeleton)", () => {
  async function deploy() {
    const [owner, fee, oracle, alice, bob] = await ethers.getSigners();
    const kickoff = BigInt(await time.latest()) + 7n * 24n * 3600n;
    const F = await ethers.getContractFactory("ChampionzPredictor");
    const c = await upgrades.deployProxy(
      F,
      [
        owner.address,
        fee.address,
        oracle.address,
        kickoff,
        ethers.encodeBytes32String("RMA").slice(0, 8),
        ethers.encodeBytes32String("MCI").slice(0, 8),
      ],
      { kind: "uups" },
    );
    return { c, owner, fee, oracle, alice, bob, kickoff };
  }

  describe("entry (exact 550, fee flows immediately)", () => {
    it("accepts exactly 550 CHZ, splits 500 pool / 50 fee", async () => {
      const { c, fee, alice } = await deploy();
      const before = await ethers.provider.getBalance(fee.address);
      await expect(c.connect(alice).enter({ value: ENTRY_GROSS })).to.emit(c, "Entered");
      expect(await c.pool()).to.equal(ethers.parseEther("500"));
      expect(await c.entryCount()).to.equal(1n);
      expect((await ethers.provider.getBalance(fee.address)) - before).to.equal(ENTRY_FEE);
    });

    it("rejects any other amount (predecessor M-03)", async () => {
      const { c, alice } = await deploy();
      for (const v of [ethers.parseEther("549"), ethers.parseEther("550.000001"), 0n]) {
        await expect(c.connect(alice).enter({ value: v })).to.be.revertedWithCustomError(
          c,
          "InvalidStakeAmount",
        );
      }
    });

    it("rejects double entry", async () => {
      const { c, alice } = await deploy();
      await c.connect(alice).enter({ value: ENTRY_GROSS });
      await expect(c.connect(alice).enter({ value: ENTRY_GROSS })).to.be.revertedWithCustomError(
        c,
        "AlreadyEntered",
      );
    });
  });

  describe("predictions (packed, editable until T-60)", () => {
    it("round-trips the packed encoding and overwrites on edit", async () => {
      const { c, alice } = await deploy();
      await c.connect(alice).enter({ value: ENTRY_GROSS });
      await c.connect(alice).submitPrediction(pack(2, 1));
      expect(await c.predictionOf(alice.address)).to.equal(pack(2, 1));
      await c.connect(alice).submitPrediction(pack(0, 3)); // edit = overwrite
      expect(await c.predictionOf(alice.address)).to.equal(pack(0, 3));
    });

    it("requires entry, the submitted flag, and sane scores", async () => {
      const { c, alice, bob } = await deploy();
      await c.connect(alice).enter({ value: ENTRY_GROSS });
      await expect(c.connect(bob).submitPrediction(pack(1, 1))).to.be.revertedWithCustomError(
        c,
        "NotEntered",
      );
      await expect(c.connect(alice).submitPrediction(1n | (1n << 8n))).to.be.revertedWithCustomError(
        c,
        "InvalidPrediction", // missing submitted flag
      );
      await expect(c.connect(alice).submitPrediction(pack(16, 0))).to.be.revertedWithCustomError(
        c,
        "InvalidPrediction", // > MAX_GOALS
      );
    });

    it("locks exactly 60 minutes before kickoff", async () => {
      const { c, alice, kickoff } = await deploy();
      await c.connect(alice).enter({ value: ENTRY_GROSS });
      await time.increaseTo(kickoff - LOCKOUT - 5n);
      await c.connect(alice).submitPrediction(pack(2, 1)); // still open
      await time.increaseTo(kickoff - LOCKOUT);
      await expect(c.connect(alice).submitPrediction(pack(2, 2))).to.be.revertedWithCustomError(
        c,
        "PredictionsLocked",
      );
    });
  });

  describe("oracle + lazy scoring", () => {
    async function settled(predA: number, predB: number, resA: number, resB: number) {
      const d = await deploy();
      await d.c.connect(d.alice).enter({ value: ENTRY_GROSS });
      await d.c.connect(d.alice).submitPrediction(pack(predA, predB));
      await time.increaseTo(d.kickoff + 2n * 3600n);
      await d.c.connect(d.oracle).pushResult(resA, resB);
      return d;
    }

    it("only the oracle can push, only after kickoff, only once", async () => {
      const { c, oracle, alice, kickoff } = await deploy();
      await expect(c.connect(alice).pushResult(1, 0)).to.be.revertedWithCustomError(c, "NotOracle");
      await expect(c.connect(oracle).pushResult(1, 0)).to.be.revertedWithCustomError(
        c,
        "MatchNotStarted",
      );
      await time.increaseTo(kickoff + 1n);
      await c.connect(oracle).pushResult(1, 0);
      await expect(c.connect(oracle).pushResult(2, 0)).to.be.revertedWithCustomError(
        c,
        "MatchAlreadyCompleted",
      );
    });

    it("scores 5 exact / 3 goal-diff / 1 outcome / 0 wrong — no settlement tx", async () => {
      expect(await (await settled(2, 1, 2, 1)).c.pointsOf((await ethers.getSigners())[3].address)).to.equal(5n);
      expect(await (await settled(3, 2, 2, 1)).c.pointsOf((await ethers.getSigners())[3].address)).to.equal(3n);
      expect(await (await settled(1, 0, 4, 2)).c.pointsOf((await ethers.getSigners())[3].address)).to.equal(1n);
      expect(await (await settled(0, 2, 4, 2)).c.pointsOf((await ethers.getSigners())[3].address)).to.equal(0n);
    });

    it("returns 0 before completion and for non-predictors", async () => {
      const { c, alice, bob } = await deploy();
      await c.connect(alice).enter({ value: ENTRY_GROSS });
      await c.connect(alice).submitPrediction(pack(2, 1));
      expect(await c.pointsOf(alice.address)).to.equal(0n); // not completed yet
      const s = await settled(2, 1, 2, 1);
      expect(await s.c.pointsOf(bob.address)).to.equal(0n); // never predicted
    });
  });

  describe("access control & upgrade authorization", () => {
    it("owner rotates the oracle; others cannot", async () => {
      const { c, owner, alice, bob } = await deploy();
      await expect(c.connect(alice).setOracle(bob.address)).to.be.reverted;
      await expect(c.connect(owner).setOracle(bob.address)).to.emit(c, "OracleRotated");
      expect(await c.oracle()).to.equal(bob.address);
    });

    it("rejects accidental plain transfers (no receive/fallback, L-04)", async () => {
      const { c, alice } = await deploy();
      await expect(
        alice.sendTransaction({ to: await c.getAddress(), value: 1n }),
      ).to.be.reverted;
    });

    it("only the owner can upgrade (UUPS)", async () => {
      const { c, alice } = await deploy();
      const F = await ethers.getContractFactory("ChampionzPredictor", alice);
      await expect(upgrades.upgradeProxy(await c.getAddress(), F)).to.be.reverted;
    });
  });
});
