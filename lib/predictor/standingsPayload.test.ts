import { describe, expect, it } from "vitest";
import { fromRowJson, parseStandingsPayload, toRowJson } from "./standingsPayload";
import { rowsForView, type StandingRow } from "./standings";

const row = (over: Partial<StandingRow> = {}): StandingRow => ({
  address: "0x1111111111111111111111111111111111111111",
  fullSeason: true,
  leaguePoints: 12n,
  knockoutPoints: 3n,
  exactCount: 2n,
  enteredAt: 1_750_000_000n,
  ...over,
});

describe("standings wire format", () => {
  it("round-trips a row through JSON without losing bigint precision", () => {
    const original = row({
      username: "Rikkert",
      countryCode: "NL",
      leaguePoints: 9_007_199_254_740_993n, // > Number.MAX_SAFE_INTEGER
    });
    const back = fromRowJson(JSON.parse(JSON.stringify(toRowJson(original))));
    expect(back).toEqual(original);
  });

  it("keeps a knockout-only wallet's league points null, not zero", () => {
    // null renders "—"; 0 would claim the wallet played Stage 1 and scored nothing.
    const back = fromRowJson(toRowJson(row({ fullSeason: false, leaguePoints: null })));
    expect(back?.leaguePoints).toBeNull();
  });

  it("omits absent profile fields rather than serialising undefined", () => {
    expect(toRowJson(row())).not.toHaveProperty("username");
    expect(toRowJson(row())).not.toHaveProperty("countryCode");
  });

  it.each([
    ["a non-address", { ...toRowJson(row()), address: "nope" }],
    ["a negative points value", { ...toRowJson(row()), knockoutPoints: "-1" }],
    ["a float points value", { ...toRowJson(row()), knockoutPoints: "1.5" }],
    ["a missing flag", { ...toRowJson(row()), fullSeason: undefined }],
    ["a non-object", "0x1234"],
  ])("rejects %s", (_label, bad) => {
    expect(fromRowJson(bad)).toBeNull();
  });

  it("drops only the malformed rows, keeping the rest of the board", () => {
    const good = toRowJson(row());
    const parsed = parseStandingsPayload({
      rows: [good, { ...good, address: "0xnope" }, { ...good, address: "0x2222222222222222222222222222222222222222" }],
      hasProvisional: true,
      matchCount: 144,
      updatedAt: "2026-08-29T12:00:00.000Z",
    });
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.hasProvisional).toBe(true);
    expect(parsed.matchCount).toBe(144);
  });

  it("degrades to an empty board for a body that is not a payload", () => {
    expect(parseStandingsPayload(null).rows).toEqual([]);
    expect(parseStandingsPayload({ error: "502" }).hasProvisional).toBe(false);
  });

  it("survives the §5.3 sort after a round trip (the ordering the board renders)", () => {
    const wire = [
      toRowJson(row({ address: "0x3333333333333333333333333333333333333333", leaguePoints: 5n, knockoutPoints: 0n })),
      toRowJson(row({ address: "0x1111111111111111111111111111111111111111", leaguePoints: 9n, knockoutPoints: 0n })),
      toRowJson(row({ address: "0x2222222222222222222222222222222222222222", leaguePoints: 9n, knockoutPoints: 0n, exactCount: 5n })),
    ];
    const sorted = rowsForView(parseStandingsPayload({ rows: wire }).rows, "league");
    expect(sorted.map((r) => r.address.slice(0, 4))).toEqual(["0x22", "0x11", "0x33"]);
  });
});
