"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { networks, projectId, wagmiAdapter, wagmiConfig } from "@/lib/wagmi/config";

// Socios.com Wallet — promote it to the top of the Reown modal via
// featuredWalletIds. ID from the Chiliz docs:
// https://docs.chiliz.com/develop/advanced/integrate-socios.com-wallet-in-your-dapp
const SOCIOS_WALLET_ID =
  "56843177b5e89d4bcb19a27dab7c49e0f33d8d3a6c8c4c7e5274f605e92befd6";

// Module-scope init (Reown's documented App Router pattern) so the hook is
// usable during prerender too; a placeholder id keeps env-less CI builds green.
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: projectId || "MISSING_PROJECT_ID",
  featuredWalletIds: [SOCIOS_WALLET_ID],
  // This does leave the device: sign-client puts it in wc_sessionPropose and in
  // the stored session, and the wallet renders it on its approval sheet. Being
  // precise about why it changed, though — it is NOT one of the three things
  // CLAUDE.md's ASCII rule enumerates (signed personal_sign strings, on-chain
  // string args, API payload identifiers), and nothing is known to mishandle ₵
  // here. Metadata never reaches signing bytes, so this is not the PR #23
  // isValidSignature case either. It is consistency with that rule's intent, on
  // the ASCII form the Telegram link message already uses — not a fix for an
  // observed break. Empty icons left a blank card beside the name on the one
  // screen where a user judges whether a dapp is genuine.
  metadata: {
    name: "Ch@mpi0nz Pr3dict0r",
    description: "UEFA Champions League 2026/27 prediction pool on Chiliz Chain",
    url: "https://pr3dict0r.com",
    icons: ["https://pr3dict0r.com/icon-512.png"],
  },
  features: { analytics: false, email: false, socials: false },
});

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
