import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import * as dotenv from "dotenv";

dotenv.config();

const rawKey = process.env.DEPLOYER_PRIVATE_KEY ?? "";
const deployerKey = rawKey ? (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) : undefined;

const config: HardhatUserConfig = {
  paths: { sources: "./src" },
  solidity: {
    version: "0.8.24",
    settings: {
      // Chiliz Chain ceiling: Solidity <=0.8.24, Shanghai EVM (docs.chiliz.com FAQ)
      evmVersion: "shanghai",
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    hardhat: {
      // floor tests need 20+ entrants at 1,100 CHZ each
      accounts: { count: 40, accountsBalance: "1000000000000000000000000" },
    },
    spicy: {
      url: "https://spicy-rpc.chiliz.com",
      chainId: 88882,
      accounts: deployerKey ? [deployerKey] : [],
      // Chiliz minimum: 2,501 gwei (2,500 base + 1 priority)
      gasPrice: 2510_000_000_000,
    },
    chiliz: {
      url: process.env.CHILIZ_RPC_URL ?? "https://rpc.ankr.com/chiliz",
      chainId: 88888,
      accounts: deployerKey ? [deployerKey] : [],
      gasPrice: 2510_000_000_000, // 2,510 gwei > the 2,501 mainnet floor
    },
  },
  etherscan: {
    // Routescan's Etherscan-compatible API — keyless, any placeholder works
    apiKey: { spicy: "routescan", chiliz: "routescan" },
    customChains: [
      {
        network: "spicy",
        chainId: 88882,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/testnet/evm/88882/etherscan",
          browserURL: "https://testnet.chiliscan.com",
        },
      },
      {
        network: "chiliz",
        chainId: 88888,
        urls: {
          apiURL: "https://api.routescan.io/v2/network/mainnet/evm/88888/etherscan",
          browserURL: "https://chiliscan.com",
        },
      },
    ],
  },
};

export default config;
