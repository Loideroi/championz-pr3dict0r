"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
import { ENTRY, PREDICTION_LOCKOUT_SECONDS, STAGE_FLOOR, formatChz } from "@/lib/economics";
import { teamName } from "@/lib/fixtures";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;

type LockedMatch = { id: number; teamA: string; teamB: string; kickoff: number };

export function EnterPanel() {
  const t = useTranslations("enter");
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
   * Every full-season entrant is in both pools, so once the league stage has
   * STAGE_FLOOR entrants the knockout floor is mathematically guaranteed too —
   * the "floor 20 or full refund" caveat becomes noise on BOTH cards.
   */
  const floorSecured = Number(league.data?.[3] ?? 0) >= STAGE_FLOOR;

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
    return <p className="font-mono text-sm text-muted">{t("notConfigured")}</p>;
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
    setMessage(t("confirmInWallet"));
    try {
      await writeContractAsync({
        ...contract,
        functionName: kind === "full" ? "enterFullSeason" : "enterKnockout",
        value: kind === "full" ? FULL_SEASON_GROSS_WEI : KNOCKOUT_GROSS_WEI,
      });
    } catch {
      /* SCW relay — the poll decides */
    }
    setMessage(t("waitingOnchain"));
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
    setMessage(ok ? t("confirmed") : t("notConfirmed"));
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
        <p className="font-mono text-xs uppercase tracking-widest text-glow-2">{t("fullSeason.title")}</p>
        <p className="font-display text-4xl font-black">
          {formatChz(ENTRY.fullSeason.gross)} <span className="text-lg">CHZ</span>
        </p>
        <ul className="flex flex-col gap-1 font-mono text-xs text-muted">
          <li>{t("fullSeason.split")}</li>
          <li>{t("fullSeason.bothStages")}</li>
          <li>{t("fullSeason.salesClose", { date: fmtDate(league.data?.[1]) })}</li>
          <li>
            {t(floorSecured ? "fullSeason.entrantsNoFloor" : "fullSeason.entrants", {
              count: league.data?.[3]?.toString() ?? "…",
            })}
          </li>
        </ul>
        {enteredLeague.data ? (
          <p className="font-mono text-sm text-ok">{t("fullSeason.holdsPass")}</p>
        ) : !isConnected ? (
          <button type="button" onClick={() => open()} className="rounded-xl bg-gradient-to-b from-chz-2 to-chz px-5 py-3 font-semibold text-white">
            {t("connectWallet")}
          </button>
        ) : (
          <button
            type="button"
            disabled={!leagueOpen || busy !== null}
            onClick={() => enter("full")}
            className="rounded-xl bg-gradient-to-b from-chz-2 to-chz px-5 py-3 font-semibold text-white disabled:opacity-40"
          >
            {leagueOpen ? (busy === "full" ? t("fullSeason.entering") : t("fullSeason.enterCta")) : t("fullSeason.salesClosed")}
          </button>
        )}
      </div>

      {/* Knockout pass */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-night-2/60 p-6">
        <p className="font-mono text-xs uppercase tracking-widest text-glow-2">{t("knockout.title")}</p>
        <p className="font-display text-4xl font-black">
          {formatChz(ENTRY.knockout.gross)} <span className="text-lg">CHZ</span>
        </p>
        <ul className="flex flex-col gap-1 font-mono text-xs text-muted">
          <li>{t("knockout.split")}</li>
          <li>{t("knockout.stage2Only")}</li>
          <li>{t("knockout.onSale", { from: fmtDate(knockout.data?.[0]), to: fmtDate(knockout.data?.[1]) })}</li>
          <li>
            {t(floorSecured ? "knockout.entrantsNoFloor" : "knockout.entrants", {
              count: knockout.data?.[3]?.toString() ?? "…",
            })}
          </li>
        </ul>

        {needsDisclosure && !enteredKnockout.data && (
          <div className="rounded-xl border border-star/40 bg-star/10 p-3 text-xs">
            <p className="mb-2 font-semibold text-star">
              {t("knockout.lockedWarning", { count: lockedMatches!.length })}
            </p>
            <ul className="mb-2 font-mono text-muted">
              {lockedMatches!.map((m) => (
                <li key={m.id}>
                  {teamName(m.teamA)} vs {teamName(m.teamB)} · {fmtDate(m.kickoff)}
                </li>
              ))}
            </ul>
            <label className="flex items-center gap-2 text-ink">
              <input
                type="checkbox"
                checked={disclosureAck}
                onChange={(e) => setDisclosureAck(e.target.checked)}
              />
              {t("knockout.ackLabel")}
            </label>
          </div>
        )}

        {enteredKnockout.data ? (
          <p className="font-mono text-sm text-ok">
            {enteredLeague.data ? t("knockout.inViaSeason") : t("knockout.inPool")}
          </p>
        ) : !isConnected ? (
          <button type="button" onClick={() => open()} className="rounded-xl bg-gradient-to-b from-glow-2 to-glow px-5 py-3 font-semibold text-white">
            {t("connectWallet")}
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
                ? t("knockout.opensLater")
                : t("knockout.salesClosed")
              : busy === "ko"
                ? t("knockout.entering")
                : needsDisclosure && !disclosureAck
                  ? t("knockout.ackFirst")
                  : t("knockout.joinCta")}
          </button>
        )}
      </div>

      {message && <p className="font-mono text-xs text-muted sm:col-span-2">{message}</p>}
    </div>
  );
}
