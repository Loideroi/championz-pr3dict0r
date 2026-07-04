import { describe, expect, it } from "vitest";
import { FLAG_SUBMITTED, packPrediction, unpackPrediction } from "./packed";

describe("packed prediction codec (mirrors ChampionzPredictor.sol)", () => {
  it("round-trips scores with the submitted flag", () => {
    const packed = packPrediction(2, 1);
    expect(packed & FLAG_SUBMITTED).not.toBe(0n);
    expect(unpackPrediction(packed)).toEqual({ scoreA: 2, scoreB: 1, submitted: true });
  });

  it("matches the contract's bit layout exactly", () => {
    // 0-0 must still carry the submitted flag (distinguishes from empty slot)
    expect(packPrediction(0, 0)).toBe(1n << 20n);
    expect(packPrediction(3, 7)).toBe(3n | (7n << 8n) | (1n << 20n));
  });

  it("rejects out-of-range scores like the contract does", () => {
    expect(() => packPrediction(16, 0)).toThrow(RangeError);
    expect(() => packPrediction(-1, 0)).toThrow(RangeError);
    expect(() => packPrediction(1.5, 0)).toThrow(RangeError);
  });

  it("reports an empty slot as not submitted", () => {
    expect(unpackPrediction(0n).submitted).toBe(false);
  });
});
