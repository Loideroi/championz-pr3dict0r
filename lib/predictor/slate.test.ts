import { describe, expect, it } from "vitest";
import { PREDICTION_LOCKOUT_SECONDS } from "../economics";
import { FLAG_SUBMITTED } from "./packed";
import {
  diffSlate,
  formatCountdown,
  formatKickoffDay,
  formatUtcTime,
  groupSlate,
  kickoffDayKey,
  lockAt,
  matchPhase,
  samePick,
  toBatchArgs,
  type ScorePick,
  type SlateMatch,
} from "./slate";

const T0 = 1_790_000_000; // 2026-09-21T09:33:20Z — arbitrary fixed epoch
const match = (over: Partial<SlateMatch>): SlateMatch => ({
  id: 1,
  kickoff: T0 + 86_400,
  completed: false,
  teamA: "RMA",
  teamB: "MCI",
  stage: 0,
  ...over,
});

describe("lockAt / matchPhase", () => {
  it("locks exactly PREDICTION_LOCKOUT_SECONDS before kickoff", () => {
    const m = match({});
    expect(lockAt(m)).toBe(m.kickoff - PREDICTION_LOCKOUT_SECONDS);
  });

  it("is open strictly before T-60, locked from T-60, completed when resulted", () => {
    const m = match({});
    expect(matchPhase(m, lockAt(m) - 1)).toBe("open");
    expect(matchPhase(m, lockAt(m))).toBe("locked"); // contract: >= is locked
    expect(matchPhase(m, m.kickoff + 1)).toBe("locked");
    expect(matchPhase({ ...m, completed: true }, T0)).toBe("completed");
  });
});

describe("groupSlate", () => {
  it("groups by stage then UTC kickoff day, ordered by stage then time", () => {
    const day1 = Date.UTC(2027, 0, 20, 20) / 1000; // 2027-01-20 20:00 UTC
    const day1late = Date.UTC(2027, 0, 20, 21) / 1000;
    const day2 = Date.UTC(2027, 0, 21, 18) / 1000;
    const slate = [
      match({ id: 4, kickoff: day2, stage: 1, teamA: "ARS", teamB: "INT" }),
      match({ id: 2, kickoff: day1late, stage: 0, teamA: "LIV", teamB: "BAY" }),
      match({ id: 1, kickoff: day1, stage: 0 }),
      match({ id: 3, kickoff: day1, stage: 1, teamA: "BAR", teamB: "PSG" }),
    ];
    const groups = groupSlate(slate);
    expect(groups.map((g) => [g.stage, g.dayKey])).toEqual([
      [0, "2027-01-20"],
      [1, "2027-01-20"],
      [1, "2027-01-21"],
    ]);
    // inside a group: kickoff order, then id
    expect(groups[0].matches.map((m) => m.id)).toEqual([1, 2]);
    expect(groups[0].dayLabel).toBe(formatKickoffDay(day1));
  });

  it("day bucketing is UTC-deterministic", () => {
    expect(kickoffDayKey(Date.UTC(2027, 4, 29, 23, 59) / 1000)).toBe("2027-05-29");
    expect(kickoffDayKey(Date.UTC(2027, 4, 30, 0, 1) / 1000)).toBe("2027-05-30");
  });
});

describe("formatting (SSR-safe, pinned en-US + UTC)", () => {
  it("formats the lock countdown like the PRD copy", () => {
    expect(formatCountdown(2 * 3600 + 14 * 60)).toBe("2h 14m");
    expect(formatCountdown(3 * 86_400 + 4 * 3600)).toBe("3d 4h");
    expect(formatCountdown(14 * 60 + 3)).toBe("14m 3s");
    expect(formatCountdown(-5)).toBe("0m 0s"); // clamps, never negative
  });

  it("formats UTC times and days deterministically", () => {
    const ts = Date.UTC(2027, 0, 20, 20, 0) / 1000;
    expect(formatUtcTime(ts)).toBe("20:00 UTC");
    expect(formatKickoffDay(ts)).toBe("Wed, Jan 20");
  });
});

describe("diffSlate / toBatchArgs", () => {
  const picks = (entries: [number, ScorePick][]) => new Map(entries);

  it("keeps new picks, keeps real edits, drops no-op drafts", () => {
    const drafts = picks([
      [1, { scoreA: 2, scoreB: 1 }], // new (no on-chain pick)
      [2, { scoreA: 0, scoreB: 0 }], // identical to chain → dropped
      [3, { scoreA: 1, scoreB: 3 }], // edit of an existing pick
    ]);
    const onchain = picks([
      [2, { scoreA: 0, scoreB: 0 }],
      [3, { scoreA: 1, scoreB: 1 }],
    ]);
    expect(diffSlate(drafts, onchain)).toEqual([
      { matchId: 1, old: null, next: { scoreA: 2, scoreB: 1 } },
      { matchId: 3, old: { scoreA: 1, scoreB: 1 }, next: { scoreA: 1, scoreB: 3 } },
    ]);
  });

  it("returns an empty diff when nothing is staged", () => {
    expect(diffSlate(picks([]), picks([[1, { scoreA: 1, scoreB: 0 }]]))).toEqual([]);
  });

  it("packs aligned arrays for submitPredictions(uint16[],uint256[])", () => {
    const { matchIds, packeds } = toBatchArgs([
      { matchId: 7, old: null, next: { scoreA: 2, scoreB: 1 } },
      { matchId: 9, old: { scoreA: 0, scoreB: 0 }, next: { scoreA: 0, scoreB: 3 } },
    ]);
    expect(matchIds).toEqual([7, 9]);
    expect(packeds).toEqual([
      2n | (1n << 8n) | FLAG_SUBMITTED,
      0n | (3n << 8n) | FLAG_SUBMITTED,
    ]);
  });

  it("samePick treats null as 'no pick', not 0-0", () => {
    expect(samePick(null, { scoreA: 0, scoreB: 0 })).toBe(false);
    expect(samePick(null, null)).toBe(true);
    expect(samePick({ scoreA: 1, scoreB: 2 }, { scoreA: 1, scoreB: 2 })).toBe(true);
  });
});
