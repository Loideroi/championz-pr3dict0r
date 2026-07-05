import { ethers } from "hardhat";

/** PRD §7.2 transparency: declare on-chain which feed the oracle relays. */
async function main() {
  const proxy = process.env.PROXY;
  const ref = process.env.REF ?? "uefa-api:match.uefa.com/v5";
  if (!proxy) throw new Error("Set PROXY=0x…");
  const c = await ethers.getContractAt("ChampionzPredictor", proxy);
  const tx = await c.setResultSource(ref);
  await tx.wait();
  console.log(`resultSourceRef = "${await c.resultSourceRef()}"`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
