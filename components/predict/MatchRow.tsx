"use client";

import { useLocale, useTranslations } from "next-intl";
import { Stepper } from "@/components/predict/Stepper";
import { InsightCard } from "@/components/predict/InsightCard";
import type { AppLocale } from "@/i18n/config";
import {
  formatCountdown,
  formatUtcTime,
  samePick,
  type MatchPhase,
  type ScorePick,
  type SlateMatch,
} from "@/lib/predictor/slate";

const fmtPick = (p: ScorePick) => `${p.scoreA}–${p.scoreB}`;

/**
 * One slate row (PRD §6). Purely presentational — the panel owns all chain
 * state. `secondsToLock` is null until the client clock mounts (SSR safety:
 * the countdown never renders on the server).
 */
export function MatchRow({
  match,
  phase,
  secondsToLock,
  connected,
  entered,
  onchain,
  draft,
  result,
  busy,
  onDraft,
  onEdit,
  onDiscard,
}: {
  match: SlateMatch;
  phase: MatchPhase;
  secondsToLock: number | null;
  connected: boolean;
  entered: boolean;
  onchain: ScorePick | null;
  draft: ScorePick | null;
  result: ScorePick | null;
  busy: boolean;
  onDraft: (pick: ScorePick) => void;
  onEdit: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("predict.matchRow");
  const activeLocale = useLocale() as AppLocale;
  const editable = phase === "open" && connected && entered && !busy;
  const changed = draft !== null && !samePick(draft, onchain);

  return (
    <li
      className={`flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
        changed ? "border-glow/60 bg-night-3/60" : "border-line bg-night-2/60"
      } ${phase === "open" && connected && !entered ? "opacity-60" : ""}`}
    >
      {/* fixture */}
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold">
          {match.teamA} <span className="text-muted-2">{t("vs")}</span> {match.teamB}
        </p>
        <p className="font-mono text-xs text-muted">
          {t("kickoff", { time: formatUtcTime(match.kickoff) })}
          {phase === "open" && secondsToLock !== null && (
            <span className="text-star"> {t("locksIn", { countdown: formatCountdown(secondsToLock) })}</span>
          )}
        </p>
        {/* Pre-match insight (deferred mount — see InsightCard). The on-chain
            match struct has no uefaMatchId, so we thread the internal id. */}
        <InsightCard uefaMatchId={String(match.id)} locale={activeLocale} />
      </div>

      {/* state */}
      {phase === "completed" ? (
        <div className="flex items-center gap-4">
          <p className="font-mono text-lg font-bold">
            {t("ft", { score: result ? fmtPick(result) : "—" })}
          </p>
          <p className={`font-mono text-xs ${onchain && result && samePick(onchain, result) ? "text-star" : "text-muted"}`}>
            {onchain ? t("yourPick", { score: fmtPick(onchain) }) : t("noPrediction")}
          </p>
        </div>
      ) : phase === "locked" ? (
        <div className="flex items-center gap-3">
          <span aria-hidden>🔒</span>
          <p className="font-mono text-sm text-muted">
            {onchain ? (
              <>
                {t("finalPick")} <span className="font-bold text-ink">{fmtPick(onchain)}</span>
              </>
            ) : (
              t("lockedNoPrediction")
            )}
          </p>
        </div>
      ) : !connected ? (
        <p className="font-mono text-xs text-muted">{t("connectToPredict")}</p>
      ) : !entered ? (
        <a href="/enter" className="font-mono text-sm text-chz-2 underline underline-offset-4">
          {t("enterFirst")}
        </a>
      ) : draft === null && onchain !== null ? (
        // submitted, still open — editing is a feature, not a loophole
        <div className="flex items-center gap-4">
          <p className="font-mono text-lg font-bold text-ok">{fmtPick(onchain)}</p>
          <button
            type="button"
            disabled={!editable}
            onClick={onEdit}
            className="rounded-lg border border-line bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-glow disabled:opacity-40"
          >
            {t("edit")}
          </button>
        </div>
      ) : (
        // steppers: fresh pick or an in-flight edit
        <div className="flex items-center gap-3">
          <Stepper
            label={t("homeScoreLabel", { teamA: match.teamA, teamB: match.teamB })}
            value={draft?.scoreA ?? 0}
            disabled={!editable}
            onChange={(v) => onDraft({ scoreA: v, scoreB: draft?.scoreB ?? 0 })}
          />
          <span className="font-mono text-muted-2">:</span>
          <Stepper
            label={t("awayScoreLabel", { teamA: match.teamA, teamB: match.teamB })}
            value={draft?.scoreB ?? 0}
            disabled={!editable}
            onChange={(v) => onDraft({ scoreA: draft?.scoreA ?? 0, scoreB: v })}
          />
          <div className="flex w-24 flex-col items-start gap-1">
            {draft === null ? (
              <button
                type="button"
                disabled={!editable}
                onClick={() => onDraft({ scoreA: 0, scoreB: 0 })}
                className="font-mono text-xs text-glow-2 underline underline-offset-4 disabled:opacity-40"
              >
                {t("stageZero")}
              </button>
            ) : (
              <>
                {onchain !== null && (
                  <p className="font-mono text-xs text-muted">
                    {t("was")} <s>{fmtPick(onchain)}</s>
                  </p>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDiscard}
                  className="font-mono text-xs text-muted underline underline-offset-4 disabled:opacity-40"
                >
                  {t("discard")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
