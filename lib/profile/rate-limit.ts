/**
 * DB-backed, serverless-safe rate limit for profile writes (PRD §13.2).
 *
 * The window state lives on the wallet's clp_user_profiles row
 * (last_write_at / window_started_at / window_writes), so any number of
 * stateless serverless instances enforce the same limits — no in-memory
 * counters. This module is the pure window math; the API route reads the
 * row, calls {@link checkRateLimit}, and persists `nextState` on success.
 */

export const MIN_WRITE_INTERVAL_MS = 30_000; // max 1 write / 30 s
export const HOUR_WINDOW_MS = 60 * 60 * 1000;
export const MAX_WRITES_PER_HOUR = 8;

/** Rate-limit columns as stored on the clp_user_profiles row. */
export type RateLimitState = {
  lastWriteAt: string | null; // timestamptz ISO
  windowStartedAt: string | null; // timestamptz ISO
  windowWrites: number;
};

export type RateLimitDecision =
  | { allowed: true; nextState: RateLimitState }
  | { allowed: false; retryAfterSeconds: number; reason: string };

export const EMPTY_RATE_LIMIT_STATE: RateLimitState = {
  lastWriteAt: null,
  windowStartedAt: null,
  windowWrites: 0,
};

function parseTs(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/**
 * Decide whether a profile write at `nowMs` is allowed, and what the stored
 * state becomes if it is. Enforces both limits: 1 write / 30 s and
 * 8 writes / rolling-start hour window.
 */
export function checkRateLimit(
  state: RateLimitState,
  nowMs: number,
): RateLimitDecision {
  const last = parseTs(state.lastWriteAt);
  if (last !== null && nowMs - last < MIN_WRITE_INTERVAL_MS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((MIN_WRITE_INTERVAL_MS - (nowMs - last)) / 1000),
      reason: "Please wait 30 seconds between profile updates.",
    };
  }

  const windowStart = parseTs(state.windowStartedAt);
  const windowLive = windowStart !== null && nowMs - windowStart < HOUR_WINDOW_MS;

  if (windowLive && state.windowWrites >= MAX_WRITES_PER_HOUR) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((windowStart! + HOUR_WINDOW_MS - nowMs) / 1000),
      reason: "Hourly profile-update limit reached (8/hour).",
    };
  }

  const nowIso = new Date(nowMs).toISOString();
  return {
    allowed: true,
    nextState: windowLive
      ? {
          lastWriteAt: nowIso,
          windowStartedAt: state.windowStartedAt,
          windowWrites: state.windowWrites + 1,
        }
      : { lastWriteAt: nowIso, windowStartedAt: nowIso, windowWrites: 1 },
  };
}
