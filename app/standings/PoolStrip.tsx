"use client";

import { useTranslations } from "next-intl";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { CLAIM_CHALLENGE_SECONDS, PAYOUT_SPLIT, STAGE_FLOOR, formatChzWei } from "@/lib/economics";
import { formatCountdown } from "@/lib/predictor/slate";
import { STAGE_STATUS, type StageInfo } from "@/lib/predictor/standingsPayload";
import type { StageView } from "@/lib/predictor/standings";

/**
 * One line above the table saying which pot this view pays from, how big it
 * is right now, and — once frozen — when claims open. Season View gets the
 * opposite message: no pot, crown only. This is where "each stage has its own
 * prize pool" stops being a sentence in the terms.
 */
export function PoolStrip({
  view,
  stage,
  now,
}: {
  view: StageView;
  /** null = pot unknown (API predates pots, or malformed) — render nothing. */
  stage: StageInfo | null;
  /** client clock, unix seconds; null until mounted */
  now: number | null;
}) {
  const t = useTranslations("standings");

  if (view === "season") {
    return <p className="font-mono text-xs text-muted-2">{t("pool.season")}</p>;
  }
  if (!stage) return null;

  const name = t(view === "league" ? "pool.league" : "pool.knockout");
  let line: string;
  if (stage.status === STAGE_STATUS.VOID) {
    line = t("pool.void", { name, floor: STAGE_FLOOR });
  } else if (stage.frozen) {
    if (stage.poolAtFreeze === null) {
      line = t("pool.frozenNoAmount", { name });
    } else {
      const opensAt = Number(stage.frozenAt) + CLAIM_CHALLENGE_SECONDS;
      const claims =
        now === null
          ? ""
          : now < opensAt
            ? ` · ${t("pool.claimsIn", { countdown: formatCountdown(opensAt - now) })}`
            : ` · ${t("pool.claimsOpen")}`;
      line = t("pool.frozen", { name, pool: formatChzWei(stage.poolAtFreeze) }) + claims;
    }
  } else if (stage.entryCount < STAGE_FLOOR) {
    line = t("pool.belowFloor", {
      name,
      pool: formatChzWei(stage.pool),
      count: stage.entryCount,
      floor: STAGE_FLOOR,
    });
  } else {
    line = t("pool.live", { name, pool: formatChzWei(stage.pool), count: stage.entryCount });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line-soft bg-night-2/40 px-4 py-2 font-mono text-xs text-muted">
      <span className="min-w-0 flex-1">{line}</span>
      <InfoPopover
        label={t("potInfo.label")}
        title={t("potInfo.title")}
        closeLabel={t("info.close")}
        moreHref="/terms#prizes"
        moreLabel={t("info.fullRules")}
        align="end"
      >
        <ul className="flex flex-col gap-1.5 font-mono text-xs">
          <li className="text-star">{t("potInfo.rank1", { pct: PAYOUT_SPLIT.first })}</li>
          <li className="text-star">{t("potInfo.rank2", { pct: PAYOUT_SPLIT.second })}</li>
          <li className="text-star">{t("potInfo.rank3", { pct: PAYOUT_SPLIT.third })}</li>
          <li>{t("potInfo.rank4to10", { pct: PAYOUT_SPLIT.ranks4to10 })}</li>
          <li>{t("potInfo.rank11to20", { pct: PAYOUT_SPLIT.ranks11to20 })}</li>
          <li className="text-muted-2">{t("potInfo.dust")}</li>
        </ul>
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-line-soft pt-3 text-xs text-muted">
          <li>{t("potInfo.separate")}</li>
          <li>{t("potInfo.claims")}</li>
          <li>{t("potInfo.nonRefundable")}</li>
        </ul>
      </InfoPopover>
    </div>
  );
}
