import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { spicy } from "@reown/appkit/networks";
import type { AppKitNetwork } from "@reown/appkit/networks";

/**
 * Wallet connection — Reown AppKit + wagmi on Chiliz Spicy (88882) for the
 * walking skeleton; mainnet (88888) joins at cutover (issue 16).
 *
 * Socios.com Wallet rules (CLAUDE.md): it is an ERC-1271 smart-contract
 * account reached via WalletConnect — never overwrite window.ethereum, never
 * use eth_signTypedData, and confirm writes by polling chain state (see
 * usePollForEffect), not by awaiting receipts.
 */
export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const networks: [AppKitNetwork, ...AppKitNetwork[]] = [spicy];

export const wagmiAdapter = new WagmiAdapter({
  // AppKit requires a non-empty id at construction; the placeholder keeps
  // CI builds (no env) working — the modal simply can't pair without a real id.
  projectId: projectId || "MISSING_PROJECT_ID",
  networks,
  ssr: true,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
