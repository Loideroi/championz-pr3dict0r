"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAppKit } from "@reown/appkit/react";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { hexToString } from "viem";
import {
  PREDICTOR_ABI,
  PREDICTOR_ADDRESS,
  STAGE_KNOCKOUT,
  STAGE_LEAGUE,
} from "@/lib/predictor/abi";
import { unpackPrediction } from "@/lib/predictor/packed";
import {
  diffSlate,
  formatUtcTime,
  groupSlate,
  lockAt,
  matchPhase,
  toBatchArgs,
  type ScorePick,
  type SlateMatch,
} from "@/lib/predictor/slate";
import { MatchRow } from "@/components/predict/MatchRow";
import { SubmitBar, type NamedChange } from "@/components/predict/SubmitBar";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;
const STAGES = [STAGE_LEAGUE, STAGE_KNOCKOUT] as const;

/**
 * SCW-safe write confirmation (CLAUDE.md): the Socios.com Wallet relays
 * transactions over WalletConnect, so receipts may never resolve here. We
 * confirm by polling chain state for the *effect* (~120s window).
 */
function usePollForEffect() {
  const client = usePublicClient();
  return useCallback(
    async (check: () => Promise<boolean>) => {
      if (!client) return false;
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        if (await check()) return true;
        await new Promise((r) => setTimeout(r, 3_000));
      }
      return false;
    },
    [client],
  );
}

