import { describe, expect, it } from "vitest";
import { compareRows, flagEmoji, pointsFor, rowsForView, type StandingRow } from "./standings";

const row = (over: Partial<StandingRow>): StandingRow => ({
  address: "0x00000000000000000000000000000000000000aa",
  fullSeason: true,
  leaguePoints: 0n,
  knockoutPoints: 0n,
  exactCount: 0n,
  enteredAt: 100n,
  ...over,
});

describe("tie-break chain (PRD §5.3)", () => {
  it("points beat everything", () => {
    const a = row({ knockoutPoints: 10n, exactCount: 0n });
    const b = row({ knockoutPoints: 9n, exactCount: 99n });
    expect([a, b].sort(compareRows("knockout"))[0]).toBe(a);
  });

  it("equal points → most exact scores wins", () => {
    const a = row({ knockoutPoints: 10n, exactCount: 2n });
    const b = row({ knockoutPoints: 10n, exactCount: 1n });
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
