import { describe, expect, it } from "vitest";
import { ENTRY, PREDICTION_LOCKOUT_SECONDS, STAGE_FLOOR, formatChz } from "./economics";

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
  });

  it("formats CHZ with pinned en-US locale", () => {
    expect(formatChz(1100)).toBe("1,100");
  });
});
