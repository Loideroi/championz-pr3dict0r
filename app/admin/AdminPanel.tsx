"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { hexToString, parseAbiItem, stringToHex } from "viem";
import { PREDICTOR_ABI, PREDICTOR_ADDRESS, STAGE_KNOCKOUT, STAGE_LEAGUE } from "@/lib/predictor/abi";
import { compareRows, type StandingRow } from "@/lib/predictor/standings";
import { packPrediction } from "@/lib/predictor/packed";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;
const ENTERED_EVENT = parseAbiItem(
  "event Entered(address indexed wallet, uint8 indexed stage, bool fullSeasonPass)",
);
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type MatchRow = {
  id: number;
  teamA: string;
  teamB: string;
  kickoff: number;
  status: number;
  scoreA: number;
  scoreB: number;
  provisional: boolean;
};

type LogRow = { kind: string; match_id: number | null; created_at: string; detail: unknown };

/**
 * Admin console (slice 12, PRD §9) — the exceptions surface. Owner-gated
 * client-side (every action is owner-gated ON-CHAIN regardless; this UI just
 * refuses to render the guns for the wrong wallet). Routine per-match work
 * stays zero: everything here is corrections, lifecycle or emergencies.
 */
export function AdminPanel() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const owner = useReadContract({ ...contract, functionName: "owner" });
  const oracle = useReadContract({ ...contract, functionName: "oracle" });
  const paused = useReadContract({ ...contract, functionName: "paused" });
  const sourceRef = useReadContract({ ...contract, functionName: "resultSourceRef" });
  const matchCount = useReadContract({ ...contract, functionName: "matchCount" });
  const league = useReadContract({ ...contract, functionName: "stages", args: [BigInt(STAGE_LEAGUE)] });
  const knockout = useReadContract({ ...contract, functionName: "stages", args: [BigInt(STAGE_KNOCKOUT)] });

  const [matches, setMatches] = useState<MatchRow[] | null>(null);
  const [logs, setLogs] = useState<LogRow[] | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMatches = useCallback(async () => {
    if (!client || matchCount.data === undefined) return;
    const rows: MatchRow[] = [];
    for (let id = 1; id <= Number(matchCount.data); id++) {
      const [m, r] = await Promise.all([
        client.readContract({ ...contract, functionName: "matches", args: [id] }),
        client.readContract({ ...contract, functionName: "resultOf", args: [id] }),
      ]);
      rows.push({
        id,
        kickoff: Number(m[0]),
        status: Number(m[1]),
        teamA: hexToString(m[2] as `0x${string}`, { size: 3 }),
        teamB: hexToString(m[3] as `0x${string}`, { size: 3 }),
        scoreA: Number(r[0]),
        scoreB: Number(r[1]),
        provisional: Boolean(r[6]),
      });
    }
    setMatches(rows);
  }, [client, matchCount.data]);

  const loadLogs = useCallback(async () => {
    if (!SUPABASE_URL || !ANON_KEY) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/clp_oracle_log?order=created_at.desc&limit=12&select=kind,match_id,created_at,detail`,
        { headers: { apikey: ANON_KEY } },
      );
      if (res.ok) setLogs(await res.json());
    } catch {
      /* dashboard is best-effort */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadMatches();
      void loadLogs();
    }, 0);
    return () => clearTimeout(t);
  }, [loadMatches, loadLogs]);

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
      void loadMatches();
      void paused.refetch();
      void oracle.refetch();
      void sourceRef.refetch();
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
    const rows: StandingRow[] = [];
    for (const w of wallets) {
      const addr = w as `0x${string}`;
      const [pts, exact, at] = await Promise.all([
        client.readContract({ ...contract, functionName: "pointsOf", args: [addr, stage] }),
        client.readContract({ ...contract, functionName: "exactCountOf", args: [addr, stage] }),
        client.readContract({ ...contract, functionName: "enteredAt", args: [stage, addr] }),
      ]);
      rows.push({
        address: addr,
        fullSeason: true,
        leaguePoints: stage === STAGE_LEAGUE ? (pts as bigint) : null,
        knockoutPoints: stage === STAGE_KNOCKOUT ? (pts as bigint) : 0n,
        exactCount: exact as bigint,
        enteredAt: BigInt(Number(at) || 0),
      });
    }
    rows.sort(compareRows(stage === STAGE_LEAGUE ? "league" : "knockout"));
    return rows.slice(0, Math.min(20, rows.length)).map((r) => r.address);
  }

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

  const stageCard = (label: string, stage: number, data?: readonly [number, number, number, number, bigint, bigint]) => (
    <div className="rounded-2xl border border-line bg-night-2/60 p-4">
      <p className="font-mono text-xs uppercase tracking-widest text-glow-2">{label}</p>
      {data && (
        <p className="mt-1 font-mono text-xs text-muted">
          {["SELLING", "LOCKED", "VOID"][data[2]]} · {data[3]} entrants ·{" "}
          {Number(data[4] / 10n ** 18n).toLocaleString("en-US")} CHZ pool
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

  return (
    <div className="flex w-full max-w-3xl flex-col gap-5">
      {/* health */}
      <div className="rounded-2xl border border-line bg-night-2/60 p-4">
        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span className={paused.data ? "text-chz-2" : "text-ok"}>
            {paused.data ? "⏸ PAUSED" : "● running"}
          </span>
          <span className="text-muted">oracle {String(oracle.data ?? "…").slice(0, 8)}…</span>
          <span className="text-muted">source: {sourceRef.data || "unset"}</span>
        </div>
        <div className="mt-3 max-h-44 overflow-y-auto font-mono text-[11px] text-muted">
          {logs === null ? (
            <p>oracle log unavailable (Supabase env missing?)</p>
          ) : (
            logs.map((l, i) => (
              <p key={i}>
                {l.created_at.slice(0, 19).replace("T", " ")} · {l.kind}
                {l.match_id ? ` · match ${l.match_id}` : ""}{" "}
                {l.kind === "alert" ? `· ${JSON.stringify(l.detail).slice(0, 60)}` : ""}
              </p>
            ))
          )}
        </div>
      </div>

      {/* stages */}
      <div className="grid gap-4 sm:grid-cols-2">
        {stageCard("Stage 1 · League", STAGE_LEAGUE, league.data)}
        {stageCard("Stage 2 · Knockout", STAGE_KNOCKOUT, knockout.data)}
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

      {message && <p className="font-mono text-xs text-muted">{message}</p>}
    </div>
  );
}
