import { ethers, upgrades, network, run } from "hardhat";

/**
 * Deploys the v0 walking-skeleton proxy to Spicy with a placeholder fixture
 * kicking off in 7 days. Owner/feeRecipient/oracle all = deployer for the
 * skeleton (separated in later slices). Prints the proxy address to wire into
 * .env.local (NEXT_PUBLIC_PREDICTOR_ADDRESS) and attempts Chiliscan
 * verification via Routescan's keyless API.
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`network: ${network.name}`);
  console.log(`deployer: ${deployer.address}`);
  console.log(`balance:  ${ethers.formatEther(balance)} CHZ`);
  if (balance < ethers.parseEther("5")) {
    throw new Error("Deployer balance too low — fund with Spicy faucet CHZ first.");
  }

  const latest = await ethers.provider.getBlock("latest");
  const kickoff = BigInt(latest!.timestamp) + 7n * 24n * 3600n;
  const teamA = "0x524d41"; // "RMA"
  const teamB = "0x4d4349"; // "MCI"

  const F = await ethers.getContractFactory("ChampionzPredictor");
  const proxy = await upgrades.deployProxy(
    F,
    [deployer.address, deployer.address, deployer.address, kickoff, teamA, teamB],
    { kind: "uups" },
  );
  await proxy.waitForDeployment();
  const proxyAddress = await proxy.getAddress();
  const implAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);

  console.log(`proxy:          ${proxyAddress}`);
  console.log(`implementation: ${implAddress}`);
  console.log(`skeleton match: RMA vs MCI, kickoff ${new Date(Number(kickoff) * 1000).toISOString()}`);
  console.log(`\nSet NEXT_PUBLIC_PREDICTOR_ADDRESS=${proxyAddress} in .env.local`);

  try {
    console.log("verifying implementation on Chiliscan (Routescan)...");
    await run("verify:verify", { address: implAddress, constructorArguments: [] });
  } catch (err) {
    console.warn(`verification failed (retry later with npx hardhat verify): ${err}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
