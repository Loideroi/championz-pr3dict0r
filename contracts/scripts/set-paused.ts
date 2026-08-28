import { ethers, network } from "hardhat";

/**
 * Owner pause / unpause from the CLI (the /admin console does the same with
 * the browser wallet). DRY RUN by default.
 *
 *   PROXY=0x… ACTION=pause|unpause [CONFIRM=1] npx hardhat run scripts/set-paused.ts --network chiliz
 */
async function main() {
  const proxy = process.env.PROXY;
  const action = process.env.ACTION;
  const confirm = process.env.CONFIRM === "1";
  if (!proxy || (action !== "pause" && action !== "unpause")) throw new Error("Set PROXY=0x… and ACTION=pause|unpause");

  const [signer] = await ethers.getSigners();
  const c = await ethers.getContractAt("ChampionzPredictor", proxy);
  const [owner, paused] = await Promise.all([c.owner(), c.paused()]);
  console.log(`=== set-paused — ${network.name} ${confirm ? "BROADCAST" : "DRY RUN"} ===`);
  console.log(`proxy: ${proxy} · signer ${signer.address} · owner ${owner} · paused() = ${paused}`);
  if (owner.toLowerCase() !== signer.address.toLowerCase()) throw new Error("signer is not the owner");

  const want = action === "pause";
  if (paused === want) {
    console.log(`already ${action}d — nothing to do`);
    return;
  }
  if (!confirm) {
    console.log(`would call ${action}(). Re-run with CONFIRM=1.`);
    return;
  }
  const tx = want ? await c.pause() : await c.unpause();
  await tx.wait();
  // public RPCs lag their receipts — poll the state
  let now = await c.paused();
  for (let i = 0; i < 30 && now !== want; i++) {
    await new Promise((r) => setTimeout(r, 3_000));
    now = await c.paused();
  }
  console.log(`${action}() tx ${tx.hash} · paused() = ${now}`);
  if (now !== want) throw new Error("state did not change — check the tx on the explorer");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
