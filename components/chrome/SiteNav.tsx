"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import {
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_LABELS,
  type AppLocale,
} from "@/i18n/config";

const LINKS = [
  { href: "/enter", key: "enter" },
  { href: "/play", key: "predict" },
  { href: "/standings", key: "standings" },
  { href: "/hall-of-fame", key: "hallOfFame" },
  { href: "/profile", key: "profile" },
] as const;

/**
 * Language switcher — a real <select> (not a clickable div) that writes the
 * NEXT_LOCALE cookie and refreshes the server tree so the request config picks
 * up the new locale. No URL segment, no client-side messages swap: the whole
 * page re-renders from the cookie (i18n/request.ts), avoiding a hydration
 * mismatch. Shows the current locale as the selected option.
 */
function LocaleSwitcher() {
  const router = useRouter();
  const active = useLocale();
  const t = useTranslations("localeSwitcher");

  function onChange(next: AppLocale) {
    // One-year cookie, root path — matches next-intl's convention.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <select
      aria-label={t("label")}
      value={active}
      onChange={(e) => onChange(e.target.value as AppLocale)}
      className="rounded-full border border-line bg-white/5 px-3 py-2 font-mono text-xs text-ink focus:border-glow-2 focus:outline-none"
    >
      {LOCALES.map((code) => (
        <option key={code} value={code} className="bg-night text-ink">
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}

/** Sticky nav — brand mark, section links, wallet pill (mock's header). */
export function SiteNav() {
  const pathname = usePathname();
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const t = useTranslations("nav");

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
              {t(l.key)}
            </Link>
          ))}
        </nav>
        <span className="flex-1" />
        <LocaleSwitcher />
        <button
          type="button"
          onClick={() => open()}
          className="flex items-center gap-2 rounded-full border border-line bg-white/5 px-4 py-2 font-mono text-xs"
        >
          <span
            aria-hidden="true"
            className={`h-2 w-2 rounded-full ${isConnected ? "bg-ok shadow-[0_0_8px_var(--ok)]" : "bg-muted-2"}`}
          />
          {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : t("connect")}
        </button>
      </div>
    </header>
  );
}
