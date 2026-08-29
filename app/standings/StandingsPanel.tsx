"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { PREDICTOR_ABI, PREDICTOR_ADDRESS, STAGE_KNOCKOUT, STAGE_LEAGUE } from "@/lib/predictor/abi";
import {
  flagEmoji,
  pointsFor,
  rowsForView,
  type StandingRow,
  type StageView,
} from "@/lib/predictor/standings";
import { parseStandingsPayload } from "@/lib/predictor/standingsPayload";

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

function ClaimBanner() {
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
    { stage: STAGE_LEAGUE, label: t("viewLeague"), data: claimableLeague },
    { stage: STAGE_KNOCKOUT, label: t("viewKnockout"), data: claimableKO },
  ].filter((b) => (b.data.data ?? 0n) > 0n);

  if (banners.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {banners.map((b) => (
        <div
          key={b.stage}
          className="flex items-center justify-between rounded-2xl border border-ok/40 bg-ok/10 px-5 py-4"
        >
          <p className="font-mono text-sm text-ok">
            {t("claim.banner", {
              stage: b.label,
              amount: (Number(b.data.data! / 10n ** 15n) / 1000).toLocaleString("en-US"),
            })}
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => handleClaim(b.stage, b.data.refetch)}
            className="rounded-xl bg-gradient-to-b from-chz-2 to-chz px-5 py-2 font-semibold text-white disabled:opacity-50"
          >
            {busy === b.stage ? t("claim.claiming") : t("claim.cta")}
          </button>
        </div>
      ))}
      {message && <p className="font-mono text-xs text-muted">{message}</p>}
    </div>
  );
}

export function StandingsPanel() {
  const t = useTranslations("standings");
  const [view, setView] = useState<StageView>("season");
  const [rows, setRows] = useState<StandingRow[] | null>(null);
  const [hasProvisional, setHasProvisional] = useState(false);
  const [error, setError] = useState("");

  /**
   * One request. The whole board — entrants, points, exact counts, entry
   * times, usernames, flags and the provisional badge — is derived server-side
   * in /api/standings and cached at the edge. The browser used to derive it
   * itself: ~450 serial eth_calls plus one /api/profile round trip per
   * entrant, which is tens of seconds before the first row appears.
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

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4">
      <ClaimBanner />
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
        {hasProvisional && (
          <span className="ml-auto rounded-full border border-star/40 px-3 py-1 font-mono text-xs text-star">
            {t("provisional")}
          </span>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-night-2/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-soft font-mono text-xs uppercase tracking-widest text-muted">
              <th className="px-4 py-3 text-left">{t("colRank")}</th>
              <th className="px-4 py-3 text-left">{t("colPredictor")}</th>
              {view === "season" && <th className="px-4 py-3 text-right">{t("colLeague")}</th>}
              {view === "season" && <th className="px-4 py-3 text-right">{t("colKnockout")}</th>}
              <th className="px-4 py-3 text-right">{t("colPoints")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted === null ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center font-mono text-xs text-muted">
                  {t("reading")}
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center font-mono text-xs text-muted">
                  {/* an empty board after a failed read is a read failure, not an empty pool */}
                  {error ? t("unavailable") : t("noEntrants")}
                </td>
              </tr>
            ) : (
              sorted.map((r, i) => (
                <tr key={r.address} className="border-b border-line-soft last:border-0">
                  <td className="px-4 py-3 font-mono text-muted">
                    {view === "season" && i === 0 ? "👑" : i + 1}
                  </td>
                  <td className="px-4 py-3">
                    <span aria-hidden>{flagEmoji(r.countryCode) || "🌐"}</span>{" "}
                    {r.username ? (
                      <span className="font-semibold">{r.username}</span>
                    ) : (
                      <span className="text-muted">{t("anonymous")}</span>
                    )}{" "}
                    <span className="font-mono text-xs text-muted-2">
                      {r.address.slice(0, 6)}…{r.address.slice(-4)}
                    </span>
                    {!r.fullSeason && (
                      <span className="ml-2 rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-muted">
                        {t("koPass")}
                      </span>
                    )}
                  </td>
                  {view === "season" && (
                    <td className="px-4 py-3 text-right font-mono text-glow-2">
                      {r.leaguePoints === null ? "—" : r.leaguePoints.toString()}
                    </td>
                  )}
                  {view === "season" && (
                    <td className="px-4 py-3 text-right font-mono text-glow-2">
                      {r.knockoutPoints.toString()}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right font-mono font-bold text-star">
                    {(pointsFor(r, view) ?? 0n).toString()}
                  </td>
                </tr>
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
