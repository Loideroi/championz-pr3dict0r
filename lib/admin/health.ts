/**
 * Admin console health model — the browser-side twin of the relayer's
 * Telegram wires (relayer/src/{balance,sentinels,watchdog,alerts}.ts).
 *
 * Everything the bot DMs the owner about is either a chain read the browser
 * can make itself (oracle gas, solvency, governance) or a row already in
 * clp_oracle_log (last run, heartbeat, alert history). These helpers are
 * pure so the console renders the same verdicts the bot would send, and the
 * tests pin the thresholds to the bot's.
 */

import { STAGE_FLOOR } from "../economics";
import { STAGE_STATUS } from "../predictor/standingsPayload";

/**
 * The chain this deployment is built for (inlined at build, same source as
 * lib/wagmi/config.ts). Never the wallet's selected chain: an owner whose
 * wallet sits on Spicy while looking at the mainnet site must still see
 * mainnet logs and mainnet governance expectations.
 */
export const DEPLOYED_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "88882");

/* ------------------------------------------------------------------ */
/* Chain-read verdicts                                                 */
/* ------------------------------------------------------------------ */

/** ORACLE_MIN_CHZ in oracle-bot.yml / DEFAULT_MIN_BALANCE_CHZ in balance.ts. */
export const ORACLE_GAS_FLOOR_CHZ = 20;

/**
 * Rough CHZ burned per result push at the 2,510 gwei Chiliz gas price —
 * balance.ts documents the 20 CHZ floor as "~80 pushes of headroom".
 */
export const CHZ_PER_PUSH = 0.25;

/**
 * Governance the sentinel expects (EXPECTED_* in oracle-bot.yml, addresses in
 * contracts/deployments.md). Update BOTH on every upgrade or oracle rotation —
 * a mismatch here after a legitimate change is the same false alarm the bot
 * would raise, and just as easy to clear.
 */
export const EXPECTED_GOVERNANCE: Record<number, { oracle: string; implementation: string }> = {
  88888: {
    oracle: "0xB57Cb421E3B707d0970Ec758D40a4366DB317B15",
    implementation: "0x09FeC2eA6f5a1EeA5171cb0ffBC65Dcf76ed72f6",
  },
  88882: {
    oracle: "0xB57Cb421E3B707d0970Ec758D40a4366DB317B15",
    implementation: "0x888e98fC6ecEe5C8A086003956Cf7DAb7493bBd7",
  },
};

/** EIP-1967 implementation slot (UUPS proxy). */
export const EIP1967_IMPL_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc" as const;

/** Integer-milli CHZ from wei — no float drift on 18-decimal balances. */
export function weiToChz(wei: bigint): number {
  return Number(wei / 10n ** 15n) / 1000;
}

export function formatChz(wei: bigint): string {
  return `${weiToChz(wei).toLocaleString("en-US", { maximumFractionDigits: 3 })} CHZ`;
}

export type GasStatus = {
  chz: number;
  low: boolean;
  floorChz: number;
  /** Approximate result pushes the balance still covers. */
  pushesLeft: number;
};

/** Same verdict as relayer/src/balance.ts readBalance(). */
export function gasStatus(balanceWei: bigint, floorChz = ORACLE_GAS_FLOOR_CHZ): GasStatus {
  const chz = weiToChz(balanceWei);
  return { chz, low: chz < floorChz, floorChz, pushesLeft: Math.floor(chz / CHZ_PER_PUSH) };
}

export type StageFunds = { pool: bigint; feeEscrow: bigint; frozen: boolean };

export type SolvencyStatus = {
  balanceWei: bigint;
  owedWei: bigint;
  /** balance − owed; negative means the sentinel's SOLVENCY_BREACH. */
  surplusWei: bigint;
  ok: boolean;
};

/** Same invariant as relayer/src/sentinels.ts checkSolvency(). */
export function solvencyStatus(balanceWei: bigint, stages: StageFunds[]): SolvencyStatus {
  const owedWei = stages
    .filter((s) => !s.frozen)
    .reduce((acc, s) => acc + s.pool + s.feeEscrow, 0n);
  return { balanceWei, owedWei, surplusWei: balanceWei - owedWei, ok: balanceWei >= owedWei };
}

/** Last 20 bytes of the EIP-1967 slot value, or null when the slot is empty. */
export function implementationFromSlot(slotValue: string | null | undefined): `0x${string}` | null {
  if (!slotValue || slotValue === "0x") return null;
  const hex = slotValue.slice(2).padStart(64, "0").slice(-40);
  if (/^0+$/.test(hex)) return null;
  return `0x${hex}`;
}

export type GovernanceCheck = {
  oracleOk: boolean | null;
  implementationOk: boolean | null;
};

/** null = nothing expected for this chain (or the value is not readable yet). */
export function governanceCheck(
  chainId: number,
  actual: { oracle?: string | null; implementation?: string | null },
): GovernanceCheck {
  const expected = EXPECTED_GOVERNANCE[chainId];
  if (!expected) return { oracleOk: null, implementationOk: null };
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return {
    oracleOk: actual.oracle ? eq(actual.oracle, expected.oracle) : null,
    implementationOk: actual.implementation ? eq(actual.implementation, expected.implementation) : null,
  };
}

