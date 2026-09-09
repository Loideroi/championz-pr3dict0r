import { escapeHtml } from './alerts.js';
import type { ChainState, MapEntry, RelaySummary } from './relay.js';

/**
 * Public-channel content (slice 10, PRD §12): results digests after each run
 * that changed chain state, and the pre-lock reminders (lock is T-60). Pure
 * composers — transports and dedupe live at the edges. Rate-limit friendly:
 * one digest per run, not one message per match (20 msg/min channel cap).
 */

export interface MatchInfo {
  matchId: number;
  label: string; // "RMA–MCI"
  scoreA?: number;
  scoreB?: number;
  extraTime?: boolean;
  penalties?: boolean;
  provisional?: boolean;
}

export function composeResultsDigest(pushed: MatchInfo[], corrected: MatchInfo[]): string | null {
  if (pushed.length === 0 && corrected.length === 0) return null;
  const line = (m: MatchInfo) =>
    `⚽ <b>${escapeHtml(m.label)}</b> ${m.scoreA}–${m.scoreB} (90′)` +
    (m.extraTime ? ' · went to extra time' : '') +
    (m.penalties ? ' · decided on penalties' : '') +
    (m.provisional ? ' · <i>◌ provisional 24h</i>' : '');
  const parts: string[] = [];
  if (pushed.length > 0) {
    parts.push('<b>FULL TIME</b>', ...pushed.map(line));
  }
  if (corrected.length > 0) {
    parts.push('<b>CORRECTED</b> (UEFA amended — we follow)', ...corrected.map(line));
  }
  parts.push('', 'Leaderboard is live → https://pr3dict0r.com/standings');
  return parts.join('\n');
}

/** "~35 minutes" / "~1h 10m" / "~3h" — reads naturally at either tier. */
export function formatLead(minutes: number): string {
  if (minutes < 60) return `~${minutes} minutes`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `~${h}h` : `~${h}h ${m}m`;
}

/**
 * One message per tier. "Last call" only when it is genuinely last call —
 * a heads-up three hours out that shouts "Last call" trains people to ignore it.
 */
export function composeReminder(matches: MatchInfo[], minutesToLock: number): string {
  const list = matches.map((m) => `• ${escapeHtml(m.label)}`).join('\n');
  const headline =
    minutesToLock * 60 <= LAST_CALL_WINDOW_SECONDS
      ? `⏰ <b>Last call</b> — predictions lock in ${formatLead(minutesToLock)}:`
      : `⏰ <b>Predictions lock in ${formatLead(minutesToLock)}</b>:`;
  return [
    headline,
    list,
    '',
    'Edit until T-60 (you only re-pay ~$0.05 gas) → https://pr3dict0r.com/play',
  ].join('\n');
}

/**
 * How far ahead of the T-60 lock each reminder tier may fire.
 *
 * Two tiers, because GitHub's scheduler is not merely "a few minutes late".
 * Measured 28 Aug – 9 Sep 2026, the 5-minute matchday cron delivered 7–10 runs a
 * day against ~124 requested: gaps of 2–5 hours are normal, not exceptional.
 * On 8 Sep the runs were 12:05, 14:35 and 18:23 — a 30-minute window around
 * the 15:45 lock was never sampled and MD1 got no reminder at all.
 *
 * LAST_CALL is the message worth sending: close enough to the lock to act on.
 * HEADS_UP is the net that catches the case where no run lands near the lock.
 * Each tier dedupes independently on the oracle log, so a match gets at most
 * one of each — and on a well-sampled day, only the last call.
 */
export const LAST_CALL_WINDOW_SECONDS = 90 * 60;
export const HEADS_UP_WINDOW_SECONDS = 4 * 60 * 60;

/** Back-compat: the unqualified "reminder window" is the last-call tier. */
export const DEFAULT_REMINDER_WINDOW_SECONDS = LAST_CALL_WINDOW_SECONDS;

/** Whole minutes until this match's T-60 lock, floored at 1. */
export function minutesToLock(kickoff: number, nowSeconds: number): number {
  return Math.max(1, Math.round((kickoff - 3600 - nowSeconds) / 60));
}

/**
 * Which mapped matches fall inside `windowSeconds` of their T-60 lock right
 * now? Callers pass the tier's window and dedupe per tier via the oracle log.
 */
export function matchesNeedingReminder(
  map: MapEntry[],
  states: Map<number, ChainState>,
  nowSeconds: number,
  windowSeconds = DEFAULT_REMINDER_WINDOW_SECONDS,
): number[] {
  const due: number[] = [];
  for (const entry of map) {
    const state = states.get(entry.matchId);
    if (!state || state.completed || state.kickoff === 0) continue;
    const lockAt = state.kickoff - 3600;
    const delta = lockAt - nowSeconds;
    if (delta > 0 && delta <= windowSeconds) due.push(entry.matchId);
  }
  return due;
}
