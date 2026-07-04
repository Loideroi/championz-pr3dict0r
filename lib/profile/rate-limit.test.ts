import { describe, expect, it } from "vitest";
import {
  checkRateLimit,
  EMPTY_RATE_LIMIT_STATE,
  HOUR_WINDOW_MS,
  MAX_WRITES_PER_HOUR,
  MIN_WRITE_INTERVAL_MS,
  type RateLimitState,
} from "./rate-limit";

const T0 = Date.parse("2026-07-04T12:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

describe("checkRateLimit — 30s minimum interval", () => {
  it("allows the first ever write and opens an hour window", () => {
    const d = checkRateLimit(EMPTY_RATE_LIMIT_STATE, T0);
    expect(d.allowed).toBe(true);
    if (d.allowed) {
      expect(d.nextState).toEqual({
        lastWriteAt: iso(T0),
        windowStartedAt: iso(T0),
        windowWrites: 1,
      });
    }
  });

  it("blocks a second write inside 30s with a correct Retry-After", () => {
    const state: RateLimitState = {
      lastWriteAt: iso(T0),
      windowStartedAt: iso(T0),
      windowWrites: 1,
    };
    const d = checkRateLimit(state, T0 + 10_000);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.retryAfterSeconds).toBe(20);
  });

  it("allows again exactly at the 30s boundary", () => {
    const state: RateLimitState = {
      lastWriteAt: iso(T0),
      windowStartedAt: iso(T0),
      windowWrites: 1,
    };
    const d = checkRateLimit(state, T0 + MIN_WRITE_INTERVAL_MS);
    expect(d.allowed).toBe(true);
    if (d.allowed) expect(d.nextState.windowWrites).toBe(2);
  });
});

describe("checkRateLimit — 8/hour window", () => {
  it("blocks the 9th write in one hour window until the window ends", () => {
    const state: RateLimitState = {
      lastWriteAt: iso(T0 + 20 * 60_000),
      windowStartedAt: iso(T0),
      windowWrites: MAX_WRITES_PER_HOUR,
    };
    const now = T0 + 30 * 60_000; // half-way through the window
    const d = checkRateLimit(state, now);
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.retryAfterSeconds).toBe((HOUR_WINDOW_MS - 30 * 60_000) / 1000);
    }
  });

  it("resets the window after an hour", () => {
    const state: RateLimitState = {
      lastWriteAt: iso(T0 + 20 * 60_000),
      windowStartedAt: iso(T0),
      windowWrites: MAX_WRITES_PER_HOUR,
    };
    const now = T0 + HOUR_WINDOW_MS + 1;
    const d = checkRateLimit(state, now);
    expect(d.allowed).toBe(true);
    if (d.allowed) {
      expect(d.nextState.windowStartedAt).toBe(iso(now));
      expect(d.nextState.windowWrites).toBe(1);
    }
  });

  it("counts consecutive allowed writes up to the cap", () => {
    let state: RateLimitState = EMPTY_RATE_LIMIT_STATE;
    let now = T0;
    for (let i = 1; i <= MAX_WRITES_PER_HOUR; i++) {
      const d = checkRateLimit(state, now);
      expect(d.allowed).toBe(true);
      if (d.allowed) state = d.nextState;
      now += MIN_WRITE_INTERVAL_MS;
    }
    const ninth = checkRateLimit(state, now);
    expect(ninth.allowed).toBe(false);
  });

  it("treats corrupt timestamps as no prior writes (fail open, not crash)", () => {
    const d = checkRateLimit(
      { lastWriteAt: "garbage", windowStartedAt: "garbage", windowWrites: 3 },
      T0,
    );
    expect(d.allowed).toBe(true);
  });
});