export type StagePlay = {
  frozen: boolean;
  total: number;
  completed: number;
  voided: number;
  /** completed results still inside their 24h provisional window */
  provisional: number;
};

/** Same trigger as relayer/src/sentinels.ts checkUnfrozenStage(). */
export function stageNeedsFreeze(s: StagePlay): boolean {
  const playable = s.total - s.voided;
  return !s.frozen && playable > 0 && s.completed === playable;
}

/* ------------------------------------------------------------------ */
/* Stage lifecycle (mirrors lockStage / freezeStage guards)            */
/* ------------------------------------------------------------------ */

export { STAGE_STATUS };

export type StageLifecycle = {
  closeAt: number;
  status: number;
  entryCount: number;
  feeEscrow: bigint;
};

/**
 * True exactly when lockStage(stage) would not revert: the window has closed
 * and the stage is still SELLING. What it then does depends on the floor —
 * see {@link lockHint}.
 */
export function lockCallable(s: StageLifecycle, nowSec: number): boolean {
  return s.status === STAGE_STATUS.SELLING && nowSec >= s.closeAt;
}

/**
 * The one line the card shows while lockStage is callable. Above the floor
 * it forwards the escrowed fees to the fee recipient; below it, it VOIDS the
 * stage and opens D2 refunds — the same call, opposite outcomes, so say so.
 */
export function lockHint(s: StageLifecycle, nowSec: number): string | null {
  if (!lockCallable(s, nowSec)) return null;
  const entrants = `${s.entryCount.toLocaleString("en-US")} entrants`;
  if (s.entryCount < STAGE_FLOOR) {
    return `Window closed, ${entrants}: below the ${STAGE_FLOOR} floor — lockStage VOIDS the stage and opens refunds (D2)`;
  }
  return `Window closed, ${entrants}: lockStage forwards ${formatChz(s.feeEscrow)} fees to the fee recipient`;
}

/**
 * True exactly when freezeStage(stage) would pass _requireStageFinalized:
 * LOCKED, not yet frozen, every playable match COMPLETED and none of them
 * still provisional. resultOf().provisional is computed on-chain from the
 * same clock the guard uses, so this mirrors the revert conditions 1:1.
 */
export function freezeCallable(status: number, play: StagePlay): boolean {
  return status === STAGE_STATUS.LOCKED && stageNeedsFreeze(play) && play.provisional === 0;
}

/** Why the freeze button is greyed out — the tooltip text. */
export function freezeBlocker(status: number | undefined, play: StagePlay): string {
  if (status === undefined) return "reading stage";
  if (status !== STAGE_STATUS.LOCKED) return "stage must be LOCKED first (lockStage)";
  if (play.frozen) return "already frozen";
  if (!stageNeedsFreeze(play)) return "every match of the stage must be COMPLETED";
  return `${play.provisional} result(s) still inside the 24h provisional window`;
}

/* ------------------------------------------------------------------ */
/* Oracle-log read model                                               */
/* ------------------------------------------------------------------ */

export type OracleLogRow = {
  kind: "run" | "result_push" | "correction" | "alert" | "heartbeat";
  chain_id: number | null;
  match_id: number | null;
  tx_hash?: string | null;
  created_at: string;
  detail: unknown;
};

type RunDetail = {
  source?: string;
  pushed?: number[];
  corrected?: number[];
  skipped?: number;
  errors?: Array<{ matchId: number; error: string }>;
  alerts?: string[];
  runner?: string;
  tick?: number;
};

/**
 * Off-matchday the cron lands 7–10 times a day with 2–5 h gaps (see
 * relayer/src/matchday.ts). Six hours is the same threshold HealthBanner uses
 * to decide whether a troubled run is still news.
 */
export const RUN_STALE_AFTER_MS = 6 * 3600 * 1000;

/** The heartbeat is daily at 07:07 UTC; two missed beats is a real silence. */
export const HEARTBEAT_STALE_AFTER_MS = 36 * 3600 * 1000;

/**
 * A matchday-watch runner ticks every 5 minutes and dies after its runner
 * budget; three missed ticks means it is gone. Judged on the newest
 * WATCHER-tagged run only — a cron or dispatch run landing in the window
 * must neither hide a live watcher nor stand in for a dead one.
 */
export const WATCHER_STALE_AFTER_MS = 15 * 60 * 1000;

export type Runner = "cron" | "watcher" | "dispatch";
export const RUNNERS: readonly Runner[] = ["cron", "watcher", "dispatch"];

/** Newest run row tagged with `runner`, summarized; null when none in the rows. */
export function latestRunBy(rows: OracleLogRow[], runner: Runner, nowMs: number): RunSummary | null {
  const row = rows.find((r) => r.kind === "run" && (r.detail as { runner?: unknown } | null)?.runner === runner);
  return row ? summarizeRun(row, nowMs) : null;
}

