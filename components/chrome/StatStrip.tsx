"use client";

import { useTranslations } from "next-intl";
import { useReadContract } from "wagmi";
import { PREDICTOR_ABI, PREDICTOR_ADDRESS, STAGE_KNOCKOUT, STAGE_LEAGUE } from "@/lib/predictor/abi";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;

function Stat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent: "glow" | "chz" | "star";
}) {
  const bar =
    accent === "chz"
      ? "from-chz to-transparent"
      : accent === "star"
        ? "from-star to-transparent"
        : "from-glow to-transparent";
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-white/[0.02] px-5 py-5 text-left">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${bar}`} />
      <p className="font-display text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{label}</p>
    </div>
  );
}

/** Mock's stat strip — predictors, live pools, match count, from chain. */
export function StatStrip() {
  const t = useTranslations("stats");
  const league = useReadContract({ ...contract, functionName: "stages", args: [BigInt(STAGE_LEAGUE)], query: { enabled: !!PREDICTOR_ADDRESS } });
  const knockout = useReadContract({ ...contract, functionName: "stages", args: [BigInt(STAGE_KNOCKOUT)], query: { enabled: !!PREDICTOR_ADDRESS } });
  const matchCount = useReadContract({ ...contract, functionName: "matchCount", query: { enabled: !!PREDICTOR_ADDRESS } });

  if (!PREDICTOR_ADDRESS) return null;
  const chz = (wei?: bigint) =>
    wei === undefined ? "…" : `${Number(wei / 10n ** 18n).toLocaleString("en-US")}`;
  const predictors =
    league.data && knockout.data
      ? Math.max(Number(league.data[3]), Number(knockout.data[3])).toLocaleString("en-US")
      : "…";
  const pool =
    league.data && knockout.data ? chz(league.data[4] + knockout.data[4]) : "…";

  return (
    <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
      <Stat value={predictors} label={t("predictors")} accent="glow" />
      <Stat value={`${pool} CHZ`} label={t("prizePools")} accent="chz" />
      <Stat value={matchCount.data?.toString() ?? "…"} label={t("matchesOnChain")} accent="star" />
    </div>
  );
}
