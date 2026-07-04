"use client";

import type { SlateChange } from "@/lib/predictor/slate";

export type NamedChange = SlateChange & { teamA: string; teamB: string };

const fmt = (p: { scoreA: number; scoreB: number } | null) =>
  p ? `${p.scoreA}–${p.scoreB}` : "—";

/**
 * Batch submit bar (PRD §6/§10.4): every staged change is shown as an
 * old → new diff *before* signing, one transaction covers the whole
 * matchday, and the gas copy states the real cost (~$0.05 / ~1.1 CHZ for a
 * full 18-match batch — edits simply re-pay it).
 */
export function SubmitBar({
  changes,
  busy,
  onSubmit,
  onDiscardAll,
}: {
  changes: NamedChange[];
  busy: boolean;
  onSubmit: () => void;
  onDiscardAll: () => void;
}) {
  if (changes.length === 0) return null;
  const edits = changes.filter((c) => c.old !== null).length;

  return (
    <div className="sticky bottom-4 flex flex-col gap-3 rounded-2xl border border-glow/50 bg-night-3/95 p-4 shadow-lg shadow-night/60 backdrop-blur">
      <p className="font-mono text-xs uppercase tracking-widest text-glow-2">
        Review before signing — {changes.length}{" "}
        {changes.length === 1 ? "change" : "changes"}
        {edits > 0 && ` (${edits} ${edits === 1 ? "edit" : "edits"})`}
      </p>
      <ul className="flex flex-col gap-1 font-mono text-sm">
        {changes.map((c) => (
          <li key={c.matchId} className="flex items-baseline gap-2">
            <span className="w-24 shrink-0 text-muted">
              {c.teamA}–{c.teamB}
            </span>
            {c.old !== null ? (
              <>
                <s className="text-muted-2">{fmt(c.old)}</s>
                <span className="text-muted-2">→</span>
                <span className="font-bold text-glow-2">{fmt(c.next)}</span>
              </>
            ) : (
              <>
                <span className="text-muted-2">new →</span>
                <span className="font-bold text-glow-2">{fmt(c.next)}</span>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={onSubmit}
          className="rounded-xl bg-gradient-to-b from-glow-2 to-glow px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy
            ? "Submitting…"
            : `Lock in ${changes.length} prediction${changes.length === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDiscardAll}
          className="rounded-xl border border-line px-4 py-3 text-sm text-muted hover:bg-white/5 disabled:opacity-40"
        >
          Discard all
        </button>
      </div>
      <p className="font-mono text-xs text-muted">
        One transaction for the whole matchday — a full 18-match batch costs ≈ 1.1
        CHZ (~$0.05) in gas. Editing later just re-pays it.
      </p>
    </div>
  );
}
