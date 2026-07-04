import { ethers, upgrades, network } from "hardhat";

/**
 * UUPS upgrade: validates storage-layout safety first (aborts on any
 * incompatibility), then upgrades the proxy and prints the REAL new
 * implementation read back from the EIP-1967 slot (the predecessor's
 * upgrade.ts printed a stale address — we read the slot, not the plugin).
 *
 * Usage: PROXY=0x… npx hardhat run scripts/upgrade.ts --network spicy
 */
async function main() {
  const proxy = process.env.PROXY;
  if (!proxy) throw new Error("Set PROXY=0x… to the proxy address to upgrade.");
  const [deployer] = await ethers.getSigners();
  console.log(`network: ${network.name} · signer: ${deployer.address}`);
  console.log(`proxy:   ${proxy}`);

  const F = await ethers.getContractFactory("ChampionzPredictor");

  console.log("validating upgrade safety (storage layout, initializers)…");
  await upgrades.validateUpgrade(proxy, F, { kind: "uups" });
  console.log("✓ layout compatible");

  const before = await upgrades.erc1967.getImplementationAddress(proxy);
  await upgrades.upgradeProxy(proxy, F);
  // read the EIP-1967 slot until it actually changes (RPC lag)
  let after = before;
  for (let i = 0; i < 30 && after === before; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    after = await upgrades.erc1967.getImplementationAddress(proxy);
  }
  console.log(`implementation: ${before} → ${after}`);
  if (after === before) throw new Error("implementation slot unchanged — check the tx");
  console.log(`Verify separately: npx hardhat verify --network ${network.name} ${after}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
