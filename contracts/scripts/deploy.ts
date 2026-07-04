import { ethers, upgrades, network, run } from "hardhat";

/**
 * Deploys the v1 two-stage proxy to Spicy with COMPRESSED staging windows so
 * every state is demoable within days (production windows follow the real
 * calendar via setStageWindow / issue 16):
 *   league sales:  now → now+2d   (then lockStage decides LOCKED/VOID)
 *   knockout sales: now+2d → now+30d
 * Fixtures: 2 league matches (+3d, +4d) and 2 knockout matches (+3d12h, +12d)
 * — the early knockout match lets the D4 locked-matches disclosure be
 * demonstrated while knockout sales are open.
 *
 * NOTE: verification hangs are known (Routescan polling) — this script skips
 * verify; run `npx hardhat verify --network spicy <impl>` separately.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`network: ${network.name}`);
  console.log(`deployer: ${deployer.address}`);
  console.log(`balance:  ${ethers.formatEther(balance)} CHZ`);
  if (balance < ethers.parseEther("10")) {
    throw new Error("Deployer balance too low — fund with Spicy faucet CHZ first.");
  }

  const latest = await ethers.provider.getBlock("latest");
  const t0 = BigInt(latest!.timestamp);
  const DAY = 24n * 3600n;
  const leagueCloseAt = t0 + 2n * DAY;
  const knockoutCloseAt = t0 + 30n * DAY;

  const F = await ethers.getContractFactory("ChampionzPredictor");
  const proxy = await upgrades.deployProxy(
    F,
    [deployer.address, deployer.address, deployer.address, leagueCloseAt, knockoutCloseAt],
    { kind: "uups" },
  );
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  const team = (s: string) => "0x" + Buffer.from(s, "utf8").toString("hex");
  const tx = await proxy.addMatches(
    [t0 + 3n * DAY, t0 + 4n * DAY, t0 + 3n * DAY + 12n * 3600n, t0 + 12n * DAY],
    [team("RMA"), team("LIV"), team("ARS"), team("BAR")],
    [team("MCI"), team("BAY"), team("INT"), team("PSG")],
    [0, 0, 1, 1],
  );
  await tx.wait();

  console.log(`proxy:          ${proxyAddress}`);
  console.log(`implementation: ${implAddress}`);
  console.log(`league sales close:   ${new Date(Number(leagueCloseAt) * 1000).toISOString()}`);
  console.log(`knockout sales close: ${new Date(Number(knockoutCloseAt) * 1000).toISOString()}`);
  console.log(`matches: 4 added (2 league, 2 knockout)`);
  console.log(`\nSet NEXT_PUBLIC_PREDICTOR_ADDRESS=${proxyAddress} in .env.local`);
  console.log(`Verify separately: npx hardhat verify --network spicy ${implAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
