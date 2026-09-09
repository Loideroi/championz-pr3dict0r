"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { hexToString, parseAbiItem, stringToHex } from "viem";
import { PREDICTOR_ABI, PREDICTOR_ADDRESS, STAGE_KNOCKOUT, STAGE_LEAGUE } from "@/lib/predictor/abi";
import { compareRows, type StandingRow } from "@/lib/predictor/standings";
import { MULTICALL_BATCH } from "@/lib/predictor/chains";
import { packPrediction } from "@/lib/predictor/packed";
import { DEPLOYED_CHAIN_ID, type StageFunds } from "@/lib/admin/health";
import { matchPipelines } from "@/lib/admin/pipeline";
import { HealthStrip } from "./HealthStrip";
import { PipelineCell } from "./PipelineCell";
import { StageCard, type StageTuple } from "./StageCard";
import { useOracleLog } from "./useOracleLog";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;
const ENTERED_EVENT = parseAbiItem(
  "event Entered(address indexed wallet, uint8 indexed stage, bool fullSeasonPass)",
);

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

/**
 * Admin console (slice 12, PRD §9) — the exceptions surface. Owner-gated
 * client-side (every action is owner-gated ON-CHAIN regardless; this UI just
 * refuses to render the guns for the wrong wallet). Routine per-match work
 * stays zero: everything here is corrections, lifecycle or emergencies.
 *
 * Health (HealthStrip) mirrors what the oracle-bot DMs the owner on Telegram;
 * the per-match pipeline column (PipelineCell) shows what the bot did for
 * each fixture. Both read clp_oracle_log through useOracleLog.
 */
export function AdminPanel() {
  const { address, isConnected } = useAccount();
  // The deployment's chain, never the wallet's: see DEPLOYED_CHAIN_ID.
  const chainId = DEPLOYED_CHAIN_ID;
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const log = useOracleLog(chainId);

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

  const { reload } = log;
  /**
   * Refresh EVERYTHING the console reasons about, in one go. The solvency
   * verdict compares a live balance against the stage structs; refetching one
   * without the other produced a false SOLVENCY_BREACH right after
   * lockStage(0) on 9 Sep 2026 — the balance had dropped by the forwarded
   * fees while the cached league struct still carried them as escrow.
   */
  const reads = [owner, paused, oracle, sourceRef, league, knockout, leagueFrozen, knockoutFrozen, matchCount];
  const readsRef = useRef(reads);
  useEffect(() => {
    readsRef.current = reads;
  });
  const refreshAll = useCallback(() => {
    for (const r of readsRef.current) void r.refetch();
    void loadMatches();
    void reload();
    setRefreshKey((k) => k + 1);
  }, [loadMatches, reload]);

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
    // Socios.com Wallet relays: the receipt may land well after the 6s mark,
    // so refresh twice — chain state is the confirmation (CLAUDE.md), and a
    // stale struct next to a fresh balance is exactly the false alarm above.
    setTimeout(refreshAll, 6000);
    setTimeout(refreshAll, 20000);
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

  /* ---------------- derived ---------------- */

  const pipelines = useMemo(() => matchPipelines(log.pipelineRows), [log.pipelineRows]);
  const stageFunds: StageFunds[] | null =
    league.data && knockout.data
      ? [
          { pool: league.data[4], feeEscrow: league.data[5], frozen: Boolean(leagueFrozen.data) },
          { pool: knockout.data[4], feeEscrow: knockout.data[5], frozen: Boolean(knockoutFrozen.data) },
        ]
      : null;
  const kickoffs = useMemo(
    () => (matches ? matches.filter((m) => m.status !== 2).map((m) => m.kickoff) : null),
    [matches],
  );
  const play = (stage: number, frozen: boolean) => {
    const rows = (matches ?? []).filter((m) => m.stage === stage);
    return {
      frozen,
      total: rows.length,
      completed: rows.filter((m) => m.status === 1).length,
      voided: rows.filter((m) => m.status === 2).length,
      provisional: rows.filter((m) => m.status === 1 && m.provisional).length,
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

  const stageCard = (label: string, stage: number, data: StageTuple | undefined, frozen: boolean) => (
    <StageCard
      label={label}
      data={data}
      play={play(stage, frozen)}
      nowSec={log.now ? Math.floor(log.now / 1000) : 0}
      busy={busy}
      onLock={() => act(`lockStage(${stage})`, () => writeContractAsync({ ...contract, functionName: "lockStage", args: [stage] }))}
      onFreeze={() =>
        act(`freezeStage(${stage})`, async () => {
          const ranked = await computeRanked(stage);
          if (ranked.length < 20) throw new Error(`only ${ranked.length} ranked wallets — floor is 20`);
          return writeContractAsync({ ...contract, functionName: "freezeStage", args: [stage, ranked] });
        })
      }
    />
  );

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      <HealthStrip
        chainId={chainId}
        owner={owner.data}
        oracle={oracle.data}
        paused={paused.data}
        sourceRef={sourceRef.data}
        stages={stageFunds}
        kickoffs={kickoffs}
        logs={log.logs}
        logAvailable={log.available}
        now={log.now}
        refreshKey={refreshKey}
        onRefresh={refreshAll}
      />

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
              <th className="px-3 py-2 text-left">pipeline</th>
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
                <td className="px-3 py-2 text-[11px]">
                  <PipelineCell match={m} pipeline={pipelines.get(m.id)} chainId={chainId} nowMs={log.now ?? 0} />
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

      {message && <p className="font-mono text-xs text-muted">{message}</p>}
    </div>
  );
}
