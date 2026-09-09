import { describe, expect, it } from "vitest";
import {
  alertSeverity,
  alertType,
  formatAge,
  formatUtc,
  gasStatus,
  governanceCheck,
  groupAlerts,
  implementationFromSlot,
  ORACLE_GAS_FLOOR_CHZ,
  RUN_STALE_AFTER_MS,
  solvencyStatus,
  stageNeedsFreeze,
  summarizeRun,
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
      oracle: "0xb57cb421e3b707d0970ec758d40a4366db317b15",
      implementation: "0x09fec2ea6f5a1eea5171cb0ffbc65dcf76ed72f6",
    });
    expect(ok).toEqual({ oracleOk: true, implementationOk: true });
    const drift = governanceCheck(88888, { oracle: "0x0000000000000000000000000000000000000001", implementation: null });
    expect(drift).toEqual({ oracleOk: false, implementationOk: null });
  });

  it("has no opinion on an unknown chain", () => {
    expect(governanceCheck(1, { oracle: "0x1" })).toEqual({ oracleOk: null, implementationOk: null });
  });
});

describe("stageNeedsFreeze — mirrors sentinels.ts checkUnfrozenStage", () => {
  it("fires only when every playable match is completed and the stage is not frozen", () => {
    expect(stageNeedsFreeze({ frozen: false, total: 144, completed: 144, voided: 0 })).toBe(true);
    expect(stageNeedsFreeze({ frozen: false, total: 144, completed: 143, voided: 1 })).toBe(true);
    expect(stageNeedsFreeze({ frozen: false, total: 144, completed: 143, voided: 0 })).toBe(false);
    expect(stageNeedsFreeze({ frozen: true, total: 144, completed: 144, voided: 0 })).toBe(false);
    expect(stageNeedsFreeze({ frozen: false, total: 0, completed: 0, voided: 0 })).toBe(false);
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
