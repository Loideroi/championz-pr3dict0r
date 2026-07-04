/**
 * Leaderboard ordering — PRD §5.3, exactly this chain:
 *   1. total points (desc)
 *   2. most exact scores (desc)
 *   3. earliest entry (asc)
 *   4. lowest wallet address ("because computers enjoy order") — canon.
 */
export interface StandingRow {
  address: `0x${string}`;
  username?: string;
  countryCode?: string;
  fullSeason: boolean;
  leaguePoints: bigint | null; // null = not in Stage 1 (renders "—")
  knockoutPoints: bigint;
  exactCount: bigint;
  enteredAt: bigint;
}

export type StageView = "league" | "knockout" | "season";

export function pointsFor(row: StandingRow, view: StageView): bigint | null {
  if (view === "league") return row.leaguePoints;
  if (view === "knockout") return row.knockoutPoints;
  return (row.leaguePoints ?? 0n) + row.knockoutPoints; // Season View combined
}

export function compareRows(view: StageView) {
  return (a: StandingRow, b: StandingRow): number => {
    const pa = pointsFor(a, view) ?? 0n;
    const pb = pointsFor(b, view) ?? 0n;
    if (pa !== pb) return pa > pb ? -1 : 1;
    if (a.exactCount !== b.exactCount) return a.exactCount > b.exactCount ? -1 : 1;
    if (a.enteredAt !== b.enteredAt) return a.enteredAt < b.enteredAt ? -1 : 1;
    const aa = a.address.toLowerCase();
    const bb = b.address.toLowerCase();
    return aa < bb ? -1 : aa > bb ? 1 : 0;
  };
}

/** Stage-1 board lists Full Season wallets only; the others list everyone. */
export function rowsForView(rows: StandingRow[], view: StageView): StandingRow[] {
  const filtered = view === "league" ? rows.filter((r) => r.fullSeason) : rows;
  return [...filtered].sort(compareRows(view));
}

/** Regional-indicator flag from an ISO-3166 alpha-2 code; empty if unknown. */
export function flagEmoji(countryCode?: string): string {
  if (!countryCode || !/^[A-Za-z]{2}$/.test(countryCode)) return "";
  const [a, b] = countryCode.toUpperCase();
  return String.fromCodePoint(0x1f1e6 + a!.charCodeAt(0) - 65, 0x1f1e6 + b!.charCodeAt(0) - 65);
}
