import { describe, expect, it } from "vitest";
import {
  alertSeverity,
  alertType,
  formatAge,
  formatUtc,
  freezeBlocker,
  freezeCallable,
  gasStatus,
  governanceCheck,
  governanceDrifted,
  groupAlerts,
  implementationFromSlot,
  lockCallable,
  lockHint,
  ORACLE_GAS_FLOOR_CHZ,
  RUN_STALE_AFTER_MS,
  solvencyStatus,
  STAGE_STATUS,
  stageNeedsFreeze,
  summarizeRun,
  watcherAlive,
  WATCHER_STALE_AFTER_MS,
  type OracleLogRow,
} from "./health";

const CHZ = 10n ** 18n;
const NOW = Date.parse("2026-09-09T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const row = (over: Partial<OracleLogRow>): OracleLogRow => ({
  kind: "alert",
  chain_id: 88888,
  match_id: null,
  created_at: ago(60_000),
  detail: null,
  ...over,
});

describe("gasStatus — mirrors relayer balance.ts", () => {
  it("flags a balance under the 20 CHZ floor exactly like the bot", () => {
    expect(gasStatus(19_999n * CHZ / 1000n).low).toBe(true);
    expect(gasStatus(20n * CHZ).low).toBe(false);
    expect(ORACLE_GAS_FLOOR_CHZ).toBe(20);
  });

  it("keeps milli-CHZ precision and estimates pushes left", () => {
    const s = gasStatus(88_123_456_789_012_345_678n);
    expect(s.chz).toBe(88.123);
    expect(s.pushesLeft).toBe(352);
  });
});

describe("solvencyStatus — mirrors sentinels.ts checkSolvency", () => {
  const stages = [
    { pool: 21_500n * CHZ, feeEscrow: 2_150n * CHZ, frozen: false },
    { pool: 21_500n * CHZ, feeEscrow: 2_150n * CHZ, frozen: false },
  ];

  it("is solvent when the balance covers every unfrozen pool plus escrow", () => {
    const s = solvencyStatus(47_300n * CHZ, stages);
    expect(s.ok).toBe(true);
    expect(s.owedWei).toBe(47_300n * CHZ);
    expect(s.surplusWei).toBe(0n);
  });

  it("stops counting a stage once it is frozen", () => {
    const s = solvencyStatus(23_650n * CHZ, [stages[0]!, { ...stages[1]!, frozen: true }]);
    expect(s.ok).toBe(true);
  });

  it("reports the breach the bot would call an exploit", () => {
    const s = solvencyStatus(1n * CHZ, stages);
    expect(s.ok).toBe(false);
    expect(s.surplusWei).toBeLessThan(0n);
  });
});

describe("governance", () => {
  it("decodes the EIP-1967 slot into the implementation address", () => {
    const slot = "0x00000000000000000000000009fec2ea6f5a1eea5171cb0ffbc65dcf76ed72f6";
    expect(implementationFromSlot(slot)).toBe("0x09fec2ea6f5a1eea5171cb0ffbc65dcf76ed72f6");
    expect(implementationFromSlot("0x")).toBeNull();
    expect(implementationFromSlot(null)).toBeNull();
    expect(implementationFromSlot("0x0")).toBeNull();
  });

  it("compares case-insensitively against the sentinel's expected values", () => {
    const ok = governanceCheck(88888, {
      owner: "0x47103b0fc04c91ac388eae3c4f91d038cbfd9cf8",
      oracle: "0xb57cb421e3b707d0970ec758d40a4366db317b15",
      implementation: "0x09fec2ea6f5a1eea5171cb0ffbc65dcf76ed72f6",
    });
    expect(ok).toEqual({ ownerOk: true, oracleOk: true, implementationOk: true });
    expect(governanceDrifted(ok)).toBe(false);
    const drift = governanceCheck(88888, { oracle: "0x0000000000000000000000000000000000000001", implementation: null });
    expect(drift).toEqual({ ownerOk: null, oracleOk: false, implementationOk: null });
    expect(governanceDrifted(drift)).toBe(true);
    // the bot checks owner() too — a silent owner rotation must mark the line
    expect(governanceDrifted(governanceCheck(88888, { owner: "0x0000000000000000000000000000000000000002" }))).toBe(true);
  });

  it("has no opinion on an unknown chain", () => {
    expect(governanceCheck(1, { oracle: "0x1" })).toEqual({ ownerOk: null, oracleOk: null, implementationOk: null });
  });
});

