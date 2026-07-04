"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { hexToString } from "viem";
import {
  FULL_SEASON_GROSS_WEI,
  KNOCKOUT_GROSS_WEI,
  PREDICTOR_ABI,
  PREDICTOR_ADDRESS,
  STAGE_KNOCKOUT,
  STAGE_LEAGUE,
} from "@/lib/predictor/abi";
import { ENTRY, PREDICTION_LOCKOUT_SECONDS, formatChz } from "@/lib/economics";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;

type LockedMatch = { id: number; teamA: string; teamB: string; kickoff: number };

export function EnterPanel() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();

  const [now, setNow] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [lockedMatches, setLockedMatches] = useState<LockedMatch[] | null>(null);
  const [disclosureAck, setDisclosureAck] = useState(false);

  useEffect(() => {
    const update = () => setNow(Math.floor(Date.now() / 1000));
    const first = setTimeout(update, 0);
    const t = setInterval(update, 1_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const league = useReadContract({ ...contract, functionName: "stages", args: [BigInt(STAGE_LEAGUE)] });
  const knockout = useReadContract({ ...contract, functionName: "stages", args: [BigInt(STAGE_KNOCKOUT)] });
  const matchCount = useReadContract({ ...contract, functionName: "matchCount" });
  const enteredLeague = useReadContract({
    ...contract,
    functionName: "entered",
    args: address ? [STAGE_LEAGUE, address] : undefined,
    query: { enabled: !!address },
  });
  const enteredKnockout = useReadContract({
    ...contract,
    functionName: "entered",
    args: address ? [STAGE_KNOCKOUT, address] : undefined,
    query: { enabled: !!address },
  });

  /**
   * D4 disclosure: before a knockout purchase inside the play-off first-leg
   * window, list every knockout match already past its prediction lockout —
   * the buyer can no longer score on those.
   */
  const loadLockedMatches = useCallback(async () => {
    if (!client || now === null) return;
    const n = Number(matchCount.data ?? 0);
    const locked: LockedMatch[] = [];
    for (let id = 1; id <= n; id++) {
      const m = (await client.readContract({
        ...contract,
        functionName: "matches",
        args: [id],
      })) as readonly [number, number, string, string, number];
      const [kickoff, , teamA, teamB, stage] = m;
      if (stage === STAGE_KNOCKOUT && now >= Number(kickoff) - PREDICTION_LOCKOUT_SECONDS) {
        locked.push({
          id,
          teamA: hexToString(teamA as `0x${string}`, { size: 3 }),
          teamB: hexToString(teamB as `0x${string}`, { size: 3 }),
          kickoff: Number(kickoff),
        });
      }
    }
    setLockedMatches(locked);
  }, [client, matchCount.data, now]);

  useEffect(() => {
    if (matchCount.data === undefined || now === null || lockedMatches !== null) return;
    const t = setTimeout(() => void loadLockedMatches(), 0); // async — no sync setState in effect
    return () => clearTimeout(t);
  }, [matchCount.data, now, lockedMatches, loadLockedMatches]);

  if (!PREDICTOR_ADDRESS) {
    return <p className="font-mono text-sm text-muted">Contract address not configured.</p>;
  }

  const leagueOpen =
    now !== null && league.data
      ? now >= Number(league.data[0]) && now < Number(league.data[1]) && league.data[2] === 0
      : false;
  const knockoutOpen =
    now !== null && knockout.data
      ? now >= Number(knockout.data[0]) && now < Number(knockout.data[1]) && knockout.data[2] === 0
      : false;

  const needsDisclosure = (lockedMatches?.length ?? 0) > 0;
  const knockoutPayEnabled = knockoutOpen && (!needsDisclosure || disclosureAck);

  async function enter(kind: "full" | "ko") {
    setBusy(kind);
    setMessage("Confirm the entry in your wallet…");
    try {
      await writeContractAsync({
        ...contract,
        functionName: kind === "full" ? "enterFullSeason" : "enterKnockout",
        value: kind === "full" ? FULL_SEASON_GROSS_WEI : KNOCKOUT_GROSS_WEI,
      });
    } catch {
      /* SCW relay — the poll decides */
    }
    setMessage("Waiting for the entry to land on-chain…");
    const stage = kind === "full" ? STAGE_LEAGUE : STAGE_KNOCKOUT;
    const deadline = Date.now() + 120_000;
    let ok = false;
    while (Date.now() < deadline && !ok) {
      ok =
        !!client &&
        !!address &&
        ((await client.readContract({
          ...contract,
          functionName: "entered",
          args: [stage, address],
        })) as boolean);
      if (!ok) await new Promise((r) => setTimeout(r, 3_000));
    }
    setMessage(ok ? "Entry confirmed — you're in. Go predict!" : "Not confirmed after 120s — check your wallet.");
    await Promise.all([enteredLeague.refetch(), enteredKnockout.refetch(), league.refetch(), knockout.refetch()]);
    setBusy(null);
  }

  const fmtDate = (ts?: number | bigint) =>
    ts !== undefined
      ? new Date(Number(ts) * 1000).toLocaleString("en-GB", { timeZone: "UTC", hour12: false }) + " UTC"
      : "…";

  return (
    <div className="grid w-full max-w-3xl gap-6 sm:grid-cols-2">
      {/* Full Season pass */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-night-2/60 p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-glow-2">Full Season pass</p>
        <p className="font-display text-4xl font-black">
          {formatChz(ENTRY.fullSeason.gross)} <span className="text-lg">CHZ</span>
        </p>
        <ul className="flex flex-col gap-1 font-mono text-xs text-muted">
          <li>500 → League Pool · 500 → Knockout Pool · 100 fee</li>
          <li>Both stages, one transaction</li>
          <li>Sales close: {fmtDate(league.data?.[1])}</li>
          <li>Entrants: {league.data?.[3]?.toString() ?? "…"} (floor 20 or full refund)</li>
        </ul>
        {enteredLeague.data ? (
          <p className="font-mono text-sm text-ok">✓ You hold the season pass</p>
        ) : !isConnected ? (
          <button type="button" onClick={() => open()} className="rounded-xl bg-gradient-to-b from-chz-2 to-chz px-5 py-3 font-semibold text-white">
            Connect Wallet
          </button>
        ) : (
          <button
            type="button"
            disabled={!leagueOpen || busy !== null}
            onClick={() => enter("full")}
            className="rounded-xl bg-gradient-to-b from-chz-2 to-chz px-5 py-3 font-semibold text-white disabled:opacity-40"
          >
            {leagueOpen ? (busy === "full" ? "Entering…" : "Enter the season") : "Sales closed"}
          </button>
        )}
      </div>

      {/* Knockout pass */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-night-2/60 p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-glow-2">Knockout pass</p>
        <p className="font-display text-4xl font-black">
          {formatChz(ENTRY.knockout.gross)} <span className="text-lg">CHZ</span>
        </p>
        <ul className="flex flex-col gap-1 font-mono text-xs text-muted">
          <li>500 → Knockout Pool · 50 fee</li>
          <li>Stage 2 only — everyone starts at 0</li>
          <li>On sale: {fmtDate(knockout.data?.[0])} → {fmtDate(knockout.data?.[1])}</li>
          <li>Entrants: {knockout.data?.[3]?.toString() ?? "…"} (floor 20 or full refund)</li>
        </ul>

        {needsDisclosure && !enteredKnockout.data && (
          <div className="rounded-xl border border-star/40 bg-star/10 p-3 text-xs">
            <p className="mb-2 font-semibold text-star">
              ⚠ {lockedMatches!.length} knockout {lockedMatches!.length === 1 ? "match has" : "matches have"} already
              locked — you can no longer score on:
            </p>
            <ul className="mb-2 font-mono text-muted">
              {lockedMatches!.map((m) => (
                <li key={m.id}>
                  {m.teamA} vs {m.teamB} · {fmtDate(m.kickoff)}
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-ink">
              <input
                type="checkbox"
                checked={disclosureAck}
                onChange={(e) => setDisclosureAck(e.target.checked)}
              />
              I understand these score 0 points for me
            </label>
          </div>
        )}

        {enteredKnockout.data ? (
          <p className="font-mono text-sm text-ok">
            ✓ You&apos;re in the knockout {enteredLeague.data ? "(via season pass)" : "pool"}
          </p>
        ) : !isConnected ? (
          <button type="button" onClick={() => open()} className="rounded-xl bg-gradient-to-b from-glow-2 to-glow px-5 py-3 font-semibold text-white">
            Connect Wallet
          </button>
        ) : (
          <button
            type="button"
            disabled={!knockoutPayEnabled || busy !== null}
            onClick={() => enter("ko")}
            className="rounded-xl bg-gradient-to-b from-glow-2 to-glow px-5 py-3 font-semibold text-white disabled:opacity-40"
          >
            {!knockoutOpen
              ? now !== null && knockout.data && now < Number(knockout.data[0])
                ? "Opens when season sales close"
                : "Sales closed"
              : busy === "ko"
                ? "Entering…"
                : needsDisclosure && !disclosureAck
                  ? "Acknowledge locked matches first"
                  : "Join the knockout"}
          </button>
        )}
      </div>

      {message && <p className="font-mono text-xs text-muted sm:col-span-2">{message}</p>}
    </div>
  );
}
