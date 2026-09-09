"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { hexToString, parseAbiItem, stringToHex } from "viem";
import { PREDICTOR_ABI, PREDICTOR_ADDRESS, STAGE_KNOCKOUT, STAGE_LEAGUE } from "@/lib/predictor/abi";
import { compareRows, type StandingRow } from "@/lib/predictor/standings";
import { MULTICALL_BATCH } from "@/lib/predictor/chains";
import { packPrediction } from "@/lib/predictor/packed";
import {
  EIP1967_IMPL_SLOT,
  EXPECTED_GOVERNANCE,
  formatAge,
  formatChz,
  formatUtc,
  gasStatus,
  governanceCheck,
  groupAlerts,
  HEARTBEAT_STALE_AFTER_MS,
  implementationFromSlot,
  solvencyStatus,
  stageNeedsFreeze,
  summarizeRun,
  type AlertSeverity,
  type OracleLogRow,
} from "@/lib/admin/health";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;
const ENTERED_EVENT = parseAbiItem(
  "event Entered(address indexed wallet, uint8 indexed stage, bool fullSeasonPass)",
);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Enough for a week of cron runs + a matchday of pushes and reminders. */
const LOG_LOOKBACK_MS = 7 * 24 * 3600 * 1000;
const LOG_LIMIT = 400;

type MatchRow = {
  id: number;
  teamA: string;
  teamB: string;
  kickoff: number;
  status: number;
  stage: number;
  scoreA: number;
  scoreB: number;
  provisional: boolean;
};

type ChainHealth = {
  oracleWei: bigint | null;
  contractWei: bigint | null;
  implementation: `0x${string}` | null;
};

const shorten = (a: string) => `${a.slice(0, 8)}…${a.slice(-4)}`;

const toneClass: Record<"ok" | "warn" | "bad" | "muted", string> = {
  ok: "text-ok",
  warn: "text-star",
  bad: "text-chz-2",
  muted: "text-muted",
};

const severityTone: Record<AlertSeverity, "bad" | "warn" | "muted"> = {
  critical: "bad",
  warn: "warn",
  info: "muted",
};

/**
 * Admin console (slice 12, PRD §9) — the exceptions surface. Owner-gated
 * client-side (every action is owner-gated ON-CHAIN regardless; this UI just
 * refuses to render the guns for the wrong wallet). Routine per-match work
 * stays zero: everything here is corrections, lifecycle or emergencies.
 *
 * The health strip mirrors what the oracle-bot DMs the owner on Telegram
 * (gas floor, solvency, governance drift, last run, heartbeat, alert history)
 * so the console answers "is the bot fine?" without opening the phone. Chain
 * verdicts are recomputed from live reads with the bot's own thresholds
 * (lib/admin/health.ts); the rest comes from clp_oracle_log.
 */