describe("stageNeedsFreeze — mirrors sentinels.ts checkUnfrozenStage", () => {
  it("fires only when every playable match is completed and the stage is not frozen", () => {
    expect(stageNeedsFreeze({ frozen: false, total: 144, completed: 144, voided: 0, provisional: 0 })).toBe(true);
    expect(stageNeedsFreeze({ frozen: false, total: 144, completed: 143, voided: 1, provisional: 0 })).toBe(true);
    expect(stageNeedsFreeze({ frozen: false, total: 144, completed: 143, voided: 0, provisional: 0 })).toBe(false);
    expect(stageNeedsFreeze({ frozen: true, total: 144, completed: 144, voided: 0, provisional: 0 })).toBe(false);
    expect(stageNeedsFreeze({ frozen: false, total: 0, completed: 0, voided: 0, provisional: 0 })).toBe(false);
  });
});

describe("summarizeRun", () => {
  it("reads the relay.mjs run row shape", () => {
    const s = summarizeRun(
      row({
        kind: "run",
        created_at: ago(5 * 60_000),
        detail: {
          source: "uefa-api@1.0.2",
          pushed: [3, 4],
          corrected: [],
          skipped: 142,
          errors: [{ matchId: 5, error: "boom" }],
          alerts: ["RELAY_ERRORS"],
          runner: "watcher",
          tick: 12,
        },
      }),
      NOW,
    );
    expect(s.pushed).toBe(2);
    expect(s.skipped).toBe(142);
    expect(s.errors).toHaveLength(1);
    expect(s.troubled).toBe(true);
    expect(s.stale).toBe(false);
    expect(s.runner).toBe("watcher");
    expect(s.tick).toBe(12);
  });

  it("is stale past six hours and tolerant of a missing detail", () => {
    const s = summarizeRun(row({ kind: "run", created_at: ago(RUN_STALE_AFTER_MS + 1), detail: null }), NOW);
    expect(s.stale).toBe(true);
    expect(s.troubled).toBe(false);
    expect(s.source).toBe("unknown");
    expect(s.runner).toBeNull();
  });
});

describe("alerts", () => {
  it("reads both detail shapes the bot writes", () => {
    expect(alertType(row({ detail: { type: "low_balance" } }))).toBe("low_balance");
    expect(alertType(row({ detail: { kind: "SOURCE_STALE", summary: "1 overdue" } }))).toBe("SOURCE_STALE");
    expect(alertType(row({ detail: null }))).toBe("unknown");
  });

  it("ranks severity like the bot's urgency", () => {
    expect(alertSeverity("governance_drift")).toBe("critical");
    expect(alertSeverity("site_down_homepage")).toBe("critical");
    expect(alertSeverity("low_balance")).toBe("warn");
    expect(alertSeverity("t75_reminder")).toBe("info");
  });

  it("groups the last 24h by type, critical first, newest first within a tier", () => {
    const rows: OracleLogRow[] = [
      row({ match_id: 7, created_at: ago(3 * 3600_000), detail: { type: "t75_reminder" } }),
      row({ match_id: 8, created_at: ago(2 * 3600_000), detail: { type: "t75_reminder" } }),
      row({ created_at: ago(30 * 3600_000), detail: { type: "low_balance" } }), // outside window
      row({ created_at: ago(10 * 60_000), detail: { kind: "SOURCE_STALE", summary: "2 overdue" } }),
      row({ created_at: ago(20 * 60_000), detail: { type: "insolvency", headline: "SOLVENCY_BREACH" } }),
      row({ kind: "run", created_at: ago(1000), detail: { alerts: ["ignored"] } }),
    ];
    const groups = groupAlerts(rows, NOW);
    expect(groups.map((g) => g.type)).toEqual(["insolvency", "SOURCE_STALE", "t75_reminder"]);
    expect(groups[2]).toMatchObject({ count: 2, matchIds: [7, 8], severity: "info" });
    expect(groups[0]?.latestText).toBe("SOLVENCY_BREACH");
    expect(groups[1]?.latestText).toBe("2 overdue");
  });
});

describe("formatting", () => {
  it("formats ages", () => {
    expect(formatAge(10_000)).toBe("just now");
    expect(formatAge(4 * 60_000)).toBe("4m ago");
    expect(formatAge(2 * 3600_000 + 15 * 60_000)).toBe("2h 15m ago");
    expect(formatAge(3 * 3600_000)).toBe("3h ago");
    expect(formatAge(3 * 86_400_000)).toBe("3d ago");
  });

  it("pins timestamps to UTC", () => {
    expect(formatUtc("2026-09-09T20:14:00Z")).toBe("09 Sep 20:14");
    expect(formatUtc("garbage")).toBe("garbage");
  });
});

