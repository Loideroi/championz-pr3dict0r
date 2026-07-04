"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";

const LINKS = [
  { href: "/enter", label: "Enter" },
  { href: "/play", label: "Predict" },
  { href: "/standings", label: "Standings" },
  { href: "/hall-of-fame", label: "Hall of Fame" },
  { href: "/profile", label: "Profile" },
];

/** Sticky nav — brand mark, section links, wallet pill (mock's header). */
export function SiteNav() {
  const pathname = usePathname();
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();

  return (
    <header className="sticky top-0 z-50 border-b border-line-soft bg-night/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-5">
        <Link href="/" className="flex items-center gap-2 font-display text-base font-black tracking-wide">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-glow-2 to-glow shadow-[0_0_18px_rgba(46,107,255,0.55)]"
          >
            ★
          </span>
          <span className="hidden sm:inline">₵h@mpi0nz&nbsp;Pr3dict0r</span>
        </Link>
        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm ${
                pathname === l.href ? "bg-white/5 text-ink" : "text-muted hover:bg-white/5 hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => open()}
          className="flex items-center gap-2 rounded-full border border-line bg-white/5 px-4 py-2 font-mono text-xs"
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${isConnected ? "bg-ok shadow-[0_0_8px_var(--ok)]" : "bg-muted-2"}`}
          />
          {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connect"}
        </button>
      </div>
    </header>
  );
}
