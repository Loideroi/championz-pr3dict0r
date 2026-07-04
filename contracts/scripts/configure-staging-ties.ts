import { ethers } from "hardhat";

/**
 * Staging tie wiring (slice 07): matches 3 & 4 mirror archived AET deciders,
 * so mark them as deciders (tie ids 1 & 2) — bonuses apply exactly like the
 * real knockout second legs they replay.
 */
async function main() {
  const proxy = process.env.PROXY;
  if (!proxy) throw new Error("Set PROXY=0x…");
  const c = await ethers.getContractAt("ChampionzPredictor", proxy);
  const tx = await c.setTies([3, 4], [1, 2], [true, true]);
  await tx.wait();
  console.log("ties set: match 3 → tie 1 (decider), match 4 → tie 2 (decider)");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
