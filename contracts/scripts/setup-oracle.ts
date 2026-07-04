import { ethers } from "hardhat";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * D5/PRD §8.1: the relayer signs with a DEDICATED low-value key — never the
 * owner. This script generates a fresh keypair, writes the private key to
 * contracts/.oracle.key (gitignored; consumed by `gh secret set` via stdin —
 * NEVER printed), funds it with gas from the deployer, and rotates the
 * contract's oracle to it. Only the ADDRESS is logged.
 *
 * Usage: PROXY=0x… npx hardhat run scripts/setup-oracle.ts --network spicy
 */
async function main() {
  const proxy = process.env.PROXY;
  if (!proxy) throw new Error("Set PROXY=0x…");
  const [deployer] = await ethers.getSigners();

  const oracle = ethers.Wallet.createRandom();
  const keyPath = join(__dirname, "..", ".oracle.key");
  writeFileSync(keyPath, oracle.privateKey + "\n", { mode: 0o600 });
  console.log(`oracle address: ${oracle.address}`);
  console.log(`private key written to contracts/.oracle.key (gitignored — pipe into gh secret, then delete)`);

  const fundTx = await deployer.sendTransaction({
    to: oracle.address,
    value: ethers.parseEther("100"), // gas only — ~hundreds of pushes at 2,501 gwei
  });
  await fundTx.wait();
  console.log(`funded with 100 CHZ (gas only)`);

  const c = await ethers.getContractAt("ChampionzPredictor", proxy);
  const tx = await c.setOracle(oracle.address);
  await tx.wait();
  console.log(`contract oracle rotated to ${oracle.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
