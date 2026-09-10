"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { PREDICTOR_ABI, PREDICTOR_ADDRESS, STAGE_KNOCKOUT, STAGE_LEAGUE } from "@/lib/predictor/abi";
import {
  isSelfRow,
  rowsForView,
  stageFor,
  type StandingRow,
  type StageView,
} from "@/lib/predictor/standings";
import {
  NO_STAGES,
  STAGE_STATUS,
  parseStandingsPayload,
  type StageInfo,
  type StagesInfo,
} from "@/lib/predictor/standingsPayload";
import { formatCountdown } from "@/lib/predictor/slate";
import {
  CLAIM_CHALLENGE_SECONDS,
  STAGE_FLOOR,
  formatChzWei,
  projectedPayouts,
} from "@/lib/economics";
import { useNow } from "@/hooks/useNow";
import { InfoPopover } from "@/components/ui/InfoPopover";
import { BoardRow } from "./BoardRow";
import { PoolStrip } from "./PoolStrip";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;

/** view key → messages key for its label (translated at render). */
const VIEWS: { key: StageView; labelKey: "viewLeague" | "viewKnockout" | "viewSeason" }[] = [
  { key: "league", labelKey: "viewLeague" },
  { key: "knockout", labelKey: "viewKnockout" },
  { key: "season", labelKey: "viewSeason" },
];

/** SCW-safe confirmation: poll until check passes (~120s) — never await receipts. */
async function pollUntil(check: () => Promise<boolean>): Promise<boolean> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 3_000));
  }
  return false;
}

function ClaimBanner({ now }: { now: number | null }) {
  const t = useTranslations("standings");
  const { address } = useAccount();
  const client = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  const claimableLeague = useReadContract({
    ...contract,
    functionName: "claimable",
    args: address ? [STAGE_LEAGUE, address] : undefined,
    query: { enabled: !!address },
  });
  const claimableKO = useReadContract({
    ...contract,
    functionName: "claimable",
    args: address ? [STAGE_KNOCKOUT, address] : undefined,
    query: { enabled: !!address },
  });
  // claim() reverts for CLAIM_CHALLENGE_WINDOW after the freeze (H-2b) — read
  // the freeze time so the button waits instead of failing in the wallet.
  const frozenAtLeague = useReadContract({
    ...contract,
    functionName: "stageFrozenAt",
    args: [STAGE_LEAGUE],
    query: { enabled: (claimableLeague.data ?? 0n) > 0n },
  });
  const frozenAtKO = useReadContract({
    ...contract,
    functionName: "stageFrozenAt",
    args: [STAGE_KNOCKOUT],
    query: { enabled: (claimableKO.data ?? 0n) > 0n },
  });

  async function handleClaim(stage: number, refetch: () => Promise<unknown>) {
    setBusy(stage);
    setMessage(t("claim.confirm"));
    try {
      await writeContractAsync({ ...contract, functionName: "claim", args: [stage] });
    } catch {
      /* SCW relay — the poll decides */
    }
    // poll-for-effect: claimable drops to zero when the claim lands
    const ok = await pollUntil(async () => {
      if (!client || !address) return false;
      return (
        ((await client.readContract({
          ...contract,
          functionName: "claimable",
          args: [stage, address],
        })) as bigint) === 0n
      );
    });
    setMessage(ok ? t("claim.claimed") : t("claim.notConfirmed"));
    await refetch();
    setBusy(null);
  }

  const banners = [
    { stage: STAGE_LEAGUE, label: t("viewLeague"), data: claimableLeague, frozenAt: frozenAtLeague.data },
    { stage: STAGE_KNOCKOUT, label: t("viewKnockout"), data: claimableKO, frozenAt: frozenAtKO.data },
  ].filter((b) => (b.data.data ?? 0n) > 0n);

  if (banners.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {banners.map((b) => {
        const opensAt = b.frozenAt === undefined ? null : Number(b.frozenAt) + CLAIM_CHALLENGE_SECONDS;
        const waiting = opensAt !== null && now !== null && now < opensAt;
        return (
          <div
            key={b.stage}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ok/40 bg-ok/10 px-5 py-4"
          >
            <p className="font-mono text-sm text-ok">
              {t("claim.banner", { stage: b.label, amount: formatChzWei(b.data.data!) })}
            </p>
            <button
              type="button"
              disabled={busy !== null || waiting}
              onClick={() => handleClaim(b.stage, b.data.refetch)}
              className="rounded-xl bg-gradient-to-b from-chz-2 to-chz px-5 py-2 font-semibold text-white disabled:opacity-50"
            >
              {waiting
                ? t("claim.opensIn", { countdown: formatCountdown(opensAt! - now!) })
                : busy === b.stage
                  ? t("claim.claiming")
                  : t("claim.cta")}
            </button>
          </div>
        );
      })}
      {message && <p className="font-mono text-xs text-muted">{message}</p>}
    </div>
  );
}

