import { getTranslations } from "next-intl/server";
import { ENTRY, formatChz } from "@/lib/economics";
import { FixturesNotice } from "@/components/chrome/FixturesNotice";
import { HomeCta } from "@/components/chrome/HomeCta";
import { StatStrip } from "@/components/chrome/StatStrip";
import { TrustBox } from "@/components/chrome/TrustBox";

export default async function Home() {
  const t = await getTranslations("home");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center sm:py-16">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-glow-2">
        {t("tagline")}
      </p>
      <h1 className="font-display text-5xl font-black uppercase tracking-tight sm:text-7xl">
        ₵h@mpi0nz
        <br />
        <span className="bg-gradient-to-b from-glow-soft via-glow-2 to-glow bg-clip-text text-transparent">
          Pr3dict0r
        </span>
      </h1>
      <p className="max-w-xl text-muted">{t("intro")}</p>
      <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-sm">
        <span className="rounded-full border border-line px-4 py-2">
          {t("fullSeasonPill", { amount: formatChz(ENTRY.fullSeason.gross) })}
        </span>
        <span className="rounded-full border border-line px-4 py-2">
          {t("knockoutPill", { amount: formatChz(ENTRY.knockout.gross) })}
        </span>
      </div>
      <FixturesNotice />
      <StatStrip />
      <TrustBox />
      <HomeCta />
    </main>
  );
}
