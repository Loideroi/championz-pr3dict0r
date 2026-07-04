"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { networks, projectId, wagmiAdapter, wagmiConfig } from "@/lib/wagmi/config";

// Module-scope init (Reown's documented App Router pattern) so the hook is
// usable during prerender too; a placeholder id keeps env-less CI builds green.
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: projectId || "MISSING_PROJECT_ID",
  metadata: {
    name: "₵h@mpi0nz Pr3dict0r",
    description: "UEFA Champions League 2026/27 prediction pool on Chiliz Chain",
    url: "https://pr3dict0r.com",
    icons: [],
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
