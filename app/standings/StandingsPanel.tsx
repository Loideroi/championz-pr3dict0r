"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { PREDICTOR_ABI, PREDICTOR_ADDRESS, STAGE_KNOCKOUT, STAGE_LEAGUE } from "@/lib/predictor/abi";
import {
  flagEmoji,
  pointsFor,
  rowsForView,
  type StandingRow,
  type StageView,
} from "@/lib/predictor/standings";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;
const ENTERED_EVENT = parseAbiItem(
  "event Entered(address indexed wallet, uint8 indexed stage, bool fullSeasonPass)",
);

const VIEWS: { key: StageView; label: string }[] = [
  { key: "league", label: "Stage 1 · League" },
  { key: "knockout", label: "Stage 2 · Knockout" },
  { key: "season", label: "Season View" },
];

export function StandingsPanel() {
  const client = usePublicClient();
  const [view, setView] = useState<StageView>("season");
  const [rows, setRows] = useState<StandingRow[] | null>(null);
  const [hasProvisional, setHasProvisional] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!client || !PREDICTOR_ADDRESS) return;
    try {
      // entrants from Entered events (read-model cache replaces this at scale)
      const logs = await client.getLogs({
        address: PREDICTOR_ADDRESS,
        event: ENTERED_EVENT,
        fromBlock: 0n,
        toBlock: "latest",
      });
      const wallets = new Map<string, boolean>(); // address → fullSeason
      for (const log of logs) {
        const wallet = (log.args.wallet as string).toLowerCase();
        wallets.set(wallet, (wallets.get(wallet) ?? false) || Boolean(log.args.fullSeasonPass));
      }

      const built: StandingRow[] = [];
      for (const [address, fullSeason] of wallets) {
        const addr = address as `0x${string}`;
        const [leaguePts, koPts, exactL, exactK, atL, atK] = await Promise.all([
          fullSeason
            ? client.readContract({ ...contract, functionName: "pointsOf", args: [addr, STAGE_LEAGUE] })
            : Promise.resolve(null),
          client.readContract({ ...contract, functionName: "pointsOf", args: [addr, STAGE_KNOCKOUT] }),
          fullSeason
            ? client.readContract({ ...contract, functionName: "exactCountOf", args: [addr, STAGE_LEAGUE] })
            : Promise.resolve(0n),
          client.readContract({ ...contract, functionName: "exactCountOf", args: [addr, STAGE_KNOCKOUT] }),
          client.readContract({ ...contract, functionName: "enteredAt", args: [STAGE_LEAGUE, addr] }),
          client.readContract({ ...contract, functionName: "enteredAt", args: [STAGE_KNOCKOUT, addr] }),
        ]);
        // optional profile (flags) — graceful when Supabase isn't configured
        let username: string | undefined;
        let countryCode: string | undefined;
        try {
          const res = await fetch(`/api/profile?address=${addr}&chainId=88882`);
          if (res.ok) {
            const p = await res.json();
            username = p?.username ?? undefined;
            countryCode = p?.country_code ?? undefined;
          }
        } catch {
          /* no profile service — addresses only */
        }
        built.push({
          address: addr,
          username,
          countryCode,
          fullSeason,
          leaguePoints: leaguePts as bigint | null,
          knockoutPoints: koPts as bigint,
          exactCount: ((exactL as bigint) ?? 0n) + (exactK as bigint),
          enteredAt: BigInt(Number(atL) || Number(atK) || 0), // uint40 → number from viem
        });
      }
      setRows(built);

      // provisional badge (D9): any completed-but-unfinalized result?
      const n = Number(
        await client.readContract({ ...contract, functionName: "matchCount" }),
      );
      let provisional = false;
      for (let id = 1; id <= n && !provisional; id++) {
        const r = (await client.readContract({
          ...contract,
          functionName: "resultOf",
          args: [id],
        })) as readonly [number, number, boolean, boolean, number, boolean, boolean];
        provisional = r[5] && r[6];
      }
      setHasProvisional(provisional);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [client]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!PREDICTOR_ADDRESS) {
    return <p className="font-mono text-sm text-muted">Contract address not configured.</p>;
  }

  const sorted = rows ? rowsForView(rows, view) : null;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-pressed={view === v.key}
            onClick={() => setView(v.key)}
            className={`rounded-full border px-4 py-2 font-mono text-xs ${
              view === v.key ? "border-glow-2 text-glow-2" : "border-line text-muted"
            }`}
          >
            {v.label}
          </button>
        ))}
        {hasProvisional && (
          <span className="ml-auto rounded-full border border-star/40 px-3 py-1 font-mono text-xs text-star">
            ◌ contains provisional results
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-night-2/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-soft font-mono text-xs uppercase tracking-widest text-muted">
              <th className="px-4 py-3 text-left">#</th>
              <th className="px-4 py-3 text-left">Predictor</th>
              {view === "season" && <th className="px-4 py-3 text-right">League</th>}
              {view === "season" && <th className="px-4 py-3 text-right">Knockout</th>}
              <th className="px-4 py-3 text-right">Points</th>
            </tr>
          </thead>
          <tbody>
            {sorted === null ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center font-mono text-xs text-muted">
                  Reading the chain…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center font-mono text-xs text-muted">
                  No entrants yet — be the first.
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => (
                <tr key={r.address} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-3 font-mono text-muted">
                    {view === "season" && i === 0 ? "👑" : i + 1}
                  </td>
                  <td className="px-4 py-3">
                    {flagEmoji(r.countryCode)}{" "}
                    {r.username ?? `${r.address.slice(0, 6)}…${r.address.slice(-4)}`}
                    {!r.fullSeason && (
                      <span className="ml-2 rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-muted">
                        KO pass
                      </span>
                    )}
                  </td>
                  {view === "season" && (
                    <td className="px-4 py-3 text-right font-mono text-glow-2">
                      {r.leaguePoints === null ? "—" : r.leaguePoints.toString()}
                    </td>
                  )}
                  {view === "season" && (
                    <td className="px-4 py-3 text-right font-mono text-glow-2">
                      {r.knockoutPoints.toString()}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right font-mono font-bold text-star">
                    {(pointsFor(r, view) ?? 0n).toString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-xs text-muted-2">
        Points compute live from chain state — no settlement transactions exist. Season
        View crowns the Ultimate ₵h@mpi0n (trophy NFT lands with slice 11).
      </p>
      {error && <p className="font-mono text-xs text-chz-2">{error}</p>}
    </div>
  );
}
