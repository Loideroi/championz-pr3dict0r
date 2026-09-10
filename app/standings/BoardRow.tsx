"use client";

import { useTranslations } from "next-intl";
import { flagEmoji, pointsFor, type StandingRow, type StageView } from "@/lib/predictor/standings";
import { formatChzWei } from "@/lib/economics";

/**
 * One row of the board, extracted from StandingsPanel so the panel stays under
 * the 400-line ceiling and this row's own branching stays under the complexity
 * one — the map callback it used to live in was doing both jobs at once.
 *
 * The wash is capped at 8%: measured against this palette in oklab (the space
 * `color-mix` actually composites in), 8% leaves `muted-2` at 4.56:1 and `chz`
 * at 4.73:1, while 10% drops both under the 4.5:1 AA floor — and `muted-2` is
 * the truncated address, `chz` the prize figure, i.e. the two things you most
 * want to read on your own row. Do not deepen it without re-measuring.
 *
 * `isSelf` marks the connected wallet. The tint alone would be invisible to
 * anyone who can't separate the two blues, so the row is marked three ways:
 * a background wash, an accent bar on the rank cell, and a literal "you" badge
 * that survives greyscale and a screen reader alike.
 */
export function BoardRow({
  row,
  rank,
  view,
  isSelf,
  payout,
  showPrize,
}: {
  row: StandingRow;
  rank: number;
  view: StageView;
  isSelf: boolean;
  payout: bigint | null;
  showPrize: boolean;
}) {
  // two different firsts: the crown is Season View's alone, while the top prize
  // is bold in whichever view is paying (the prize column never shows in Season).
  const crown = view === "season" && rank === 1;
  const topPrize = rank === 1;

  return (
    <tr className={`border-b border-line-soft last:border-0${isSelf ? " bg-glow/8" : ""}`}>
      {/* the accent rides the rank cell (a border on <tr> collapses away in table
          layout) as an inset shadow, which paints no box and so shifts no digit */}
      <td
        className={`px-2 py-2.5 font-mono sm:px-4 sm:py-3 ${
          isSelf ? "shadow-[inset_2px_0_0_var(--glow-2)] font-bold text-glow-2" : "text-muted"
        }`}
      >
        {crown ? "👑" : rank}
      </td>
      {/* the widest cell — it absorbs the squeeze so the rest keep their words intact */}
      <td className="wrap-anywhere px-2 py-2.5 sm:wrap-normal sm:px-4 sm:py-3">
        <PredictorCell row={row} isSelf={isSelf} />
      </td>
      {view === "season" && (
        <td className="px-2 py-2.5 text-right font-mono text-glow-2 sm:px-4 sm:py-3">
          {row.leaguePoints === null ? "—" : row.leaguePoints.toString()}
        </td>
      )}
      {view === "season" && (
        <td className="px-2 py-2.5 text-right font-mono text-glow-2 sm:px-4 sm:py-3">
          {row.knockoutPoints.toString()}
        </td>
      )}
      <td className="px-2 py-2.5 text-right font-mono font-bold text-star sm:px-4 sm:py-3">
        {(pointsFor(row, view) ?? 0n).toString()}
      </td>
      {showPrize && (
        <td
          className={`whitespace-nowrap px-2 py-2.5 text-right font-mono sm:px-4 sm:py-3 ${
            payout === null ? "text-muted-2" : topPrize ? "font-bold text-chz" : "text-chz"
          }`}
        >
          {payout === null ? "—" : formatChzWei(payout)}
        </td>
      )}
    </tr>
  );
}

/** Flag, name, wallet and badges — the one cell that carries prose. */
function PredictorCell({ row, isSelf }: { row: StandingRow; isSelf: boolean }) {
  const t = useTranslations("standings");
  return (
    <>
      <span aria-hidden>{flagEmoji(row.countryCode) || "🌐"}</span>{" "}
      {row.username ? (
        <span className="font-semibold">{row.username}</span>
      ) : (
        <span className="text-muted">{t("anonymous")}</span>
      )}
      {/* the address is the width hog next to the name — phones drop it */}
      <span className="hidden font-mono text-xs text-muted-2 sm:inline">
        {" "}
        {row.address.slice(0, 6)}…{row.address.slice(-4)}
      </span>
      {isSelf && (
        <span className="ml-1 whitespace-nowrap rounded-full border border-glow-2/50 bg-glow/15 px-2 py-0.5 font-mono text-[10px] font-bold text-glow-2 sm:ml-2">
          {t("you")}
        </span>
      )}
      {!row.fullSeason && (
        <span className="ml-1 whitespace-nowrap rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-muted sm:ml-2">
          {t("koPass")}
        </span>
      )}
    </>
  );
}
