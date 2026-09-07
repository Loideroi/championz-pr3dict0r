"use client";

import { useTranslations } from "next-intl";
import { useAccount, useReadContract } from "wagmi";
import {
  PREDICTOR_ABI,
  PREDICTOR_ADDRESS,
  STAGE_KNOCKOUT,
  STAGE_LEAGUE,
} from "@/lib/predictor/abi";

const contract = { address: PREDICTOR_ADDRESS, abi: PREDICTOR_ABI } as const;

/**
 * The home page's CTA row. "Enter the pool" is the right ask exactly once —
 * before the wallet holds a pass. This row used to be static server markup, so
 * an entrant landing on the home page was still told to enter a pool they were
 * already in, whether they had just staked or had simply reconnected.
 *
 * `entered` per stage is the same source of truth /enter and /play read, so the
 * three pages can't disagree. Both reads stay idle until a wallet connects,
 * which also means the first client render matches the server's — no hydration
 * mismatch, and no wallet state touched during render.
 *
 * Knockout sales only open once season sales close (D1/D4), so a pass in either
 * stage means there is nothing left to buy: the button goes away rather than
 * leading to a page that can only refuse.
 */
export function HomeCta() {
  const t = useTranslations("home");
  const tEnter = useTranslations("enter");
  const { address } = useAccount();

  const enabled = !!address && !!PREDICTOR_ADDRESS;
  const enteredLeague = useReadContract({
    ...contract,
    functionName: "entered",
    args: address ? [STAGE_LEAGUE, address] : undefined,
    query: { enabled },
  });
  const enteredKnockout = useReadContract({
    ...contract,
    functionName: "entered",
    args: address ? [STAGE_KNOCKOUT, address] : undefined,
    query: { enabled },
  });

  const holdsPass = enteredLeague.data === true || enteredKnockout.data === true;

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-3 sm:w-auto sm:max-w-none">
      {holdsPass && (
        <p className="font-mono text-sm text-ok">
          {enteredLeague.data
            ? tEnter("fullSeason.holdsPass")
            : tEnter("knockout.inPool")}
        </p>
      )}
      {/* Mobile: stacked full-width CTAs so "Enter the pool →" never wraps;
          from sm: the original inline row. */}
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        {!holdsPass && (
          <a
            href="/enter"
            className="rounded-xl bg-gradient-to-b from-chz-2 to-chz px-6 py-3 text-center font-semibold text-white"
          >
            {t("ctaEnter")}
          </a>
        )}
        <a
          href="/play"
          className={
            holdsPass
              ? "rounded-xl bg-gradient-to-b from-chz-2 to-chz px-6 py-3 text-center font-semibold text-white"
              : "rounded-xl border border-line px-6 py-3 text-center font-semibold text-ink"
          }
        >
          {t("ctaPredict")}
        </a>
        <a
          href="/standings"
          className="rounded-xl border border-line px-6 py-3 text-center font-semibold text-ink"
        >
          {t("ctaStandings")}
        </a>
      </div>
    </div>
  );
}
