/**
 * Matchday slate helpers (PRD §6) — pure functions over on-chain match data.
 * Everything here is deterministic (SSR-safe): no Date.now(), no unpinned
 * locales. Components pass `now` in; formatting pins "en-US" + UTC.
 */
import { PREDICTION_LOCKOUT_SECONDS } from "../economics";
import { packPrediction } from "./packed";

export type SlateMatch = {
  id: number;
  /** unix seconds */
  kickoff: number;
  /** MatchStatus.COMPLETED on-chain */
  completed: boolean;
  teamA: string;
  teamB: string;
  /** STAGE_LEAGUE (0) | STAGE_KNOCKOUT (1) */
  stage: number;
};

export type ScorePick = { scoreA: number; scoreB: number };

export type MatchPhase = "open" | "locked" | "completed";

export type SlateGroup = {
  stage: number;
  /** UTC day bucket, e.g. "2027-05-29" */
  dayKey: string;
  /** e.g. "Sat, May 29" (en-US, UTC — deterministic) */
  dayLabel: string;
  matches: SlateMatch[];
};

export type SlateChange = {
  matchId: number;
  /** null = first submission for this match */
  old: ScorePick | null;
  next: ScorePick;
};

/** Unix second at which predictions for a match lock (T-60, PRD §6). */
export function lockAt(match: { kickoff: number }): number {
  return match.kickoff - PREDICTION_LOCKOUT_SECONDS;
}

export function matchPhase(
  match: { kickoff: number; completed: boolean },
  now: number,
): MatchPhase {
  if (match.completed) return "completed";
  if (now >= lockAt(match)) return "locked";
  return "open";
}

/** UTC calendar-day bucket for grouping ("matchday evening"). */
export function kickoffDayKey(kickoff: number): string {
  return new Date(kickoff * 1000).toISOString().slice(0, 10);
}

/**
 * Pinned en-US + UTC day bucket, e.g. "Wed, Jan 20" — safe in render
 * (CLAUDE.md SSR rule). This is a weekday/month label, not a clock time, so the
 * en-GB 24-hour mandate (PRD §9) doesn't apply here; it stays en-US so the day
 * label reads identically regardless of the UI locale.
 */
export function formatKickoffDay(kickoff: number): string {
  return new Date(kickoff * 1000).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/**
 * Pinned en-GB + UTC 24-hour clock time, e.g. "20:00 UTC" (PRD §9: kickoff
 * times render 24-hour en-GB on every route regardless of the UI locale).
 */
export function formatUtcTime(ts: number): string {
  const t = new Date(ts * 1000).toLocaleTimeString("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${t} UTC`;
}

/** "2h 14m"-style lock countdown (PRD §6). Clamps at zero. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3_600);
  const m = Math.floor((s % 3_600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

/**
 * Group the slate by stage, then by kickoff day (UTC). Groups are ordered by
 * stage then earliest kickoff; matches inside a group by kickoff then id.
 */
export function groupSlate(matches: SlateMatch[]): SlateGroup[] {
  const buckets = new Map<string, SlateGroup>();
  for (const match of matches) {
    const dayKey = kickoffDayKey(match.kickoff);
    const key = `${match.stage}|${dayKey}`;
    let group = buckets.get(key);
    if (!group) {
      group = {
        stage: match.stage,
        dayKey,
        dayLabel: formatKickoffDay(match.kickoff),
        matches: [],
      };
      buckets.set(key, group);
    }
    group.matches.push(match);
  }
  const groups = [...buckets.values()];
  for (const g of groups) {
    g.matches.sort((a, b) => a.kickoff - b.kickoff || a.id - b.id);
  }
  groups.sort(
    (a, b) => a.stage - b.stage || a.matches[0].kickoff - b.matches[0].kickoff,
  );
  return groups;
}

export function samePick(a: ScorePick | null, b: ScorePick | null): boolean {
  if (a === null || b === null) return a === b;
  return a.scoreA === b.scoreA && a.scoreB === b.scoreB;
}

/**
 * Everything staged locally that actually differs from chain state — the
 * old → new diff shown before signing, and the batch payload. Drafts equal
 * to the on-chain pick are dropped (nothing to pay gas for).
 */
export function diffSlate(
  drafts: ReadonlyMap<number, ScorePick>,
  onchain: ReadonlyMap<number, ScorePick>,
): SlateChange[] {
  const changes: SlateChange[] = [];
  for (const [matchId, next] of drafts) {
    const old = onchain.get(matchId) ?? null;
    if (samePick(next, old)) continue;
    changes.push({ matchId, old, next });
  }
  changes.sort((a, b) => a.matchId - b.matchId);
  return changes;
}

/** One `submitPredictions(uint16[],uint256[])` call for the whole diff. */
export function toBatchArgs(changes: SlateChange[]): {
  matchIds: number[];
  packeds: bigint[];
} {
  return {
    matchIds: changes.map((c) => c.matchId),
    packeds: changes.map((c) => packPrediction(c.next.scoreA, c.next.scoreB)),
  };
}