function ScoringInfo() {
  const t = useTranslations("standings");
  const rows: { pts: string; key: "scoringInfo.exact" | "scoringInfo.outcomeGd" | "scoringInfo.outcome" }[] = [
    { pts: "5", key: "scoringInfo.exact" },
    { pts: "3", key: "scoringInfo.outcomeGd" },
    { pts: "1", key: "scoringInfo.outcome" },
  ];
  return (
    <InfoPopover
      label={t("scoringInfo.label")}
      title={t("scoringInfo.title")}
      closeLabel={t("info.close")}
      moreHref="/terms#scoring"
      moreLabel={t("info.fullRules")}
      align="end"
    >
      <ul className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <li key={r.key} className="flex items-baseline gap-3">
            <span className="w-6 shrink-0 text-right font-mono font-bold text-star">{r.pts}</span>
            <span>{t(r.key)}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-3 flex flex-col gap-1.5 border-t border-line-soft pt-3 text-xs text-muted">
        <li>{t("scoringInfo.deciders")}</li>
        <li>{t("scoringInfo.ninety")}</li>
        <li>{t("scoringInfo.ties")}</li>
        <li>{t("scoringInfo.provisional")}</li>
      </ul>
    </InfoPopover>
  );
}

export function StandingsPanel() {
  const t = useTranslations("standings");
  const now = useNow();
  const { address } = useAccount();
  const [view, setView] = useState<StageView>("season");
  const [rows, setRows] = useState<StandingRow[] | null>(null);
  const [stages, setStages] = useState<StagesInfo>(NO_STAGES);
  const [hasProvisional, setHasProvisional] = useState(false);
  const [error, setError] = useState("");

  /**
   * One request. The whole board — entrants, points, exact counts, entry
   * times, usernames, flags, the provisional badge and both pots — is derived
   * server-side in /api/standings and cached at the edge. The browser used to
   * derive it itself: ~450 serial eth_calls plus one /api/profile round trip
   * per entrant, which is tens of seconds before the first row appears.
   */
  const load = useCallback(async () => {
    if (!PREDICTOR_ADDRESS) return;
    try {
      const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "88882");
      const res = await fetch(`/api/standings?chainId=${chainId}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `standings unavailable (${res.status})`);
      }
      const parsed = parseStandingsPayload(await res.json());
      setRows(parsed.rows);
      setStages(parsed.stages);
      setHasProvisional(parsed.hasProvisional);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  if (!PREDICTOR_ADDRESS) {
    return <p className="font-mono text-sm text-muted">{t("notConfigured")}</p>;
  }

  const sorted = rows ? rowsForView(rows, view) : null;
  const stage = stageFor(stages, view);
  const payouts = prizeColumn(stage);
  const showPrize = payouts !== null;
  const columnCount = view === "season" ? 5 : showPrize ? 4 : 3;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <ClaimBanner now={now} />
      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            aria-pressed={view === v.key}
            onClick={() => setView(v.key)}
            className={`rounded-full border px-4 py-2 font-mono text-xs ${
              view === v.key ? "border-glow-2 text-glow-2" : "border-line text-muted"
            }`}
          >
            {t(v.labelKey)}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          {hasProvisional && (
            <span className="rounded-full border border-star/40 px-3 py-1 font-mono text-xs text-star">
              {t("provisional")}
            </span>
          )}
          <ScoringInfo />
        </div>
      </div>

      <PoolStrip view={view} stage={stage} now={now} />

      <div className="overflow-x-auto rounded-2xl border border-line bg-night-2/60">
        <table className="w-full text-sm">
          <thead>
            {/* headers shrink first on a phone: five columns have to fit ~360px */}
            <tr className="border-b border-line-soft font-mono text-[10px] uppercase tracking-wide text-muted sm:text-xs sm:tracking-widest">
              <th className="px-2 py-2.5 text-left sm:px-4 sm:py-3">{t("colRank")}</th>
              <th className="px-2 py-2.5 text-left sm:px-4 sm:py-3">
                <ColHead full={t("colPredictor")} short={t("colPredictorShort")} />
              </th>
              {view === "season" && (
                <th className="px-2 py-2.5 text-right sm:px-4 sm:py-3">
                  <ColHead full={t("colLeague")} short={t("colLeagueShort")} />
                </th>
              )}
              {view === "season" && (
                <th className="px-2 py-2.5 text-right sm:px-4 sm:py-3">
                  <ColHead full={t("colKnockout")} short={t("colKnockoutShort")} />
                </th>
              )}
              <th className="px-2 py-2.5 text-right sm:px-4 sm:py-3">{t("colPoints")}</th>
              {showPrize && (
                <th className="px-2 py-2.5 text-right sm:px-4 sm:py-3">
                  {/* phones get the unit as the header so the cells stay bare numbers */}
                  <ColHead full={t(stage?.frozen ? "colWon" : "colPrize")} short={t("colPrizeShort")} />
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted === null ? (
              <tr>
                <td colSpan={columnCount} className="px-2 py-6 text-center font-mono text-xs text-muted sm:px-4">
                  {t("reading")}
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-2 py-6 text-center font-mono text-xs text-muted sm:px-4">
                  {/* an empty board after a failed read is a read failure, not an empty pool */}
                  {error ? t("unavailable") : t("noEntrants")}
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => (
                <BoardRow
                  key={r.address}
                  row={r}
                  rank={i + 1}
                  view={view}
                  isSelf={isSelfRow(r.address, address)}
                  payout={payouts && i < payouts.length ? payouts[i]! : null}
                  showPrize={showPrize}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-xs text-muted-2">{t("footnote")}</p>
      {error && <p className="font-mono text-xs text-chz-2">{error}</p>}
    </div>
  );
}

/**
 * What each rank would be credited if the stage froze on its pool now — the
 * contract's own split (lib/economics mirrors _shareFor). null = no prize
 * column: Season View (no pot), an unknown pot, a VOID stage, a stage still
 * under the floor (it would void, not pay), or a frozen stage whose freeze
 * snapshot could not be read (better no amounts than wrong ones).
 */
function prizeColumn(stage: StageInfo | null): bigint[] | null {
  if (!stage || stage.status === STAGE_STATUS.VOID || stage.entryCount < STAGE_FLOOR) return null;
  const pool = stage.frozen ? stage.poolAtFreeze : stage.pool;
  return pool === null ? null : projectedPayouts(pool, stage.entryCount);
}

/**
 * A column header, with a phone-sized alternative. The header words set the
 * table's minimum width, so a locale whose term is long enough to force
 * horizontal scroll ships a shorter one: Italian "Pronosticatore"/"Eliminazione"
 * overflow 360px by ~22px, and French "Elim. directe" wraps to two lines.
 * Locales that already fit set short === full and render a single node.
 */
function ColHead({ full, short }: { full: string; short: string }) {
  if (full === short) return <>{full}</>;
  return (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{full}</span>
    </>
  );
}
