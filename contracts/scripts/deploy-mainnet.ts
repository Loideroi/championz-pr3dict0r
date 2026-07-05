import { ethers, upgrades, network, run } from "hardhat";

/**
 * MAINNET production deploy (slice 16 launch). Chiliz Chain 88888.
 *
 *   OWNER   = 0x47103b0FC04c91Ac388eaE3c4f91D038CBfD9CF8 (ADR-0005; also feeRecipient)
 *   ORACLE  = 0xB57Cb421E3B707d0970Ec758D40a4366DB317B15 (RESULT_ORACLE_ROLE; fund with gas separately)
 *   windows = real UCL 2026/27 calendar; adjustable post-draw via setStageWindow while SELLING:
 *             leagueCloseAt   = first MD1 kickoff        2026-09-08 16:45 UTC
 *             knockoutCloseAt = last play-off 1st leg    2027-02-17 20:00 UTC
 *
 * No matches are added here — they're generated + pushed after the 27 Aug draw.
 * League sales open immediately (owner's explicit choice). Verification is a
 * SEPARATE step (Routescan polling can hang): npx hardhat verify --network chiliz <impl>
 *
 * Refuses to run on any chain other than 88888.
 */
const OWNER = "0x47103b0FC04c91Ac388eaE3c4f91D038CBfD9CF8";
const FEE_RECIPIENT = "0x47103b0FC04c91Ac388eaE3c4f91D038CBfD9CF8";
const ORACLE = "0xB57Cb421E3B707d0970Ec758D40a4366DB317B15";
const LEAGUE_CLOSE_AT = 1788885900; // 2026-09-08 16:45:00 UTC
const KNOCKOUT_CLOSE_AT = 1802894400; // 2027-02-17 20:00:00 UTC
const RESULT_SOURCE_REF = "uefa-api:match.uefa.com/v5";

async function main() {
  if (network.config.chainId !== 88888) {
    throw new Error(`refusing to run on chainId ${network.config.chainId} — this is a MAINNET (88888) script`);
  }
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  const now = (await ethers.provider.getBlock("latest"))!.timestamp;
  console.log("=== ₵h@mpi0nz Pr3dict0r — MAINNET deploy (88888) ===");
  console.log(`deployer:        ${deployer.address}`);
  console.log(`balance:         ${ethers.formatEther(balance)} CHZ`);
  console.log(`owner:           ${OWNER}`);
  console.log(`feeRecipient:    ${FEE_RECIPIENT}`);
  console.log(`oracle:          ${ORACLE}`);
  console.log(`leagueCloseAt:   ${LEAGUE_CLOSE_AT} (${new Date(LEAGUE_CLOSE_AT * 1000).toISOString()})`);
  console.log(`knockoutCloseAt: ${KNOCKOUT_CLOSE_AT} (${new Date(KNOCKOUT_CLOSE_AT * 1000).toISOString()})`);
  if (balance < ethers.parseEther("30")) throw new Error("deployer balance too low for a safe mainnet deploy");
  if (LEAGUE_CLOSE_AT <= now || KNOCKOUT_CLOSE_AT <= LEAGUE_CLOSE_AT) throw new Error("window ordering invalid vs chain time");

  const F = await ethers.getContractFactory("ChampionzPredictor");
  console.log("\ndeploying UUPS proxy…");
  const proxy = await upgrades.deployProxy(
    F,
    [OWNER, FEE_RECIPIENT, ORACLE, LEAGUE_CLOSE_AT, KNOCKOUT_CLOSE_AT],
    { kind: "uups" },
  );
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  // owner must sign the source-ref tx; deployer IS owner here (0x4710)
  console.log("setting resultSourceRef…");
  await (await proxy.setResultSource(RESULT_SOURCE_REF)).wait();

  console.log("\n=== DEPLOYED ===");
  console.log(`proxy:          ${proxyAddress}`);
  console.log(`implementation: ${implAddress}`);
  console.log(`owner():        ${await proxy.owner()}`);
  console.log(`oracle():       ${await proxy.oracle()}`);
  console.log(`resultSourceRef:${await proxy.resultSourceRef()}`);
  console.log(`\nSet NEXT_PUBLIC_PREDICTOR_ADDRESS=${proxyAddress} (mainnet) in Vercel prod env.`);
  console.log(`Verify: npx hardhat verify --network chiliz ${implAddress}`);
  console.log(`Explorer: https://chiliscan.com/address/${proxyAddress}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
