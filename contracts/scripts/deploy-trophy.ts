import { ethers, network } from "hardhat";

/** Deploys the ChampionzTrophy ERC-721 (ADR-0008). Owner = deployer. */
async function main() {
  const [deployer] = await ethers.getSigners();
  const T = await ethers.getContractFactory("ChampionzTrophy");
  const t = await T.deploy(deployer.address);
  await t.waitForDeployment();
  const addr = await t.getAddress();
  console.log(`ChampionzTrophy on ${network.name}: ${addr}`);
  console.log(`Set NEXT_PUBLIC_TROPHY_ADDRESS=${addr} in .env.local`);
  console.log(`Verify separately: npx hardhat verify --network ${network.name} ${addr} ${deployer.address}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
