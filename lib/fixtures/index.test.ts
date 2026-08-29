import { describe, expect, it } from "vitest";
import { FIXTURES, makeFixtureLookup, type FixturesDoc } from "./index";

const doc: FixturesDoc = {
  source: "test",
  teams: {
    RMA: { name: "Real Madrid", code: "RMA", uefaId: "50051", crest: "https://img.uefa.com/imgml/TP/teams/logos/240x240/50051.png" },
    LAS: { name: "LASK", code: "LAS", uefaId: "63405", uefaCode: "LASK" },
  },
  matches: [
    {
      matchId: 1,
      phase: 0,
      teamA: "RMA",
      teamB: "LAS",
      kickoffTime: 1_788_885_900,
      group: "League",
      matchday: 1,
      knockout: false,
      uefaMatchId: "2050001",
      tieId: null,
      legNumber: null,
    },
  ],
};

describe("fixture lookup", () => {
  const f = makeFixtureLookup(doc);

  it("resolves club names and falls back to the code", () => {
    expect(f.teamName("RMA")).toBe("Real Madrid");
    expect(f.teamName("LAS")).toBe("LASK");
    expect(f.teamName("XYZ")).toBe("XYZ");
  });

  it("resolves crests: feed URL, else the documented img.uefa.com pattern, null when unknown", () => {
    expect(f.teamCrest("RMA")).toBe("https://img.uefa.com/imgml/TP/teams/logos/240x240/50051.png");
    expect(f.teamCrest("LAS")).toBe("https://img.uefa.com/imgml/TP/teams/logos/240x240/63405.png"); // no crest field → pattern
    expect(f.teamCrest("XYZ")).toBeNull();
  });

  it("only trusts a bundled entry when the chain agrees on both team codes", () => {
    expect(f.bundledMatch(1, "RMA", "LAS")?.uefaMatchId).toBe("2050001");
    expect(f.bundledMatch(1, "LAS", "RMA")).toBeNull(); // orientation differs → chain wins
    expect(f.bundledMatch(1, "RMA", "MCI")).toBeNull();
    expect(f.bundledMatch(2, "RMA", "LAS")).toBeNull();
  });

  it("enriches a slate row with names, matchday and uefaMatchId", () => {
    const base = { id: 1, kickoff: 1_788_885_900, completed: false, teamA: "RMA", teamB: "LAS", stage: 0 };
    expect(f.enrichSlate(base)).toEqual({
      ...base,
      nameA: "Real Madrid",
      nameB: "LASK",
      crestA: "https://img.uefa.com/imgml/TP/teams/logos/240x240/50051.png",
      crestB: "https://img.uefa.com/imgml/TP/teams/logos/240x240/63405.png",
      matchday: 1,
      uefaMatchId: "2050001",
    });
    // unknown on-chain match: names fall back to codes, no matchday, no insight key
    const other = { ...base, id: 9, teamA: "AAA", teamB: "BBB" };
    expect(f.enrichSlate(other)).toEqual({ ...other, nameA: "AAA", nameB: "BBB", crestA: null, crestB: null, matchday: null, uefaMatchId: null });
  });

  it("the shipped bundle has the generator shape", () => {
    expect(typeof FIXTURES.teams).toBe("object");
    expect(Array.isArray(FIXTURES.matches)).toBe(true);
    for (const m of FIXTURES.matches) {
      expect(m.teamA).toMatch(/^[A-Z0-9]{3}$/);
      expect(m.teamB).toMatch(/^[A-Z0-9]{3}$/);
      expect(FIXTURES.teams[m.teamA]).toBeDefined();
      expect(FIXTURES.teams[m.teamB]).toBeDefined();
    }
  });
});
