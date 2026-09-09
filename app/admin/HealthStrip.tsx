"use client";

import { useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import { PREDICTOR_ADDRESS } from "@/lib/predictor/abi";
import {
  EIP1967_IMPL_SLOT,
  EXPECTED_GOVERNANCE,
  formatAge,
  formatChz,
  formatUtc,
  gasStatus,
  governanceCheck,
  governanceDrifted,
  groupAlerts,
  HEARTBEAT_STALE_AFTER_MS,
  implementationFromSlot,
  solvencyStatus,
  summarizeRun,
  type AlertGroup,
  type AlertSeverity,
  type GovernanceCheck,
  type OracleLogRow,
  type RunSummary,
  type StageFunds,
  watcherAlive,
} from "@/lib/admin/health";
import { coverageStatus, type CoverageStatus } from "@/lib/admin/pipeline";

type Tone = "ok" | "warn" | "bad" | "muted";

const toneClass: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-star",
  bad: "text-chz-2",
  muted: "text-muted",
};

const severityTone: Record<AlertSeverity, Tone> = { critical: "bad", warn: "warn", info: "muted" };

const shorten = (a: string) => `${a.slice(0, 8)}…${a.slice(-4)}`;
const hhmm = (sec: number) => formatUtc(new Date(sec * 1000).toISOString());

type ChainHealth = {
  oracleWei: bigint | null;
  contractWei: bigint | null;
  implementation: `0x${string}` | null;
};

/** The oracle log as the strip sees it: rows, whether env allows reading, and the refresh clock. */
type LogView = { rows: OracleLogRow[] | null; available: boolean; now: number };