export function PlayPanel() {
  const t = useTranslations("play");
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();
  const pollForEffect = usePollForEffect();

  /** Local staging area: matchId → pick being drafted/edited. */
  const [drafts, setDrafts] = useState<ReadonlyMap<number, ScorePick>>(new Map());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  /** Client clock — null until mounted (SSR safety: no Date.now in render). */
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Math.floor(Date.now() / 1000));
    const first = setTimeout(update, 0);
    const t = setInterval(update, 1_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const configured = !!PREDICTOR_ADDRESS;

  // ---- slate reads (one multicall batch each — no per-row call storm) ----
  const matchCount = useReadContract({
    ...contract,
    functionName: "matchCount",
    query: { enabled: configured },
  });
  const count = Number(matchCount.data ?? 0);
  const ids = useMemo(() => Array.from({ length: count }, (_, i) => i + 1), [count]);

  const matchReads = useReadContracts({
    contracts: ids.map((id) => ({ ...contract, functionName: "matches", args: [id] }) as const),
    query: { enabled: configured && count > 0 },
  });
  const predictionReads = useReadContracts({
    contracts: ids.map(
      (id) => ({ ...contract, functionName: "predictionOf", args: [address!, id] }) as const,
    ),
    query: { enabled: configured && count > 0 && !!address },
  });
  const enteredReads = useReadContracts({
    contracts: STAGES.map(
      (stage) => ({ ...contract, functionName: "entered", args: [stage, address!] }) as const,
    ),
    query: { enabled: configured && !!address },
  });
  const pointsReads = useReadContracts({
    contracts: STAGES.map(
      (stage) => ({ ...contract, functionName: "pointsOf", args: [address!, stage] }) as const,
    ),
    query: { enabled: configured && !!address },
  });

  const slate: SlateMatch[] = useMemo(() => {
    if (!matchReads.data) return [];
    return matchReads.data.flatMap((r, i) => {
      if (r.status !== "success") return [];
      const [kickoff, status, teamA, teamB, stage] = r.result as readonly [
        number,
        number,
        `0x${string}`,
        `0x${string}`,
        number,
      ];
      return [
        {
          id: ids[i],
          kickoff: Number(kickoff),
          completed: Number(status) === 1, // MatchStatus.COMPLETED
          teamA: hexToString(teamA, { size: 3 }),
          teamB: hexToString(teamB, { size: 3 }),
          stage: Number(stage),
        },
      ];
    });
  }, [matchReads.data, ids]);

  // Results only for completed matches (matchday evenings), one batch.
  const completedIds = useMemo(
    () => slate.filter((m) => m.completed).map((m) => m.id),
    [slate],
  );
  const resultReads = useReadContracts({
    contracts: completedIds.map(
      (id) => ({ ...contract, functionName: "resultOf", args: [id] }) as const,
    ),
    query: { enabled: configured && completedIds.length > 0 },
  });

  const onchainPicks = useMemo(() => {
    const map = new Map<number, ScorePick>();
    predictionReads.data?.forEach((r, i) => {
      if (r.status !== "success") return;
      const p = unpackPrediction(r.result as bigint);
      if (p.submitted) map.set(ids[i], { scoreA: p.scoreA, scoreB: p.scoreB });
    });
    return map;
  }, [predictionReads.data, ids]);

  const results = useMemo(() => {
    const map = new Map<number, ScorePick>();
    resultReads.data?.forEach((r, i) => {
      if (r.status !== "success") return;
      // v2+ resultOf: [scoreA, scoreB, extraTime, penalties, advancer, completed, provisional]
      const [scoreA, scoreB, , , , completed] = r.result as readonly [
        number,
        number,
        boolean,
        boolean,
        number,
        boolean,
        boolean,
      ];
      if (completed) map.set(completedIds[i], { scoreA, scoreB });
    });
    return map;
  }, [resultReads.data, completedIds]);

  const enteredByStage = useMemo(
    () =>
      STAGES.map(
        (_, i) =>
          enteredReads.data?.[i]?.status === "success" && enteredReads.data[i].result === true,
      ),
    [enteredReads.data],
  );
  const pointsByStage = STAGES.map((_, i) =>
    pointsReads.data?.[i]?.status === "success" ? (pointsReads.data[i].result as bigint) : null,
  );

  const groups = useMemo(() => groupSlate(slate), [slate]);

  // The old → new diff, restricted to matches still open right now.
  const changes: NamedChange[] = useMemo(() => {
    if (now === null) return [];
    const byId = new Map(slate.map((m) => [m.id, m]));
    return diffSlate(drafts, onchainPicks).flatMap((c) => {
      const m = byId.get(c.matchId);
      if (!m || matchPhase(m, now) !== "open" || !enteredByStage[m.stage]) return [];
      return [{ ...c, teamA: m.teamA, teamB: m.teamB }];
    });
  }, [now, slate, drafts, onchainPicks, enteredByStage]);

  const setDraft = useCallback((matchId: number, pick: ScorePick) => {
    setDrafts((prev) => new Map(prev).set(matchId, pick));
  }, []);
  const clearDraft = useCallback((matchId: number) => {
    setDrafts((prev) => {
      const next = new Map(prev);
      next.delete(matchId);
      return next;
    });
  }, []);

  async function handleSubmit() {
    const staged = changes;
    if (staged.length === 0) return;
    const { matchIds, packeds } = toBatchArgs(staged);
    setBusy(true);
    setMessage(t("confirmBatch", { count: staged.length }));
    try {
      await writeContractAsync({
        ...contract,
        functionName: "submitPredictions",
        args: [matchIds, packeds],
      });
    } catch {
      /* SCW relay — the poll decides */
    }
    setMessage(t("waitingBatch"));
    const ok = await pollForEffect(async () => {
      if (!client || !address) return false;
      const reads = await Promise.all(
        matchIds.map(
          (id) =>
            client.readContract({
              ...contract,
              functionName: "predictionOf",
              args: [address, id],
            }) as Promise<bigint>,
        ),
      );
      return reads.every((p, i) => p === packeds[i]);
    });
    if (ok) {
      const single = staged.length === 1 ? slate.find((m) => m.id === staged[0].matchId) : undefined;
      setMessage(
        single
          ? t("updatedSingle", { time: formatUtcTime(lockAt(single)) })
          : t("updatedMany", { count: staged.length }),
      );
      setDrafts(new Map());
    } else {
      setMessage(t("batchNotConfirmed"));
    }
    await predictionReads.refetch();
    setBusy(false);
  }

  if (!configured) {
    return <p className="font-mono text-sm text-muted">{t("notConfigured")}</p>;
  }

  const loading = matchCount.isPending || (count > 0 && matchReads.isPending);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6">
      {!isConnected && (
        <button
          type="button"
          onClick={() => open()}
          className="self-center rounded-xl bg-gradient-to-b from-chz-2 to-chz px-5 py-3 font-semibold text-white"
        >
          {t("connectWallet")}
        </button>
      )}

      {loading ? (
        <p className="text-center font-mono text-sm text-muted">{t("loading")}</p>
      ) : slate.length === 0 ? (
        <p className="text-center font-mono text-sm text-muted">{t("emptySlate")}</p>
      ) : (
        groups.map((group) => {
          const stageLabel =
            group.stage === STAGE_LEAGUE
              ? t("stageLeague")
              : group.stage === STAGE_KNOCKOUT
                ? t("stageKnockout")
                : t("stageFallback", { stage: group.stage });
          return (
          <section key={`${group.stage}|${group.dayKey}`} className="flex flex-col gap-3">
            <header className="flex items-baseline justify-between gap-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.24em] text-glow-2">
                {stageLabel} · {group.dayLabel}
              </h2>
              {pointsByStage[group.stage] !== null && pointsByStage[group.stage]! > 0n && (
                <p className="font-mono text-xs text-star">
                  {t("pointsThisStage", { points: pointsByStage[group.stage]!.toString() })}
                </p>
              )}
            </header>
            <ul className="flex flex-col gap-3">
              {group.matches.map((m) => {
                const phase = now === null ? "open" : matchPhase(m, now);
                return (
                  <MatchRow
                    key={m.id}
                    match={m}
                    phase={phase}
                    secondsToLock={now === null ? null : Math.max(0, lockAt(m) - now)}
                    connected={isConnected}
                    entered={enteredByStage[m.stage] ?? false}
                    onchain={onchainPicks.get(m.id) ?? null}
                    draft={drafts.get(m.id) ?? null}
                    result={results.get(m.id) ?? null}
                    busy={busy}
                    onDraft={(pick) => setDraft(m.id, pick)}
                    onEdit={() => {
                      const current = onchainPicks.get(m.id);
                      if (current) setDraft(m.id, current); // pre-fill the on-chain pick
                    }}
                    onDiscard={() => clearDraft(m.id)}
                  />
                );
              })}
            </ul>
          </section>
          );
        })
      )}

      <SubmitBar
        changes={changes}
        busy={busy}
        onSubmit={handleSubmit}
        onDiscardAll={() => setDrafts(new Map())}
      />

      {message && (
        <p role="status" className="text-center font-mono text-xs text-muted">
          {message}
        </p>
      )}
    </div>
  );
}
