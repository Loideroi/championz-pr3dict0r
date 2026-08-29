/**
 * Navigation model shared by the header (md+) and the mobile bottom bar.
 * Pure — no React, no client hooks — so the active-route rule is testable.
 */
export const MOBILE_NAV_LINKS = [
  { href: "/enter", key: "enter", shortKey: "short.enter", icon: "enter" },
  { href: "/play", key: "predict", shortKey: "short.predict", icon: "predict" },
  { href: "/standings", key: "standings", shortKey: "short.standings", icon: "standings" },
  { href: "/hall-of-fame", key: "hallOfFame", shortKey: "short.hallOfFame", icon: "hall" },
  { href: "/profile", key: "profile", shortKey: "short.profile", icon: "profile" },
] as const;

/**
 * Is `href` the section the user is currently in? Exact match, plus nested
 * routes (`/play/anything` still highlights Predict). "/" never matches a
 * section — the brand mark owns home.
 */
export function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}
