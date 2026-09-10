import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { chiliz, spicy } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";

/**
 * Wallet connection — Reown AppKit + wagmi on Chiliz Chain. The active network
 * is env-driven: mainnet (88888) in production, Spicy testnet (88882) otherwise,
 * so the modal always offers the same chain the deployed contract lives on.
 *
 * Socios.com Wallet rules (CLAUDE.md): it is an ERC-1271 smart-contract
 * account reached via WalletConnect — never overwrite window.ethereum, never
 * use eth_signTypedData, and confirm writes by polling chain state (see
 * usePollForEffect), not by awaiting receipts.
 *
 * No customRpcUrls here, deliberately. NEXT_PUBLIC_RPC_URL points at Ankr,
 * which the browser must not use: Ankr caps eth_getLogs at 1,000 blocks
 * (measured — see rpcCandidatesFor in lib/predictor/chains.ts), and
 * AdminPanel.computeRanked scans Entered events from block 0 to latest in the
 * browser to build the freeze ranking. That is ~35.5M blocks on mainnet, so
 * pointing this transport at Ankr would fail it with -32062 and break the
 * ranking that decides who gets paid. The chain default answers the same scan
 * in ~230ms and serves contract reads equally well, so leaving this unset is
 * the correct configuration, not an oversight.
 */
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

// Pick the network from NEXT_PUBLIC_CHAIN_ID (inlined at build). Defaults to
// Spicy so env-less CI builds and local dev stay on testnet.
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "88882");
const primaryNetwork: AppKitNetwork = chainId === chiliz.id ? chiliz : spicy;

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [primaryNetwork];

export const wagmiAdapter = new WagmiAdapter({
  // AppKit requires a non-empty id at construction; the placeholder keeps
  // CI builds (no env) working — the modal simply can't pair without a real id.
  projectId: projectId || "MISSING_PROJECT_ID",
  networks,
  ssr: true,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
