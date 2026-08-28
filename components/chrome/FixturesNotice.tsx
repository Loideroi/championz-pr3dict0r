"use client";

import { useTranslations } from "next-intl";
import { useReadContract } from "wagmi";
import { PREDICTOR_ABI, PREDICTOR_ADDRESS } from "@/lib/predictor/abi";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;

/**
 * Pre-fixtures notice: tells customers WHEN the slate goes live. Reads
 * matchCount from the chain and renders only while it is still 0 — the
 * moment the fixtures land, the notice retires itself. Nothing renders on
 * the server or before the read resolves (no layout flash, SSR-safe).
 */
export function FixturesNotice() {
  const t = useTranslations("fixtures");
  const matchCount = useReadContract({
    ...contract,
    functionName: "matchCount",
    query: { enabled: !!PREDICTOR_ADDRESS },
  });
  if (!PREDICTOR_ADDRESS || matchCount.data === undefined || Number(matchCount.data) > 0) return null;
  return (
    <p
      role="status"
      className="max-w-xl rounded-2xl border border-star/40 bg-star/10 px-5 py-3 text-center font-mono text-xs leading-relaxed text-star"
    >
      {t("notice")}
    </p>
  );
}
