"use client";

import { useCallback, useEffect, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { hexToString } from "viem";
import { ENTRY_GROSS_WEI, PREDICTOR_ABI, PREDICTOR_ADDRESS } from "@/lib/predictor/abi";
import { packPrediction, unpackPrediction } from "@/lib/predictor/packed";
import { PREDICTION_LOCKOUT_SECONDS } from "@/lib/economics";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;

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

function Stepper({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <button
        type="button"
        aria-label={`${label} score up`}
        disabled={disabled}
        onClick={() => onChange(Math.min(15, value + 1))}
        className="h-7 w-10 rounded-md border border-line bg-white/5 text-xs hover:bg-glow disabled:opacity-40"
      >
        ▲
      </button>
      <span className="font-mono text-3xl font-bold text-glow-2">{value}</span>
      <button
        type="button"
        aria-label={`${label} score down`}
        disabled={disabled}
        onClick={() => onChange(Math.max(0, value - 1))}
        className="h-7 w-10 rounded-md border border-line bg-white/5 text-xs hover:bg-glow disabled:opacity-40"
      >
        ▼
      </button>
    </div>
  );
}

export function PlayPanel() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient();
  const pollForEffect = usePollForEffect();

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [busy, setBusy] = useState<"enter" | "predict" | null>(null);
  const [message, setMessage] = useState<string>("");
  const [now, setNow] = useState<number | null>(null); // client-mounted clock (SSR safety)

  useEffect(() => {
    const update = () => setNow(Math.floor(Date.now() / 1000));
    const first = setTimeout(update, 0); // async first tick keeps hydration clean
    const t = setInterval(update, 1_000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, []);

  const game = useReadContract({ ...contract, functionName: "game" });
  const pool = useReadContract({ ...contract, functionName: "pool" });
  const entryCount = useReadContract({ ...contract, functionName: "entryCount" });
  const entered = useReadContract({
    ...contract,
    functionName: "entered",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const prediction = useReadContract({
    ...contract,
    functionName: "predictionOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const points = useReadContract({
    ...contract,
    functionName: "pointsOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  if (!PREDICTOR_ADDRESS) {
    return (
      <p className="font-mono text-sm text-muted">
        NEXT_PUBLIC_PREDICTOR_ADDRESS is not set — deploy the contract (slice 02) and
        add the proxy address to .env.local.
      </p>
    );
  }

  const [kickoff, , teamA, teamB] = game.data ?? [0, 0, "0x000000", "0x000000"];
  const lockAt = Number(kickoff) - PREDICTION_LOCKOUT_SECONDS;
  const secondsToLock = now === null ? null : lockAt - now;
  const locked = secondsToLock !== null && secondsToLock <= 0;
  const teamName = (hex: string) => hexToString(hex as `0x${string}`, { size: 3 });
  const submitted = prediction.data ? unpackPrediction(prediction.data).submitted : false;
  const current = prediction.data ? unpackPrediction(prediction.data) : null;

  async function handleEnter() {
    setBusy("enter");
    setMessage("Confirm the 550 CHZ entry in your wallet…");
    try {
      await writeContractAsync({ ...contract, functionName: "enter", value: ENTRY_GROSS_WEI });
    } catch {
      /* SCW relay may reject the local wait — the poll below decides */
    }
    setMessage("Waiting for the entry to land on-chain…");
    const ok = await pollForEffect(async () => {
      if (!client || !address) return false;
      return (await client.readContract({
        ...contract,
        functionName: "entered",
        args: [address],
      })) as boolean;
    });
    setMessage(ok ? "You're in the pool — set your scoreline below." : "Entry not confirmed after 120s — check your wallet and Chiliscan.");
    await Promise.all([entered.refetch(), pool.refetch(), entryCount.refetch()]);
    setBusy(null);
  }

  async function handlePredict() {
    const packed = packPrediction(scoreA, scoreB);
    setBusy("predict");
    setMessage(submitted ? "Confirm your edited prediction…" : "Confirm your prediction…");
    try {
      await writeContractAsync({ ...contract, functionName: "submitPrediction", args: [packed] });
    } catch {
      /* see above */
    }
    setMessage("Waiting for the prediction to land on-chain…");
    const ok = await pollForEffect(async () => {
      if (!client || !address) return false;
      const p = (await client.readContract({
        ...contract,
        functionName: "predictionOf",
        args: [address],
      })) as bigint;
      return p === packed;
    });
    setMessage(
      ok
        ? `Prediction ${teamName(teamA as string)} ${scoreA}–${scoreB} ${teamName(teamB as string)} locked in — you can edit it until 60 min before kickoff.`
        : "Prediction not confirmed after 120s — check your wallet and Chiliscan.",
    );
    await prediction.refetch();
    setBusy(null);
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-line bg-night-2/60 p-6">
      <div className="flex items-center justify-between font-mono text-xs text-muted">
        <span>
          Pool: {pool.data !== undefined ? `${Number(pool.data / 10n ** 18n).toLocaleString("en-US")} CHZ` : "…"}
        </span>
        <span>Predictors: {entryCount.data?.toString() ?? "…"}</span>
      </div>

      {!isConnected ? (
        <button
          type="button"
          onClick={() => open()}
          className="rounded-xl bg-gradient-to-b from-chz-2 to-chz px-5 py-3 font-semibold text-white"
        >
          Connect Wallet
        </button>
      ) : !entered.data ? (
        <button
          type="button"
          disabled={busy !== null}
          onClick={handleEnter}
          className="rounded-xl bg-gradient-to-b from-chz-2 to-chz px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy === "enter" ? "Entering…" : "Pay 550 CHZ & enter"}
        </button>
      ) : (
        <>
          <div className="flex items-center justify-center gap-6">
            <span className="font-semibold">{teamName(teamA as string)}</span>
            <Stepper label="home" value={scoreA} onChange={setScoreA} disabled={locked || busy !== null} />
            <span className="font-mono text-muted-2">:</span>
            <Stepper label="away" value={scoreB} onChange={setScoreB} disabled={locked || busy !== null} />
            <span className="font-semibold">{teamName(teamB as string)}</span>
          </div>
          <button
            type="button"
            disabled={locked || busy !== null}
            onClick={handlePredict}
            className="rounded-xl bg-gradient-to-b from-glow-2 to-glow px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy === "predict"
              ? "Submitting…"
              : locked
                ? "Predictions locked 🔒"
                : submitted
                  ? "Edit prediction (re-pays ~$0.05 gas)"
                  : "Lock in prediction"}
          </button>
          {current?.submitted && (
            <p className="text-center font-mono text-xs text-ok">
              On-chain: {teamName(teamA as string)} {current.scoreA}–{current.scoreB}{" "}
              {teamName(teamB as string)}
            </p>
          )}
          {secondsToLock !== null && secondsToLock > 0 && (
            <p className="text-center font-mono text-xs text-muted">
              Locks in {Math.floor(secondsToLock / 86400)}d{" "}
              {Math.floor((secondsToLock % 86400) / 3600)}h{" "}
              {Math.floor((secondsToLock % 3600) / 60)}m
            </p>
          )}
          {points.data !== undefined && points.data > 0n && (
            <p className="text-center font-mono text-sm text-star">
              ★ You scored {points.data.toString()} points
            </p>
          )}
        </>
      )}

      {message && <p className="text-center font-mono text-xs text-muted">{message}</p>}
    </div>
  );
}