/* ---------------------------------------------------------------- */
/* Tiles                                                             */
/* ---------------------------------------------------------------- */

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string | null; tone: Tone }) {
  return (
    <div className="rounded-2xl border border-line bg-night-2/60 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 font-mono text-sm font-bold ${toneClass[tone]}`}>{value}</p>
      {sub && <p className="mt-0.5 font-mono text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

function GasTile({ wei }: { wei: bigint | null | undefined }) {
  if (wei == null) return <Tile label="Oracle gas" value="…" sub="reading balance" tone="muted" />;
  const gas = gasStatus(wei);
  return (
    <Tile
      label="Oracle gas"
      value={`${gas.low ? "🪫" : "🔋"} ${gas.chz.toLocaleString("en-US", { maximumFractionDigits: 3 })} CHZ`}
      sub={gas.low ? `below the ${gas.floorChz} CHZ floor — top up from the owner key` : `≈ ${gas.pushesLeft} pushes · floor ${gas.floorChz} CHZ`}
      tone={gas.low ? "bad" : "ok"}
    />
  );
}

function SolvencyTile({ wei, stages }: { wei: bigint | null | undefined; stages: StageFunds[] | null }) {
  if (wei == null || !stages) return <Tile label="Contract solvency" value="…" sub="reading balance" tone="muted" />;
  const s = solvencyStatus(wei, stages);
  return (
    <Tile
      label="Contract solvency"
      value={s.ok ? "✓ covered" : "🚨 BREACH"}
      sub={`${formatChz(s.balanceWei)} held · ${formatChz(s.owedWei)} owed${s.ok ? ` · +${formatChz(s.surplusWei)}` : " — pause() and investigate"}`}
      tone={s.ok ? "ok" : "bad"}
    />
  );
}

function RunTile({ run, log }: { run: RunSummary | null; log: LogView }) {
  if (!log.available) return <Tile label="Last run" value="unavailable" sub="Supabase env missing" tone="muted" />;
  if (log.rows === null) return <Tile label="Last run" value="…" sub="reading oracle log" tone="muted" />;
  if (!run) return <Tile label="Last run" value="none in 7 days" sub="oracle-bot has not logged a run" tone="bad" />;
  const counts = `pushed ${run.pushed} · corrected ${run.corrected} · skipped ${run.skipped} · errors ${run.errors.length}`;
  const who = run.runner ? ` · ${run.runner}${run.tick ? ` #${run.tick}` : ""}` : "";
  return (
    <Tile
      label="Last run"
      value={`${run.stale ? "⏰ " : ""}${formatAge(run.ageMs)}${who}`}
      sub={`${formatUtc(run.at)} UTC · ${run.source} · ${counts}${run.alerts.length ? ` · alerts: ${run.alerts.join(", ")}` : ""}`}
      tone={run.troubled ? "bad" : run.stale ? "warn" : "ok"}
    />
  );
}

function HeartbeatTile({ log }: { log: LogView }) {
  if (!log.available) return <Tile label="Heartbeat" value="unavailable" sub={null} tone="muted" />;
  if (log.rows === null) return <Tile label="Heartbeat" value="…" sub={null} tone="muted" />;
  const beat = log.rows.find((l) => l.kind === "heartbeat");
  if (!beat) return <Tile label="Heartbeat" value="none in 7 days" sub="daily 07:07 UTC DM is missing" tone="bad" />;
  const ageMs = log.now - Date.parse(beat.created_at);
  const stale = ageMs > HEARTBEAT_STALE_AFTER_MS;
  const tracked = (beat.detail as { trackedMatches?: number } | null)?.trackedMatches;
  return (
    <Tile
      label="Heartbeat"
      value={`${stale ? "⏰ " : "✅ "}${formatAge(ageMs)}`}
      sub={`${formatUtc(beat.created_at)} UTC${tracked !== undefined ? ` · ${tracked} matches tracked` : ""}`}
      tone={stale ? "warn" : "ok"}
    />
  );
}

/* ---------------------------------------------------------------- */
/* Lines and lists                                                   */
/* ---------------------------------------------------------------- */

/**
 * Is matchday-watch supposed to be holding the relay right now? The span is
 * computed the same way the workflow computes it, from on-chain kickoffs of
 * non-voided matches rather than the bundle. Liveness is judged on the
 * newest WATCHER-tagged run against the tick-scale clock (health.ts
 * WATCHER_STALE_AFTER_MS): a cron or dispatch run landing mid-window must
 * neither hide a live watcher nor stand in for a dead one.
 */
function CoverageLine({ coverage, watcher }: { coverage: CoverageStatus; watcher: { run: RunSummary | null; alive: boolean } }) {
  if (coverage.state === "none") {
    return <p className="font-mono text-[11px] text-muted">Matchday watch · no matchday left on-chain</p>;
  }
  const window = `${hhmm(coverage.span.start)}–${hhmm(coverage.span.end).slice(-5)} UTC`;
  if (coverage.state === "upcoming") {
    return (
      <p className="font-mono text-[11px] text-muted">
        Matchday watch · next window {window} ({coverage.kickoffs} kickoffs) — bootstraps from the first oracle-bot run inside it
      </p>
    );
  }
  const { run, alive } = watcher;
  return (
    <p className={`font-mono text-[11px] ${alive ? "text-ok" : "text-star"}`}>
      Matchday watch · covering now ({window}, {coverage.kickoffs} kickoffs)
      {alive
        ? ` · watcher tick #${run?.tick ?? "?"} ${formatAge(run?.ageMs ?? 0)}`
        : run
          ? ` · last watcher tick #${run.tick ?? "?"} ${formatAge(run.ageMs)} — runner gone, check Actions → matchday-watch`
          : " · no watcher run yet — bootstraps from the next oracle-bot run"}
    </p>
  );
}

function AlertList({ groups, log }: { groups: AlertGroup[]; log: LogView }) {
  if (!log.available) return <p className="mt-2 font-mono text-[11px] text-muted">oracle log unavailable (Supabase env missing)</p>;
  if (log.rows === null) return <p className="mt-2 font-mono text-[11px] text-muted">…</p>;
  if (groups.length === 0) return <p className="mt-2 font-mono text-[11px] text-ok">✓ nothing fired — the bot has been quiet</p>;
  return (
    <ul className="mt-2 flex flex-col gap-1 font-mono text-[11px]">
      {groups.map((g) => (
        <li key={g.type} className={toneClass[severityTone[g.severity]]}>
          <span className="font-bold">{g.type}</span> ×{g.count} · {formatAge(log.now - Date.parse(g.latestAt))}
          {g.matchIds.length > 0 && (
            <span className="text-muted">
              {" "}· matches {g.matchIds.slice(0, 12).join(", ")}
              {g.matchIds.length > 12 ? "…" : ""}
            </span>
          )}
          {g.latestText && <span className="text-muted"> · {g.latestText.slice(0, 90)}</span>}
        </li>
      ))}
    </ul>
  );
}

const mark = (ok: boolean | null) => (ok === null ? "" : ok ? " ✓" : " ⚠ DRIFT");

function GovernanceLine(props: {
  paused: boolean | undefined;
  owner: string | undefined;
  oracle: string | undefined;
  implementation: string | null;
  sourceRef: string | undefined;
  check: GovernanceCheck;
  onRefresh: () => void;
}) {
  const { paused, owner, oracle, implementation, sourceRef, check, onRefresh } = props;
  const cls = (ok: boolean | null) => (ok === false ? "text-chz-2" : "text-muted");
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
      <span className={paused ? "text-chz-2" : "text-ok"}>{paused ? "⏸ PAUSED" : "● running"}</span>
      <span className={cls(check.ownerOk)}>
        owner {owner ? shorten(owner) : "…"}
        {mark(check.ownerOk)}
      </span>
      <span className={cls(check.oracleOk)}>
        oracle {oracle ? shorten(oracle) : "…"}
        {mark(check.oracleOk)}
      </span>
      <span className={cls(check.implementationOk)}>
        impl {implementation ? shorten(implementation) : "…"}
        {mark(check.implementationOk)}
      </span>
      <span className="text-muted">source: {sourceRef || "unset"}</span>
      <button type="button" onClick={onRefresh} className="ml-auto rounded border border-line px-2 py-0.5 text-[11px] text-muted">
        refresh
      </button>
    </div>
  );
}

function DriftNotice({ chainId, check }: { chainId: number; check: GovernanceCheck }) {
  if (!governanceDrifted(check)) return null;
  const expected = EXPECTED_GOVERNANCE[chainId];
  return (
    <p className="mt-2 font-mono text-[11px] text-chz-2">
      On-chain control differs from the expected values ({expected ? `impl ${shorten(expected.implementation)}` : "none"}).
      If this was your upgrade or rotation, update EXPECTED_GOVERNANCE in lib/admin/health.ts and EXPECTED_* in
      oracle-bot.yml. Otherwise treat the owner key as compromised: pause and investigate.
    </p>
  );
}

function LogTail({ rows }: { rows: OracleLogRow[] }) {
  return (
    <details className="rounded-2xl border border-line bg-night-2/60 p-4">
      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-muted">
        Oracle log · latest {Math.min(rows.length, 40)} rows
      </summary>
      <div className="mt-2 max-h-64 overflow-y-auto font-mono text-[11px] text-muted">
        {rows.slice(0, 40).map((l, i) => (
          <p key={i}>
            {formatUtc(l.created_at)} · {l.kind}
            {l.match_id ? ` · match ${l.match_id}` : ""}
            {l.kind === "alert" || l.kind === "run" ? ` · ${JSON.stringify(l.detail).slice(0, 80)}` : ""}
          </p>
        ))}
      </div>
    </details>
  );
}

/* ---------------------------------------------------------------- */
/* Strip                                                             */
/* ---------------------------------------------------------------- */

type Props = {
  chainId: number;
  owner: string | undefined;
  oracle: string | undefined;
  paused: boolean | undefined;
  sourceRef: string | undefined;
  /** league + knockout funds, once both stage reads landed */
  stages: StageFunds[] | null;
  /** non-voided on-chain kickoffs, once the slate loaded */
  kickoffs: number[] | null;
  logs: OracleLogRow[] | null;
  logAvailable: boolean;
  /** ticking wall clock (ms), null before the first client tick */
  now: number | null;
  /** bump to re-read the chain tripwires */
  refreshKey: number;
  onRefresh: () => void;
};

/**
 * The Telegram wires, on a page: gas floor, solvency, governance drift, last
 * run, heartbeat, matchday coverage and the 24h alert history. Chain verdicts
 * are recomputed from live reads with the bot's own thresholds
 * (lib/admin/health.ts); the rest comes from clp_oracle_log.
 */
export function HealthStrip(props: Props) {
  const { chainId, owner, oracle, paused, sourceRef, stages, kickoffs, logs, logAvailable, now, refreshKey, onRefresh } = props;
  const client = usePublicClient();
  const [chain, setChain] = useState<ChainHealth | null>(null);

  /** Oracle gas + contract balance + implementation slot: the bot's chain tripwires. */
  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    const oracleAddr = oracle as `0x${string}` | undefined;
    void Promise.all([
      oracleAddr ? client.getBalance({ address: oracleAddr }).catch(() => null) : Promise.resolve(null),
      client.getBalance({ address: PREDICTOR_ADDRESS }).catch(() => null),
      client.getStorageAt({ address: PREDICTOR_ADDRESS, slot: EIP1967_IMPL_SLOT }).catch(() => null),
    ]).then(([oracleWei, contractWei, slot]) => {
      if (!cancelled) setChain({ oracleWei, contractWei, implementation: implementationFromSlot(slot) });
    });
    return () => {
      cancelled = true;
    };
  }, [client, oracle, refreshKey]);

  const log: LogView = { rows: logs, available: logAvailable, now: now ?? 0 };
  const run = useMemo(() => {
    const row = logs?.find((l) => l.kind === "run");
    return row && now ? summarizeRun(row, now) : null;
  }, [logs, now]);
  const alertGroups = useMemo(() => (logs && now ? groupAlerts(logs, now) : []), [logs, now]);
  const coverage = useMemo(
    () => (kickoffs && now ? coverageStatus(kickoffs, Math.floor(now / 1000)) : null),
    [kickoffs, now],
  );
  // Scoped to the current window: a run from yesterday's watcher is "no
  // watcher yet", not "runner gone".
  const windowStartMs = coverage && coverage.state !== "none" ? coverage.span.start * 1000 : 0;
  const watcher = useMemo(
    () => (logs && now ? watcherAlive(logs, now, windowStartMs) : { run: null, alive: false }),
    [logs, now, windowStartMs],
  );
  const governance = governanceCheck(chainId, {
    owner: owner ?? null,
    oracle: oracle ?? null,
    implementation: chain?.implementation ?? null,
  });
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <GasTile wei={chain?.oracleWei} />
        <SolvencyTile wei={chain?.contractWei} stages={stages} />
        <RunTile run={run} log={log} />
        <HeartbeatTile log={log} />
      </div>

      {/* governance + matchday coverage */}
      <div className="rounded-2xl border border-line bg-night-2/60 p-4">
        {coverage && (
          <div className="mb-2 border-b border-line-soft pb-2">
            <CoverageLine coverage={coverage} watcher={watcher} />
          </div>
        )}
        <GovernanceLine
          paused={paused}
          owner={owner}
          oracle={oracle}
          implementation={chain?.implementation ?? null}
          sourceRef={sourceRef}
          check={governance}
          onRefresh={onRefresh}
        />
        <DriftNotice chainId={chainId} check={governance} />
      </div>

      {/* alerts, last 24h, grouped like the bot dedupes */}
      <div className="rounded-2xl border border-line bg-night-2/60 p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Alerts · last 24h</p>
        <AlertList groups={alertGroups} log={log} />
      </div>

      {logs && logs.length > 0 && <LogTail rows={logs} />}
    </>
  );
}
