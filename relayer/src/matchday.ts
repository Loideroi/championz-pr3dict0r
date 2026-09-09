/**
 * Matchday coverage span — when a long-lived watcher should stay awake.
 *
 * GitHub's `schedule` trigger delivers a fraction of the ticks it is asked
 * for: measured 28 Aug – 9 Sep 2026, oracle-bot got 7–10 runs a day against
 * the ~124 its crons request, with 2–5 hour gaps as the norm. That is fine
 * for a poller and useless for anything that must happen inside a particular
 * half hour — MD1's last-call reminder was never sent because no run landed
 * between 15:15 and 15:45 UTC.
 *
 * The watcher answers that by not depending on cron punctuality at all: it
 * holds one runner for the part of a matchday that matters and polls from
 * inside it. These helpers decide what "the part that matters" is.
 *
 * Coverage opens at the earliest heads-up window (first T-60 lock, minus the
 * 4h heads-up tier) and closes 150 minutes after the last kickoff — full time
 * plus margin for the result to surface in the UEFA feed.
 */
export const LOCK_LEAD_SECONDS = 3600;
export const COVERAGE_OPEN_BEFORE_LOCK_SECONDS = 4 * 3600;
export const COVERAGE_TAIL_AFTER_KICKOFF_SECONDS = 150 * 60;

export interface Span {
  start: number;
  end: number;
}

const utcDay = (epochSeconds: number): string =>
  new Date(epochSeconds * 1000).toISOString().slice(0, 10);

/**
 * Kickoffs belonging to the current or next matchday — i.e. those sharing the
 * UTC date of the earliest kickoff not yet past its coverage tail. Empty when
 * the season has nothing left.
 */
export function matchdayKickoffs(kickoffs: number[], now: number): number[] {
  const upcoming = kickoffs
    .filter((k) => k > 0 && k + COVERAGE_TAIL_AFTER_KICKOFF_SECONDS > now)
    .sort((a, b) => a - b);
  const next = upcoming[0];
  if (next === undefined) return [];
  return upcoming.filter((k) => utcDay(k) === utcDay(next));
}

/** The full window a watcher would cover for that matchday, or null. */
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

/**
 * The epoch second a watcher started *now* may stop at, or 0 when there is
 * nothing to watch yet (too early, or no matchday left). Zero is the signal
 * for the workflow to exit without burning a runner.
 */
export function coverageEnd(kickoffs: number[], now: number): number {
  const span = matchdaySpan(kickoffs, now);
  if (!span) return 0;
  return now >= span.start && now < span.end ? span.end : 0;
}
