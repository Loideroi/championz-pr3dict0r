import { describe, expect, it } from "vitest";
import {
  compareRows,
  exactFor,
  flagEmoji,
  isSelfRow,
  pointsFor,
  rowsForView,
  type StandingRow,
} from "./standings";

const row = (over: Partial<StandingRow>): StandingRow => ({
  address: "0x00000000000000000000000000000000000000aa",
  fullSeason: true,
  leaguePoints: 0n,
  knockoutPoints: 0n,
  leagueExact: 0n,
  knockoutExact: 0n,
  enteredAt: 100n,
  ...over,
});

describe("tie-break chain (PRD §5.3)", () => {
  it("points beat everything", () => {
    const a = row({ knockoutPoints: 10n, knockoutExact: 0n });
    const b = row({ knockoutPoints: 9n, knockoutExact: 99n });
    expect([a, b].sort(compareRows("knockout"))[0]).toBe(a);
  });

  it("equal points → most exact scores wins", () => {
    const a = row({ knockoutPoints: 10n, knockoutExact: 2n });
    const b = row({ knockoutPoints: 10n, knockoutExact: 1n });
    expect([b, a].sort(compareRows("knockout"))[0]).toBe(a);
  });

  it("equal exacts → earliest entry wins", () => {
    const a = row({ enteredAt: 50n });
    const b = row({ enteredAt: 60n });
    expect([b, a].sort(compareRows("knockout"))[0]).toBe(a);
  });

  it("full tie → lowest wallet address (because computers enjoy order)", () => {
    const a = row({ address: "0x00000000000000000000000000000000000000aa" });
    const b = row({ address: "0x00000000000000000000000000000000000000bb" });
    expect([b, a].sort(compareRows("knockout"))[0]).toBe(a);
  });
});

describe("tie-break #2 is scoped to the stage, exactly like the contract", () => {
  // ChampionzPredictor._applyRanking breaks a tie on _score(stage, wallet),
  // which counts that stage's exacts only. A board that summed both stages
  // would show an order freezeStage rejects — "I was 20th but got nothing".
  it("ignores league exacts when ordering the knockout board", () => {
    const seasonLong = row({
      address: "0x00000000000000000000000000000000000000aa",
      knockoutPoints: 10n,
      leagueExact: 40n, // a whole league phase of exact scores
      knockoutExact: 1n,
    });
    const latecomer = row({
      address: "0x00000000000000000000000000000000000000bb",
      knockoutPoints: 10n,
      leagueExact: 0n,
      knockoutExact: 2n, // better where it counts
    });
    expect([seasonLong, latecomer].sort(compareRows("knockout"))[0]).toBe(latecomer);
    // ...and the league board reads the other column, undisturbed
    expect([latecomer, seasonLong].sort(compareRows("league"))[0]).toBe(seasonLong);
  });

  it("Season View sums both, since its points column does too", () => {
    const r = row({ leagueExact: 3n, knockoutExact: 4n });
    expect(exactFor(r, "league")).toBe(3n);
    expect(exactFor(r, "knockout")).toBe(4n);
    expect(exactFor(r, "season")).toBe(7n);
  });
});

describe("views", () => {
  it("league board lists Full Season wallets only", () => {
    const early = row({ fullSeason: true });
    const late = row({ fullSeason: false, leaguePoints: null, address: "0x00000000000000000000000000000000000000bb" });
    expect(rowsForView([early, late], "league")).toEqual([early]);
    expect(rowsForView([early, late], "knockout")).toHaveLength(2);
  });

  it("Season View combines stages; knockout-only league column stays null (renders —)", () => {
    const late = row({ fullSeason: false, leaguePoints: null, knockoutPoints: 7n });
    expect(pointsFor(late, "season")).toBe(7n);
    expect(pointsFor(late, "league")).toBeNull();
  });
});

describe("flagEmoji", () => {
  it("renders NL and rejects junk", () => {
    expect(flagEmoji("NL")).toBe("🇳🇱");
    expect(flagEmoji("nl")).toBe("🇳🇱");
    expect(flagEmoji("XYZ")).toBe("");
    expect(flagEmoji(undefined)).toBe("");
  });
});

describe("isSelfRow", () => {
  const lower = "0x742c6957f3a1b2c4d5e6f708192a3b4c5d6e7f80";
  const checksummed = "0x742C6957f3A1B2c4d5E6F708192a3B4c5d6e7F80";

  it("matches the board's lowercase address against a checksummed wallet", () => {
    expect(isSelfRow(lower, checksummed)).toBe(true);
    expect(isSelfRow(lower, lower)).toBe(true);
    expect(isSelfRow(checksummed, lower)).toBe(true);
  });

  it("is false for another wallet, and whenever none is connected", () => {
    expect(isSelfRow(lower, "0x0000000000000000000000000000000000000001")).toBe(false);
    expect(isSelfRow(lower, undefined)).toBe(false);
    expect(isSelfRow(lower, "")).toBe(false);
  });
});
