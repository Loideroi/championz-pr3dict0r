import { escapeHtml } from './alerts.js';
import type { ChainState, MapEntry, RelaySummary } from './relay.js';

/**
 * Public-channel content (slice 10, PRD §12): results digests after each run
 * that changed chain state, and the last-call reminder ~75 min before kickoff
 * (i.e. ≤15 min before the T-60 prediction lock). Pure composers — transports
 * and dedupe live at the edges. Rate-limit friendly: one digest per run, not
 * one message per match (20 msg/min channel cap).
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

export function composeReminder(matches: MatchInfo[], minutesToLock: number): string {
  const list = matches.map((m) => `• ${escapeHtml(m.label)}`).join('\n');
  return [
    `⏰ <b>Last call</b> — predictions lock in ~${minutesToLock} minutes:`,
    list,
    '',
    'Edit until T-60 (you only re-pay ~$0.05 gas) → https://pr3dict0r.com/play',
  ].join('\n');
}

/**
 * Which mapped matches should get the last-call reminder this run?
 * Window: lock (kickoff-60min) is 0<Δ≤15 min away. The caller dedupes via the
 * oracle log (a 5-min cron would otherwise post up to 3 times per match).
 */
export function matchesNeedingReminder(
  map: MapEntry[],
  states: Map<number, ChainState>,
  nowSeconds: number,
  windowSeconds = 15 * 60,
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
