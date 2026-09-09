import { describe, expect, it } from "vitest";
import {
  CLAIM_CHALLENGE_SECONDS,
  ENTRY,
  PAYOUT_SPLIT,
  PAYOUT_TOP_N,
  PREDICTION_LOCKOUT_SECONDS,
  STAGE_FLOOR,
  formatChz,
  formatChzWei,
  projectedPayouts,
  shareForWei,
} from "./economics";

const CHZ = 10n ** 18n;
const sum = (xs: bigint[]) => xs.reduce((a, b) => a + b, 0n);

describe("entry economics (PRD §4.3)", () => {
  it("full season = 1,100 CHZ gross: 500+500 pools + 100 fee", () => {
    expect(ENTRY.fullSeason.pool + ENTRY.fullSeason.fee).toBe(ENTRY.fullSeason.gross);
    expect(ENTRY.fullSeason.gross).toBe(1100);
  });

  it("knockout = 550 CHZ gross: 500 pool + 50 flat fee", () => {
    expect(ENTRY.knockout.pool + ENTRY.knockout.fee).toBe(ENTRY.knockout.gross);
    expect(ENTRY.knockout.gross).toBe(550);
  });

  it("fee per stage is a flat 50 (no 512.82-style decimals)", () => {
    expect(ENTRY.knockout.fee).toBe(50);
    expect(ENTRY.fullSeason.fee).toBe(2 * ENTRY.knockout.fee);
  });

  it("stage floor and lockout match the grilled decisions", () => {
    expect(STAGE_FLOOR).toBe(20);
    expect(PREDICTION_LOCKOUT_SECONDS).toBe(3600);
    expect(CLAIM_CHALLENGE_SECONDS).toBe(24 * 3600);
  });

  it("formats CHZ with pinned en-US locale", () => {
    expect(formatChz(1100)).toBe("1,100");
    expect(formatChzWei(1100n * CHZ)).toBe("1,100");
    // whole CHZ, floored — a projected share is never shown with fake precision
    expect(formatChzWei(1_092_857_142_857_142_857_142n)).toBe("1,092");
  });
});

describe("payout split — mirrors ChampionzPredictor._shareFor / _applyRanking", () => {
  // 20 entrants × 500 CHZ: the smallest pool a LOCKED stage can hold
  const pool = 10_000n * CHZ;

  it("pays 25 / 15 / 10 to the podium of a 10,000 CHZ pool", () => {
    expect(shareForWei(0, pool)).toBe(2_500n * CHZ);
    expect(shareForWei(1, pool)).toBe(1_500n * CHZ);
    expect(shareForWei(2, pool)).toBe(1_000n * CHZ);
  });

  it("shares 30% equally across places 4–10 and 20% across 11–20, contract division order", () => {
    for (let i = 3; i < 10; i++) expect(shareForWei(i, pool)).toBe((pool * 30n) / 100n / 7n);
    for (let i = 10; i < 20; i++) expect(shareForWei(i, pool)).toBe(200n * CHZ);
  });

  it("display percentages sum to the whole pool", () => {
    const { first, second, third, ranks4to10, ranks11to20 } = PAYOUT_SPLIT;
    expect(first + second + third + ranks4to10 + ranks11to20).toBe(100);
    expect(PAYOUT_TOP_N).toBe(20);
  });

  it.each([
    ["a round pool", 10_000n * CHZ],
    ["a pool with a knockout-only crowd", 25_500n * CHZ],
    ["one wei", 1n],
    ["an awkward wei amount", 7_777_777n],
  ])("distributes exactly the pool — %s", (_label, p) => {
    const out = projectedPayouts(p, 20);
    expect(out).toHaveLength(20);
    expect(sum(out)).toBe(p);
  });

  it("sends the rounding dust to 1st place", () => {
    const dusty = pool + 1n;
    const out = projectedPayouts(dusty, 20);
    const shares = Array.from({ length: 20 }, (_, i) => shareForWei(i, dusty));
    expect(out[0]! - shares[0]!).toBe(dusty - sum(shares));
    expect(out.slice(1)).toEqual(shares.slice(1));
  });

  it("below 20 entrants pays the ranks that exist and hands the rest to 1st (no renormalising)", () => {
    const out = projectedPayouts(pool, 15);
    expect(out).toHaveLength(15);
    expect(sum(out)).toBe(pool);
    const unpaid = 5n * shareForWei(19, pool);
    const dust = pool - sum(Array.from({ length: 20 }, (_, i) => shareForWei(i, pool)));
    expect(out[0]).toBe(shareForWei(0, pool) + unpaid + dust);
  });

  it("caps the pay count at 20 and returns nothing for an empty stage", () => {
    expect(projectedPayouts(pool, 50)).toHaveLength(20);
    expect(projectedPayouts(pool, 0)).toEqual([]);
  });
});
