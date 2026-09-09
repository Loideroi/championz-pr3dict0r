import { describe, expect, it } from "vitest";
import type { OracleLogRow } from "./health";
import {
  coverageStatus,
  explorerTxUrl,
  isOverdue,
  matchdayKickoffs,
  matchdaySpan,
  matchPipelines,
  OVERDUE_AFTER_SECONDS,
  pushLatencyMinutes,
} from "./pipeline";

const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const iso = (s: number) => new Date(s * 1000).toISOString();

const row = (over: Partial<OracleLogRow>): OracleLogRow => ({
  kind: "result_push",
  chain_id: 88888,
  match_id: 1,
  tx_hash: null,
  created_at: "2026-09-08T18:52:00Z",
  detail: null,
  ...over,
});

describe("matchPipelines", () => {
  it("folds pushes, corrections and reminders per match, oldest first", () => {
    const rows: OracleLogRow[] = [
      row({ kind: "correction", created_at: "2026-09-09T10:00:00Z", tx_hash: "0xc2" }),
      row({ kind: "alert", created_at: "2026-09-08T15:20:00Z", detail: { type: "t75_reminder" } }),
      row({ kind: "result_push", created_at: "2026-09-08T18:52:00Z", tx_hash: "0xp1" }),
      row({ kind: "alert", created_at: "2026-09-08T12:00:00Z", detail: { type: "heads_up" } }),
      row({ kind: "correction", created_at: "2026-09-08T20:00:00Z", tx_hash: "0xc1" }),
      row({ kind: "result_push", created_at: "2026-09-08T19:00:00Z", tx_hash: "0xdup" }), // replay
      row({ kind: "alert", match_id: null, detail: { type: "low_balance" } }), // no match → ignored
      row({ kind: "alert", match_id: 2, detail: { kind: "RELAY_ERRORS" } }), // not a reminder
    ];
    const p = matchPipelines(rows);
    expect(p.get(1)).toEqual({
      pushedAt: "2026-09-08T18:52:00Z",
      pushTx: "0xp1",
      correctedAt: "2026-09-09T10:00:00Z",
      correctionTx: "0xc2",
      corrections: 2,
      reminders: ["heads_up", "t75_reminder"],
    });
    expect(p.get(2)?.reminders).toEqual([]);
    expect(p.get(2)?.pushedAt).toBeNull();
  });
});

describe("push latency and staleness", () => {
  it("measures minutes from kickoff to the push row", () => {
    expect(pushLatencyMinutes(at("2026-09-08T16:45:00Z"), "2026-09-08T18:37:00Z")).toBe(112);
    expect(pushLatencyMinutes(0, "2026-09-08T18:37:00Z")).toBeNull();
    expect(pushLatencyMinutes(1, null)).toBeNull();
  });

  it("calls a match overdue on the same 2h clock as the watchdog", () => {
    const k = at("2026-09-08T16:45:00Z");
    expect(OVERDUE_AFTER_SECONDS).toBe(7200);
    expect(isOverdue(k, false, k + 7199)).toBe(false);
    expect(isOverdue(k, false, k + 7200)).toBe(true);
    expect(isOverdue(k, true, k + 9000)).toBe(false);
    expect(isOverdue(0, false, 1)).toBe(false);
  });
});

// The real MD1 shape, mirrored from relayer/test/matchday.test.ts.
const slot = (d: string) => [
  at(`2026-09-${d}T16:45:00Z`),
  at(`2026-09-${d}T16:45:00Z`),
  at(`2026-09-${d}T19:00:00Z`),
  at(`2026-09-${d}T19:00:00Z`),
];
const MD1 = [...slot("08"), ...slot("09"), ...slot("10")];

describe("matchday coverage (port of relayer/src/matchday.ts)", () => {
  it("takes only the kickoffs of the current matchday", () => {
    const k = matchdayKickoffs(MD1, at("2026-09-09T07:00:00Z"));
    expect(k).toHaveLength(4);
    expect(iso(k[0]!)).toBe("2026-09-09T16:45:00.000Z");
  });

  it("opens 4h before the first lock and closes 150 min after the last kickoff", () => {
    const span = matchdaySpan(MD1, at("2026-09-09T07:00:00Z"))!;
    expect(iso(span.start)).toBe("2026-09-09T11:45:00.000Z");
    expect(iso(span.end)).toBe("2026-09-09T21:30:00.000Z");
  });

  it("reports upcoming, covering, then moves to the next day, then none", () => {
    expect(coverageStatus(MD1, at("2026-09-09T07:00:00Z"))).toMatchObject({ state: "upcoming", kickoffs: 4 });
    expect(coverageStatus(MD1, at("2026-09-09T12:00:00Z"))).toMatchObject({ state: "covering", kickoffs: 4 });
    const after = coverageStatus(MD1, at("2026-09-09T21:31:00Z"));
    expect(after.state).toBe("upcoming");
    if (after.state === "upcoming") expect(iso(after.span.start)).toBe("2026-09-10T11:45:00.000Z");
    expect(coverageStatus(MD1, at("2026-09-11T00:00:00Z"))).toEqual({ state: "none" });
    expect(coverageStatus([0, 0], 1)).toEqual({ state: "none" });
  });
});

describe("explorerTxUrl", () => {
  const hash = `0x${"ab".repeat(32)}`;

  it("picks the explorer per chain", () => {
    expect(explorerTxUrl(88888, hash)).toBe(`https://chiliscan.com/tx/${hash}`);
    expect(explorerTxUrl(88882, hash)).toBe(`https://testnet.chiliscan.com/tx/${hash}`);
  });

  it("refuses anything that is not a 32-byte hex hash (href built from a DB string)", () => {
    expect(explorerTxUrl(88888, null)).toBeNull();
    expect(explorerTxUrl(88888, "")).toBeNull();
    expect(explorerTxUrl(88888, "0xab")).toBeNull();
    expect(explorerTxUrl(88888, "javascript:alert(1)")).toBeNull();
    expect(explorerTxUrl(88888, `${hash}/../x`)).toBeNull();
  });
});