export function AdminPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const owner = useReadContract({ ...contract, functionName: "owner" });
  const oracle = useReadContract({ ...contract, functionName: "oracle" });
  const paused = useReadContract({ ...contract, functionName: "paused" });
  const sourceRef = useReadContract({ ...contract, functionName: "resultSourceRef" });
  const matchCount = useReadContract({ ...contract, functionName: "matchCount" });
  const league = useReadContract({ ...contract, functionName: "stages", args: [BigInt(STAGE_LEAGUE)] });
  const knockout = useReadContract({ ...contract, functionName: "stages", args: [BigInt(STAGE_KNOCKOUT)] });
  const leagueFrozen = useReadContract({ ...contract, functionName: "stageFrozen", args: [STAGE_LEAGUE] });
  const knockoutFrozen = useReadContract({ ...contract, functionName: "stageFrozen", args: [STAGE_KNOCKOUT] });

  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [logs, setLogs] = useState<OracleLogRow[] | null>(null);
  const [chainHealth, setChainHealth] = useState<ChainHealth | null>(null);
  /** Wall clock at the last refresh — set client-side only (SSR safety). */
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  /**
   * The whole slate in multicall batches. Serially this is 2 × matchCount
   * eth_calls — 288 at a full league phase, which is exactly the burst that
   * exhausted Ankr's free-tier rate limit on the relayer (PR #60).
   */
  const loadMatches = useCallback(async () => {
    if (!client || matchCount.data === undefined) return;
    const count = Number(matchCount.data);
    const ids = Array.from({ length: count }, (_, i) => i + 1);
    const calls = ids.flatMap((id) => [
      { ...contract, functionName: "matches", args: [id] } as const,
      { ...contract, functionName: "resultOf", args: [id] } as const,
    ]);
    const results: unknown[] = [];
    for (let i = 0; i < calls.length; i += MULTICALL_BATCH) {
      const batch = await client.multicall({
        contracts: calls.slice(i, i + MULTICALL_BATCH),
        allowFailure: true,
      });
      results.push(...batch.map((r) => (r.status === "success" ? r.result : null)));
    }
    const rows: MatchRow[] = [];
    ids.forEach((id, i) => {
      const m = results[i * 2] as readonly unknown[] | null;
      const r = results[i * 2 + 1] as readonly unknown[] | null;
      if (!m || !r) return; // a failed read drops its row rather than the console
      rows.push({
        id,
        kickoff: Number(m[0]),
        status: Number(m[1]),
        teamA: hexToString(m[2] as `0x${string}`, { size: 3 }),
        teamB: hexToString(m[3] as `0x${string}`, { size: 3 }),
        stage: Number(m[4]),
        scoreA: Number(r[0]),
        scoreB: Number(r[1]),
        provisional: Boolean(r[6]),
      });
    });
    setMatches(rows);
  }, [client, matchCount.data]);

  /** Oracle gas + contract balance + implementation slot: the bot's chain tripwires. */
  const loadChainHealth = useCallback(async () => {
    if (!client) return;
    const oracleAddr = oracle.data as `0x${string}` | undefined;
    const [oracleWei, contractWei, slot] = await Promise.all([
      oracleAddr ? client.getBalance({ address: oracleAddr }).catch(() => null) : Promise.resolve(null),
      client.getBalance({ address: PREDICTOR_ADDRESS }).catch(() => null),
      client.getStorageAt({ address: PREDICTOR_ADDRESS, slot: EIP1967_IMPL_SLOT }).catch(() => null),
    ]);
    setChainHealth({ oracleWei, contractWei, implementation: implementationFromSlot(slot) });
  }, [client, oracle.data]);

  /**
   * A week of this chain's log rows. Filtering on chain_id matters: the
   * Spicy sentinel writes to the same table and its alerts must not read as
   * mainnet incidents.
   */
  const loadLogs = useCallback(async () => {
    if (!SUPABASE_URL || !ANON_KEY) return;
    const now = Date.now();
    const since = new Date(now - LOG_LOOKBACK_MS).toISOString();
    const params = new URLSearchParams({
      select: "kind,chain_id,match_id,tx_hash,created_at,detail",
      chain_id: `eq.${chainId}`,
      created_at: `gte.${since}`,
      order: "created_at.desc",
      limit: String(LOG_LIMIT),
    });
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/clp_oracle_log?${params}`, {
        headers: { apikey: ANON_KEY },
      });
      if (res.ok) {
        setLogs((await res.json()) as OracleLogRow[]);
        setLoadedAt(now);
      }
    } catch {
      /* dashboard is best-effort */
    }
  }, [chainId]);

  const refreshAll = useCallback(() => {
    void loadMatches();
    void loadLogs();
    void loadChainHealth();
    setLoadedAt(Date.now());
  }, [loadMatches, loadLogs, loadChainHealth]);

  useEffect(() => {
    const t = setTimeout(refreshAll, 0);
    return () => clearTimeout(t);
  }, [refreshAll]);

  async function act(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setMessage(`${label}…`);
    try {
      await fn();
      setMessage(`${label} — transaction sent. State refreshes on confirmation.`);
    } catch (err) {
      setMessage(`${label} failed: ${err instanceof Error ? err.message.slice(0, 160) : String(err)}`);
    }
    setBusy(false);
    setTimeout(() => {
      refreshAll();
      void paused.refetch();
      void oracle.refetch();
      void sourceRef.refetch();
      void leagueFrozen.refetch();
      void knockoutFrozen.refetch();
    }, 6000);
  }

  /** Compute the §5.3-ordered top-N for a stage from chain state (freeze input). */
  async function computeRanked(stage: number): Promise<`0x${string}`[]> {
    if (!client) return [];
    const logsE = await client.getLogs({
      address: PREDICTOR_ADDRESS,
      event: ENTERED_EVENT,
      args: { stage },
      fromBlock: 0n,
      toBlock: "latest",
    });
    const wallets = [...new Set(logsE.map((l) => (l.args.wallet as string).toLowerCase()))];
    // Batched, but deliberately allowFailure:false — this ranking decides who
    // gets paid, so a rate-limited read must abort the freeze, never quietly
    // rank a wallet at zero points.
    const calls = wallets.flatMap((w) => {
      const addr = w as `0x${string}`;
      return [
        { ...contract, functionName: "pointsOf", args: [addr, stage] } as const,
        { ...contract, functionName: "exactCountOf", args: [addr, stage] } as const,
        { ...contract, functionName: "enteredAt", args: [stage, addr] } as const,
      ];
    });
    const read: unknown[] = [];
    for (let i = 0; i < calls.length; i += MULTICALL_BATCH) {
      read.push(
        ...(await client.multicall({
          contracts: calls.slice(i, i + MULTICALL_BATCH),
          allowFailure: false,
        })),
      );
    }
    const rows: StandingRow[] = wallets.map((w, i) => {
      const [pts, exact, at] = [read[i * 3], read[i * 3 + 1], read[i * 3 + 2]];
      return {
        address: w as `0x${string}`,
        fullSeason: true,
        leaguePoints: stage === STAGE_LEAGUE ? (pts as bigint) : null,
        knockoutPoints: stage === STAGE_KNOCKOUT ? (pts as bigint) : 0n,
        leagueExact: stage === STAGE_LEAGUE ? (exact as bigint) : 0n,
        knockoutExact: stage === STAGE_KNOCKOUT ? (exact as bigint) : 0n,
        enteredAt: BigInt(Number(at) || 0),
      };
    });
    rows.sort(compareRows(stage === STAGE_LEAGUE ? "league" : "knockout"));
    return rows.slice(0, Math.min(20, rows.length)).map((r) => r.address);
  }

  /* ---------------- derived health (pure helpers, memoised) ---------------- */

  const now = loadedAt ?? 0;
  const latestRun = useMemo(() => {
    const row = logs?.find((l) => l.kind === "run");
    return row && loadedAt ? summarizeRun(row, loadedAt) : null;
  }, [logs, loadedAt]);
  const latestHeartbeat = useMemo(() => logs?.find((l) => l.kind === "heartbeat") ?? null, [logs]);
  const alertGroups = useMemo(() => (logs && loadedAt ? groupAlerts(logs, loadedAt) : []), [logs, loadedAt]);
  const gas = chainHealth?.oracleWei != null ? gasStatus(chainHealth.oracleWei) : null;
  const solvency =
    chainHealth?.contractWei != null && league.data && knockout.data
      ? solvencyStatus(chainHealth.contractWei, [
          { pool: league.data[4], feeEscrow: league.data[5], frozen: Boolean(leagueFrozen.data) },
          { pool: knockout.data[4], feeEscrow: knockout.data[5], frozen: Boolean(knockoutFrozen.data) },
        ])
      : null;
  const governance = governanceCheck(chainId, {
    oracle: oracle.data ?? null,
    implementation: chainHealth?.implementation ?? null,
  });
  const play = (stage: number, frozen: boolean) => {
    const rows = (matches ?? []).filter((m) => m.stage === stage);
    return {
      frozen,
      total: rows.length,
      completed: rows.filter((m) => m.status === 1).length,
      voided: rows.filter((m) => m.status === 2).length,
    };
  };

  /* ---------------- gates ---------------- */

  if (!PREDICTOR_ADDRESS) return <p className="font-mono text-sm text-muted">Contract not configured.</p>;
  if (!isConnected) return <p className="font-mono text-sm text-muted">Connect the owner wallet.</p>;
  if (owner.data && address && owner.data.toLowerCase() !== address.toLowerCase()) {
    return (
      <p className="font-mono text-sm text-chz-2">
        {address.slice(0, 8)}… is not the contract owner. Every action here is owner-gated
        on-chain anyway — this door just saves you the gas of finding out.
      </p>
    );
  }

  /* ---------------- render helpers ---------------- */

  const tile = (label: string, value: string, sub: string | null, tone: keyof typeof toneClass) => (
    <div className="rounded-2xl border border-line bg-night-2/60 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted">{label}</p>
      <p className={`mt-1 font-mono text-sm font-bold ${toneClass[tone]}`}>{value}</p>
      {sub && <p className="mt-0.5 font-mono text-[11px] text-muted">{sub}</p>}
    </div>
  );

  const gasTile = () => {
    if (!gas) return tile("Oracle gas", "…", "reading balance", "muted");
    return tile(
      "Oracle gas",
      `${gas.low ? "🪫" : "🔋"} ${gas.chz.toLocaleString("en-US", { maximumFractionDigits: 3 })} CHZ`,
      gas.low ? `below the ${gas.floorChz} CHZ floor — top up from the owner key` : `≈ ${gas.pushesLeft} pushes · floor ${gas.floorChz} CHZ`,
      gas.low ? "bad" : "ok",
    );
  };

  const solvencyTile = () => {
    if (!solvency) return tile("Contract solvency", "…", "reading balance", "muted");
    return tile(
      "Contract solvency",
      solvency.ok ? "✓ covered" : "🚨 BREACH",
      `${formatChz(solvency.balanceWei)} held · ${formatChz(solvency.owedWei)} owed${
        solvency.ok ? ` · +${formatChz(solvency.surplusWei)}` : " — pause() and investigate"
      }`,
      solvency.ok ? "ok" : "bad",
    );
  };

  const runTile = () => {
    if (logs === null) return tile("Last run", "unavailable", "Supabase env missing?", "muted");
    if (!latestRun) return tile("Last run", "none in 7 days", "oracle-bot has not logged a run", "bad");
    const counts = `pushed ${latestRun.pushed} · corrected ${latestRun.corrected} · skipped ${latestRun.skipped} · errors ${latestRun.errors.length}`;
    const who = latestRun.runner ? ` · ${latestRun.runner}${latestRun.tick ? ` #${latestRun.tick}` : ""}` : "";
    return tile(
      "Last run",
      `${latestRun.stale ? "⏰ " : ""}${formatAge(latestRun.ageMs)}${who}`,
      `${formatUtc(latestRun.at)} UTC · ${latestRun.source} · ${counts}${
        latestRun.alerts.length ? ` · alerts: ${latestRun.alerts.join(", ")}` : ""
      }`,
      latestRun.troubled ? "bad" : latestRun.stale ? "warn" : "ok",
    );
  };

  const heartbeatTile = () => {
    if (logs === null) return tile("Heartbeat", "unavailable", null, "muted");
    if (!latestHeartbeat) return tile("Heartbeat", "none in 7 days", "daily 07:07 UTC DM is missing", "bad");
    const ageMs = now - Date.parse(latestHeartbeat.created_at);
    const stale = ageMs > HEARTBEAT_STALE_AFTER_MS;
    const tracked = (latestHeartbeat.detail as { trackedMatches?: number } | null)?.trackedMatches;
    return tile(
      "Heartbeat",
      `${stale ? "⏰ " : "✅ "}${formatAge(ageMs)}`,
      `${formatUtc(latestHeartbeat.created_at)} UTC${tracked !== undefined ? ` · ${tracked} matches tracked` : ""}`,
      stale ? "warn" : "ok",
    );
  };

  const mark = (ok: boolean | null) => (ok === null ? "" : ok ? " ✓" : " ⚠ DRIFT");

  const stageCard = (
    label: string,
    stage: number,
    data: readonly [number, number, number, number, bigint, bigint] | undefined,
    frozen: boolean,
  ) => {
    const p = play(stage, frozen);
    const needsFreeze = stageNeedsFreeze(p);
    return (
      <div className={`rounded-2xl border p-4 ${needsFreeze ? "border-star/40 bg-star/5" : "border-line bg-night-2/60"}`}>
        <p className="font-mono text-xs uppercase tracking-widest text-glow-2">{label}</p>
        {data && (
          <p className="mt-1 font-mono text-xs text-muted">
            {["SELLING", "LOCKED", "VOID"][data[2]]} · {data[3]} entrants ·{" "}
            {Number(data[4] / 10n ** 18n).toLocaleString("en-US")} CHZ pool ·{" "}
            {Number(data[5] / 10n ** 18n).toLocaleString("en-US")} CHZ fee escrow
          </p>
        )}
        <p className="mt-1 font-mono text-xs text-muted">
          {p.total === 0
            ? "no matches on-chain"
            : `${p.completed}/${p.total - p.voided} played${p.voided ? ` · ${p.voided} voided` : ""}`}{" "}
          · {frozen ? "🧊 frozen" : "not frozen"}
        </p>
        {needsFreeze && (
          <p className="mt-1 font-mono text-xs text-star">
            Fully played — freeze so winners can claim (the bot is nagging about this too).
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => act(`lockStage(${stage})`, () => writeContractAsync({ ...contract, functionName: "lockStage", args: [stage] }))}
            className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs disabled:opacity-40"
          >
            lockStage
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              act(`freezeStage(${stage})`, async () => {
                const ranked = await computeRanked(stage);
                if (ranked.length < 20) throw new Error(`only ${ranked.length} ranked wallets — floor is 20`);
                return writeContractAsync({ ...contract, functionName: "freezeStage", args: [stage, ranked] });
              })
            }
            className="rounded-lg border border-star/40 px-3 py-1.5 font-mono text-xs text-star disabled:opacity-40"
          >
            freezeStage (auto-ranked)
          </button>
        </div>
      </div>
    );
  };

  const expected = EXPECTED_GOVERNANCE[chainId];

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      {/* health tiles — the Telegram wires, on a page */}
      <div className="grid gap-3 sm:grid-cols-2">
        {gasTile()}
        {solvencyTile()}
        {runTile()}
        {heartbeatTile()}
      </div>

      {/* governance */}
      <div className="rounded-2xl border border-line bg-night-2/60 p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
          <span className={paused.data ? "text-chz-2" : "text-ok"}>
            {paused.data ? "⏸ PAUSED" : "● running"}
          </span>
          <span className={governance.oracleOk === false ? "text-chz-2" : "text-muted"}>
            oracle {oracle.data ? shorten(oracle.data) : "…"}
            {mark(governance.oracleOk)}
          </span>
          <span className={governance.implementationOk === false ? "text-chz-2" : "text-muted"}>
            impl {chainHealth?.implementation ? shorten(chainHealth.implementation) : "…"}
            {mark(governance.implementationOk)}
          </span>
          <span className="text-muted">source: {sourceRef.data || "unset"}</span>
          <button
            type="button"
            onClick={refreshAll}
            className="ml-auto rounded border border-line px-2 py-0.5 text-[11px] text-muted"
          >
            refresh
          </button>
        </div>
        {(governance.oracleOk === false || governance.implementationOk === false) && (
          <p className="mt-2 font-mono text-[11px] text-chz-2">
            On-chain control differs from the expected values ({expected ? `impl ${shorten(expected.implementation)}` : "none"}
            ). If this was your upgrade or rotation, update EXPECTED_GOVERNANCE in lib/admin/health.ts and
            EXPECTED_* in oracle-bot.yml. Otherwise treat the owner key as compromised: pause and investigate.
          </p>
        )}
      </div>

      {/* alerts, last 24h, grouped like the bot dedupes */}
      <div className="rounded-2xl border border-line bg-night-2/60 p-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted">Alerts · last 24h</p>
        {logs === null ? (
          <p className="mt-2 font-mono text-[11px] text-muted">oracle log unavailable (Supabase env missing?)</p>
        ) : alertGroups.length === 0 ? (
          <p className="mt-2 font-mono text-[11px] text-ok">✓ nothing fired — the bot has been quiet</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1 font-mono text-[11px]">
            {alertGroups.map((g) => (
              <li key={g.type} className={toneClass[severityTone[g.severity]]}>
                <span className="font-bold">{g.type}</span> ×{g.count} · {formatAge(now - Date.parse(g.latestAt))}
                {g.matchIds.length > 0 && (
                  <span className="text-muted"> · matches {g.matchIds.slice(0, 12).join(", ")}{g.matchIds.length > 12 ? "…" : ""}</span>
                )}
                {g.latestText && <span className="text-muted"> · {g.latestText.slice(0, 90)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* stages */}
      <div className="grid gap-4 sm:grid-cols-2">
        {stageCard("Stage 1 · League", STAGE_LEAGUE, league.data, Boolean(leagueFrozen.data))}
        {stageCard("Stage 2 · Knockout", STAGE_KNOCKOUT, knockout.data, Boolean(knockoutFrozen.data))}
      </div>

      {/* matches + corrections */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-night-2/60">
        <table className="w-full font-mono text-xs">
          <thead>
            <tr className="border-b border-line-soft uppercase tracking-widest text-muted">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">fixture</th>
              <th className="px-3 py-2 text-left">state</th>
              <th className="px-3 py-2 text-left">actions</th>
            </tr>
          </thead>
          <tbody>
            {(matches ?? []).map((m) => (
              <tr key={m.id} className="border-b border-line-soft last:border-0">
                <td className="px-3 py-2 text-muted">{m.id}</td>
                <td className="px-3 py-2">
                  {m.teamA}–{m.teamB}
                </td>
                <td className="px-3 py-2 text-muted">
                  {["SCHEDULED", "COMPLETED", "VOIDED"][m.status]}
                  {m.status === 1 && ` ${m.scoreA}-${m.scoreB}${m.provisional ? " ◌" : ""}`}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {m.status === 1 && paused.data && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const input = prompt(`forceCorrect ${m.teamA}-${m.teamB} — new 90' score as "A-B":`, `${m.scoreA}-${m.scoreB}`);
                          if (!input) return;
                          const [a, b] = input.split("-").map(Number);
                          void act(`forceCorrectResult(${m.id})`, () =>
                            writeContractAsync({
                              ...contract,
                              functionName: "forceCorrectResult",
                              args: [m.id, packPrediction(a!, b!)],
                            }),
                          );
                        }}
                        className="rounded border border-chz/50 px-2 py-1 text-chz-2 disabled:opacity-40"
                      >
                        forceCorrect
                      </button>
                    )}
                    {m.status !== 2 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!confirm(`Void match ${m.id} (${m.teamA}-${m.teamB})? Only for OUR fixture mistakes — UEFA decisions are mirrored, never voided.`)) return;
                          void act(`voidMatch(${m.id})`, () =>
                            writeContractAsync({ ...contract, functionName: "voidMatch", args: [m.id] }),
                          );
                        }}
                        className="rounded border border-line px-2 py-1 disabled:opacity-40"
                      >
                        void
                      </button>
                    )}
                    {m.status === 0 && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const input = prompt(`New teams for match ${m.id} as "AAA-BBB" (3-letter codes):`, `${m.teamA}-${m.teamB}`);
                          if (!input) return;
                          const [ta, tb] = input.split("-");
                          if (!ta || !tb || ta.length !== 3 || tb.length !== 3) return alert("Use 3-letter codes.");
                          void act(`setMatchTeams(${m.id})`, () =>
                            writeContractAsync({
                              ...contract,
                              functionName: "setMatchTeams",
                              args: [m.id, stringToHex(ta.toUpperCase(), { size: 3 }), stringToHex(tb.toUpperCase(), { size: 3 })],
                            }),
                          );
                        }}
                        className="rounded border border-line px-2 py-1 disabled:opacity-40"
                      >
                        setTeams
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* emergencies */}
      <div className="rounded-2xl border border-chz/30 bg-chz/5 p-4">
        <p className="font-mono text-xs uppercase tracking-widest text-chz-2">Emergencies</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              act(paused.data ? "unpause" : "pause", () =>
                writeContractAsync({ ...contract, functionName: paused.data ? "unpause" : "pause", args: [] }),
              )
            }
            className="rounded-lg border border-chz/50 px-3 py-1.5 font-mono text-xs text-chz-2 disabled:opacity-40"
          >
            {paused.data ? "unpause" : "pause"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const next = prompt("Rotate oracle to address:", String(oracle.data ?? ""));
              if (!next) return;
              void act("setOracle", () =>
                writeContractAsync({ ...contract, functionName: "setOracle", args: [next as `0x${string}`] }),
              );
            }}
            className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs disabled:opacity-40"
          >
            rotate oracle
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const next = prompt("New resultSourceRef:", String(sourceRef.data ?? ""));
              if (!next) return;
              void act("setResultSource", () =>
                writeContractAsync({ ...contract, functionName: "setResultSource", args: [next] }),
              );
            }}
            className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs disabled:opacity-40"
          >
            set source ref
          </button>
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          Feed down? Manual results ride the oracle path: Actions → oracle-bot → Run
          workflow → paste <code>manual_results</code> JSON
          ([{"{"}&quot;uefaMatchId&quot;,&quot;scoreA90&quot;,&quot;scoreB90&quot;{"}"}…]) —
          same idempotency rules, no owner-key ceremony.
        </p>
      </div>

      {/* raw tail of the oracle log, for when the tiles are not enough */}
      {logs && logs.length > 0 && (
        <details className="rounded-2xl border border-line bg-night-2/60 p-4">
          <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-muted">
            Oracle log · latest {Math.min(logs.length, 40)} rows
          </summary>
          <div className="mt-2 max-h-64 overflow-y-auto font-mono text-[11px] text-muted">
            {logs.slice(0, 40).map((l, i) => (
              <p key={i}>
                {formatUtc(l.created_at)} · {l.kind}
                {l.match_id ? ` · match ${l.match_id}` : ""}
                {l.kind === "alert" ? ` · ${JSON.stringify(l.detail).slice(0, 80)}` : ""}
                {l.kind === "run" ? ` · ${JSON.stringify(l.detail).slice(0, 80)}` : ""}
              </p>
            ))}
          </div>
        </details>
      )}

      {message && <p className="font-mono text-xs text-muted">{message}</p>}
    </div>
  );
}
