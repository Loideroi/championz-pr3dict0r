"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isActivePath, MOBILE_NAV_LINKS } from "@/lib/nav";

/**
 * Mobile bottom navigation (< md). The header's link row is `hidden md:flex`,
 * so below 768px the app had NO navigation at all beyond the brand mark —
 * a real gap given the Socios.com Wallet audience is mobile by definition.
 *
 * Fixed to the bottom with iOS safe-area padding (the PWA runs
 * `black-translucent`, so the home-indicator strip must not eat the labels).
 *
 * Cells are 4.25rem/68px tall so the *whole* cell — icon and label — clears the
 * 44px minimum tap target rather than just the icon; the 56px version read as a
 * thin strip and mis-taps were common. That height is duplicated in
 * `app/layout.tsx` (body bottom padding) and `components/predict/SubmitBar.tsx`
 * (sticky offset) — the three move together or content hides behind the bar.
 *
 * Labels are the short per-locale forms — "Şöhretler Salonu" never fits five
 * across a 360px screen. 10 mono chars at 10px is the ceiling that still fits
 * (fr "Classement", it "Classifica"); `truncate` catches anything longer.
 */
export function MobileNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav
      aria-label={t("mobileLabel")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-night/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {MOBILE_NAV_LINKS.map((link) => {
          const active = isActivePath(pathname, link.href);
          return (
            <li key={link.href} className="flex flex-1">
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-[4.25rem] w-full flex-col items-center justify-center gap-1.5 px-1 transition-colors touch-manipulation active:bg-night-2 active:text-glow-soft ${
                  active ? "text-glow-2" : "text-muted"
                }`}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-gradient-to-r from-transparent via-glow-2 to-transparent"
                  />
                )}
                <Icon name={link.icon} />
                <span className="w-full truncate text-center font-mono text-[10px] leading-none tracking-tight">
                  {t(link.shortKey)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Inline stroke icons (currentColor) — no icon dependency, tokens stay in CSS.
 * 22px at strokeWidth 2: the 20px/1.6 pair rendered hairline-thin against the
 * night background once the browser snapped it to a physical pixel.
 */
function Icon({ name }: { name: (typeof MOBILE_NAV_LINKS)[number]["icon"] }) {
  const paths: Record<typeof name, string> = {
    enter: "M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M15 8l4 4-4 4M19 12H9",
    predict: "M4 7h16M4 12h16M4 17h16M9 4v16M15 4v16",
    standings: "M5 20V10M12 20V4M19 20v-7",
    hall: "M8 4h8v5a4 4 0 0 1-8 0V4ZM6 5H4v2a3 3 0 0 0 3 3M18 5h2v2a3 3 0 0 1-3 3M10 17h4M9 20h6",
    profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0",
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={paths[name]} />
    </svg>
  );
}
