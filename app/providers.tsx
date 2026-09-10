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
  // Sent to the WalletConnect relay in the session proposal, and rendered by the
  // wallet on its approval sheet — an external payload, so CLAUDE.md's ASCII rule
  // applies and the ₵ stays in UI copy only. "Ch@mpi0nz" is the same ASCII form
  // the Telegram link message already signs with. An empty icons array leaves a
  // blank card next to the name on that sheet, which reads as a spoofed dapp.
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
