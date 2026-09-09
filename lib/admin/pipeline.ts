/**
 * Per-match pipeline state and matchday coverage for the admin console.
 *
 * The oracle log holds one `result_push` / `correction` row per match (with
 * the tx hash since the relay started reporting it) and one `alert` row per
 * reminder tier the channel bot sent. Folding those onto the on-chain match
 * table answers "did the bot handle this fixture, and when" without opening
 * Actions or Telegram.
 *
 * The coverage span is a port of relayer/src/matchday.ts — keep the three
 * constants in lockstep with it. The app cannot import the relayer package,
 * and the logic is small enough that a copy is cheaper than a shared build.
 */
import type { OracleLogRow } from "./health";

export type MatchPipeline = {
  pushedAt: string | null;
  pushTx: string | null;
  correctedAt: string | null;
  correctionTx: string | null;
  corrections: number;
  /** reminder tiers sent for this match, in the order the bot sent them */
  reminders: string[];
};

const REMINDER_TYPES = new Set(["t75_reminder", "heads_up"]);

const alertTypeOf = (row: OracleLogRow): string | null => {
  const d = row.detail as { type?: unknown } | null | undefined;
  return d && typeof d.type === "string" ? d.type : null;
};

/** Fold log rows (any order) into one pipeline record per match id. */
export function matchPipelines(rows: OracleLogRow[]): Map<number, MatchPipeline> {
  const out = new Map<number, MatchPipeline>();
  const sorted = [...rows]
    .filter((r) => r.match_id !== null)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  for (const row of sorted) {
    const id = row.match_id as number;
    const p = out.get(id) ?? {
      pushedAt: null,
      pushTx: null,
      correctedAt: null,
      correctionTx: null,
      corrections: 0,
      reminders: [],
    };
    if (row.kind === "result_push") {
      // First push wins: a second push row would be a replay, not a new event.
      if (!p.pushedAt) {
        p.pushedAt = row.created_at;
        p.pushTx = row.tx_hash ?? null;
      }
    } else if (row.kind === "correction") {
      p.corrections += 1;
      p.correctedAt = row.created_at;
      p.correctionTx = row.tx_hash ?? null;
    } else if (row.kind === "alert") {
      const type = alertTypeOf(row);
      if (type && REMINDER_TYPES.has(type)) p.reminders.push(type);
    }
    out.set(id, p);
  }
  return out;
}

/** Whole minutes from kickoff to the push landing; null when either is unknown. */
export function pushLatencyMinutes(kickoffSec: number, pushedAtIso: string | null): number | null {
  if (!pushedAtIso || kickoffSec <= 0) return null;
  const pushed = Date.parse(pushedAtIso);
  if (Number.isNaN(pushed)) return null;
  return Math.round((pushed / 1000 - kickoffSec) / 60);
}

/** relayer/src/watchdog.ts STALE_AFTER_SECONDS — the SOURCE_STALE trigger. */
export const OVERDUE_AFTER_SECONDS = 2 * 3600;

/** A scheduled match this long past kickoff with no result is what the bot calls stale. */
export function isOverdue(kickoffSec: number, completed: boolean, nowSec: number): boolean {
  return !completed && kickoffSec > 0 && nowSec >= kickoffSec + OVERDUE_AFTER_SECONDS;
}

/* ------------------------------------------------------------------ */
/* Matchday coverage — port of relayer/src/matchday.ts                 */
/* ------------------------------------------------------------------ */

export const LOCK_LEAD_SECONDS = 3600;
export const COVERAGE_OPEN_BEFORE_LOCK_SECONDS = 4 * 3600;
export const COVERAGE_TAIL_AFTER_KICKOFF_SECONDS = 150 * 60;

export type Span = { start: number; end: number };

const utcDay = (epochSeconds: number): string => new Date(epochSeconds * 1000).toISOString().slice(0, 10);

/** Kickoffs of the current or next matchday (same UTC date as the earliest one still in play). */
export function matchdayKickoffs(kickoffs: number[], now: number): number[] {
  const upcoming = kickoffs
    .filter((k) => k > 0 && k + COVERAGE_TAIL_AFTER_KICKOFF_SECONDS > now)
    .sort((a, b) => a - b);
  const next = upcoming[0];
  if (next === undefined) return [];
  return upcoming.filter((k) => utcDay(k) === utcDay(next));
}

export function matchdaySpan(kickoffs: number[], now: number): Span | null {
  const day = matchdayKickoffs(kickoffs, now);
  if (day.length === 0) return null;
  const first = day[0] as number;
  const last = day[day.length - 1] as number;
  return {
    start: first - LOCK_LEAD_SECONDS - COVERAGE_OPEN_BEFORE_LOCK_SECONDS,
    end: last + COVERAGE_TAIL_AFTER_KICKOFF_SECONDS,
  };
}

export type CoverageStatus =
  | { state: "none" }
  | { state: "upcoming"; span: Span; kickoffs: number }
  | { state: "covering"; span: Span; kickoffs: number };

/** Is a matchday-watch runner supposed to be holding the relay right now? */
export function coverageStatus(kickoffs: number[], now: number): CoverageStatus {
  const span = matchdaySpan(kickoffs, now);
  if (!span) return { state: "none" };
  const count = matchdayKickoffs(kickoffs, now).length;
  if (now >= span.start && now < span.end) return { state: "covering", span, kickoffs: count };
  return { state: "upcoming", span, kickoffs: count };
}

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/**
 * Explorer deep link, or null when the stored value is not a transaction
 * hash. The log table is public-read and service-role-write, but a link
 * target built from a database string still has to be shape-checked before
 * it lands in an href — a stray `javascript:` row must render as text.
 */
export function explorerTxUrl(chainId: number, hash: string | null | undefined): string | null {
  if (!hash || !TX_HASH.test(hash)) return null;
  const base = chainId === 88888 ? "https://chiliscan.com" : "https://testnet.chiliscan.com";
  return `${base}/tx/${hash}`;
}