/** Is a watcher holding the relay right now, on the tick-scale clock? */
export function watcherAlive(rows: OracleLogRow[], nowMs: number): { run: RunSummary | null; alive: boolean } {
  const run = latestRunBy(rows, "watcher", nowMs);
  return { run, alive: run !== null && run.ageMs <= WATCHER_STALE_AFTER_MS };
}

export type RunSummary = {
  at: string;
  ageMs: number;
  stale: boolean;
  source: string;
  pushed: number;
  corrected: number;
  skipped: number;
  errors: Array<{ matchId: number; error: string }>;
  alerts: string[];
  troubled: boolean;
  runner: string | null;
  tick: number | null;
};

export function summarizeRun(row: OracleLogRow, nowMs: number): RunSummary {
  const d = (row.detail ?? {}) as RunDetail;
  const ageMs = Math.max(0, nowMs - Date.parse(row.created_at));
  const errors = Array.isArray(d.errors) ? d.errors : [];
  const alerts = Array.isArray(d.alerts) ? d.alerts : [];
  return {
    at: row.created_at,
    ageMs,
    stale: ageMs > RUN_STALE_AFTER_MS,
    source: d.source ?? "unknown",
    pushed: Array.isArray(d.pushed) ? d.pushed.length : 0,
    corrected: Array.isArray(d.corrected) ? d.corrected.length : 0,
    skipped: typeof d.skipped === "number" ? d.skipped : 0,
    errors,
    alerts,
    troubled: errors.length > 0 || alerts.length > 0,
    runner: typeof d.runner === "string" ? d.runner : null,
    tick: typeof d.tick === "number" ? d.tick : null,
  };
}

/**
 * The bot writes alert rows in two shapes: relay.mjs stores the watchdog
 * kind under `detail.kind`, the sentinel and balance scripts store their
 * dedupe key under `detail.type`. One accessor for both.
 */
export function alertType(row: OracleLogRow): string {
  const d = row.detail as { type?: unknown; kind?: unknown } | null | undefined;
  if (d && typeof d.type === "string") return d.type;
  if (d && typeof d.kind === "string") return d.kind;
  return "unknown";
}

export type AlertSeverity = "critical" | "warn" | "info";

/** Channel notices are informational; the rest mirror the bot's urgency. */
export function alertSeverity(type: string): AlertSeverity {
  if (type === "t75_reminder" || type === "heads_up") return "info";
  if (
    type === "governance_drift" ||
    type === "insolvency" ||
    type === "SOURCE_SCHEMA_CHANGED" ||
    type.startsWith("site_down_")
  ) {
    return "critical";
  }
  return "warn";
}

export type AlertGroup = {
  type: string;
  severity: AlertSeverity;
  count: number;
  latestAt: string;
  /** Match ids seen in this group (reminders, relay errors). */
  matchIds: number[];
  /** Most recent human-readable line the bot stored, if any. */
  latestText: string | null;
};

const ALERT_WINDOW_MS = 24 * 3600 * 1000;

/** The human line the bot stored with an alert row: sentinel headline or watchdog summary. */
function alertText(row: OracleLogRow): string | null {
  const d = row.detail as { headline?: unknown; summary?: unknown } | null | undefined;
  if (d && typeof d.headline === "string") return d.headline;
  if (d && typeof d.summary === "string") return d.summary;
  return null;
}

/**
 * Alerts of the last 24 h grouped by type — the same window the bot dedupes
 * on, so one group here ≈ one Telegram message. Newest group first, critical
 * before warn before info.
 */
export function groupAlerts(rows: OracleLogRow[], nowMs: number, windowMs = ALERT_WINDOW_MS): AlertGroup[] {
  const since = nowMs - windowMs;
  const groups = new Map<string, AlertGroup>();
  for (const row of rows) {
    if (row.kind !== "alert") continue;
    const at = Date.parse(row.created_at);
    if (Number.isNaN(at) || at < since) continue;
    const type = alertType(row);
    const text = alertText(row);
    const g = groups.get(type);
    if (!g) {
      groups.set(type, {
        type,
        severity: alertSeverity(type),
        count: 1,
        latestAt: row.created_at,
        matchIds: row.match_id !== null ? [row.match_id] : [],
        latestText: text,
      });
      continue;
    }
    g.count += 1;
    if (row.match_id !== null && !g.matchIds.includes(row.match_id)) g.matchIds.push(row.match_id);
    if (at > Date.parse(g.latestAt)) {
      g.latestAt = row.created_at;
      if (text) g.latestText = text;
    }
  }
  const rank: Record<AlertSeverity, number> = { critical: 0, warn: 1, info: 2 };
  return [...groups.values()].sort(
    (a, b) => rank[a.severity] - rank[b.severity] || Date.parse(b.latestAt) - Date.parse(a.latestAt),
  );
}

/** "just now" · "4m ago" · "2h 15m ago" · "3d ago" — client-side only. */
export function formatAge(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 === 0 ? `${h}h ago` : `${h}h ${m % 60}m ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Pinned UTC "09 Sep 20:14" — never the viewer's locale. */
export function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${mon} ${hh}:${mm}`;
}
