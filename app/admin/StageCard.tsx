"use client";

import {
  freezeBlocker,
  freezeCallable,
  lockHint,
  stageNeedsFreeze,
  type StagePlay,
} from "@/lib/admin/health";

export type StageTuple = readonly [number, number, number, number, bigint, bigint];

type Props = {
  label: string;
  /** stages(stage) tuple: openAt, closeAt, status, entryCount, pool, feeEscrow */
  data: StageTuple | undefined;
  play: StagePlay;
  /** wall clock (s) from the console's ticking clock; 0 before the first tick */
  nowSec: number;
  busy: boolean;
  onLock: () => void;
  onFreeze: () => void;
};

/**
 * One stage of the lifecycle: pot facts, played / frozen state, the lock hint
 * that appears exactly while lockStage is callable, and the two owner
 * actions. The guards mirror the contract's reverts (lib/admin/health.ts).
 */
export function StageCard({ label, data, play: p, nowSec, busy, onLock, onFreeze }: Props) {
  const needsFreeze = stageNeedsFreeze(p);
  const lifecycle = data ? { closeAt: data[1], status: data[2], entryCount: data[3], feeEscrow: data[5] } : null;
  const hint = lifecycle && nowSec ? lockHint(lifecycle, nowSec) : null;
  const canFreeze = data ? freezeCallable(data[2], p) : false;
  const freezeWhy = freezeBlocker(data?.[2], p);
  const chz = (wei: bigint) => Number(wei / 10n ** 18n).toLocaleString("en-US");
  return (
    <div className={`rounded-2xl border p-4 ${needsFreeze ? "border-star/40 bg-star/5" : "border-line bg-night-2/60"}`}>
      <p className="font-mono text-xs uppercase tracking-widest text-glow-2">{label}</p>
      {data && (
        <p className="mt-1 font-mono text-xs text-muted">
          {["SELLING", "LOCKED", "VOID"][data[2]]} · {data[3]} entrants · {chz(data[4])} CHZ pool · {chz(data[5])} CHZ fee escrow
        </p>
      )}
      <p className="mt-1 font-mono text-xs text-muted">
        {p.total === 0
          ? "no matches on-chain"
          : `${p.completed}/${p.total - p.voided} played${p.voided ? ` · ${p.voided} voided` : ""}`}{" "}
        · {p.frozen ? "🧊 frozen" : "not frozen"}
      </p>
      {hint && <p className="mt-1 font-mono text-xs text-star">{hint}</p>}
      {needsFreeze && (
        <p className="mt-1 font-mono text-xs text-star">
          {p.provisional > 0
            ? `Fully played — ${p.provisional} result(s) still inside the 24h provisional window; freeze opens when it closes.`
            : "Fully played — freeze so winners can claim (the bot is nagging about this too)."}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onLock}
          className="rounded-lg border border-line px-3 py-1.5 font-mono text-xs disabled:opacity-40"
        >
          lockStage
        </button>
        <button
          type="button"
          disabled={busy || !canFreeze}
          title={canFreeze ? "compute the top-20 from chain state and freeze the payout" : freezeWhy}
          onClick={onFreeze}
          className="rounded-lg border border-star/40 px-3 py-1.5 font-mono text-xs text-star disabled:opacity-40"
        >
          freezeStage (auto-ranked)
        </button>
      </div>
    </div>
  );
}