describe("stage lifecycle — mirrors lockStage / freezeStage guards", () => {
  const CHZ = 10n ** 18n;
  const closeAt = Math.floor(Date.parse("2026-09-08T16:45:00Z") / 1000);
  const selling = { closeAt, status: STAGE_STATUS.SELLING, entryCount: 90, feeEscrow: 4_500n * CHZ };

  it("lockStage is callable only once the window closed and the stage still sells", () => {
    expect(lockCallable(selling, closeAt - 1)).toBe(false);
    expect(lockCallable(selling, closeAt)).toBe(true);
    expect(lockCallable({ ...selling, status: STAGE_STATUS.LOCKED }, closeAt + 1)).toBe(false);
    expect(lockCallable({ ...selling, status: STAGE_STATUS.VOID }, closeAt + 1)).toBe(false);
  });

  it("spells out the fee forward above the floor", () => {
    expect(lockHint(selling, closeAt + 60)).toBe(
      "Window closed, 90 entrants: lockStage forwards 4,500 CHZ fees to the fee recipient",
    );
    expect(lockHint(selling, closeAt - 60)).toBeNull();
  });

  it("warns that the same call voids the stage below the floor", () => {
    const hint = lockHint({ ...selling, entryCount: 19, feeEscrow: 950n * CHZ }, closeAt + 60);
    expect(hint).toContain("19 entrants");
    expect(hint).toContain("VOIDS");
  });

  it("freezeStage needs LOCKED plus every playable match completed", () => {
    const played = { frozen: false, total: 144, completed: 144, voided: 0, provisional: 0 };
    expect(freezeCallable(STAGE_STATUS.LOCKED, played)).toBe(true);
    expect(freezeCallable(STAGE_STATUS.SELLING, played)).toBe(false);
    expect(freezeCallable(STAGE_STATUS.LOCKED, { ...played, completed: 143 })).toBe(false);
    expect(freezeCallable(STAGE_STATUS.LOCKED, { ...played, frozen: true })).toBe(false);
  });

  it("explains why freeze is greyed out", () => {
    const played = { frozen: false, total: 144, completed: 144, voided: 0, provisional: 0 };
    expect(freezeBlocker(undefined, played)).toBe("reading stage");
    expect(freezeBlocker(STAGE_STATUS.SELLING, played)).toContain("LOCKED first");
    expect(freezeBlocker(STAGE_STATUS.LOCKED, { ...played, frozen: true })).toBe("already frozen");
    expect(freezeBlocker(STAGE_STATUS.LOCKED, { ...played, completed: 140 })).toContain("COMPLETED");
    expect(freezeBlocker(STAGE_STATUS.LOCKED, { ...played, provisional: 3 })).toContain("3 result(s)");
  });

  it("re-exports the contract enums from their existing homes, not copies", async () => {
    const { STAGE_STATUS: canonical } = await import("../predictor/standingsPayload");
    expect(STAGE_STATUS).toBe(canonical);
  });
});

describe("watcherAlive — newest watcher-tagged run on the tick-scale clock", () => {
  const run = (runner: string, ageMs: number, tick?: number): OracleLogRow =>
    row({ kind: "run", created_at: ago(ageMs), detail: { runner, ...(tick ? { tick } : {}) } });

  it("ignores a newer cron or dispatch run and keeps the live watcher", () => {
    const rows = [run("cron", 60_000), run("dispatch", 120_000), run("watcher", 4 * 60_000, 12)];
    const w = watcherAlive(rows, NOW);
    expect(w.alive).toBe(true);
    expect(w.run?.tick).toBe(12);
  });

  it("calls a watcher dead after three missed ticks even when a fresh cron run exists", () => {
    const rows = [run("cron", 60_000), run("watcher", WATCHER_STALE_AFTER_MS + 1, 64)];
    const w = watcherAlive(rows, NOW);
    expect(w.alive).toBe(false);
    expect(w.run?.tick).toBe(64);
    expect(WATCHER_STALE_AFTER_MS).toBe(15 * 60 * 1000);
  });

  it("reports no watcher at all when none is tagged", () => {
    expect(watcherAlive([run("cron", 1000)], NOW)).toEqual({ run: null, alive: false });
  });

  it("does not mistake yesterday's watcher for today's, and tolerates unsorted rows", () => {
    const rows = [run("watcher", 20 * 3600_000, 64), run("watcher", 22 * 3600_000, 63)];
    expect(watcherAlive(rows, NOW).run?.tick).toBe(64);
    expect(watcherAlive(rows, NOW, NOW - 3600_000)).toEqual({ run: null, alive: false });
    expect(watcherAlive([...rows].reverse(), NOW).run?.tick).toBe(64);
  });
});
