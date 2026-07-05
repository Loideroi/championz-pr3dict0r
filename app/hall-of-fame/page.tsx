import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HallOfFame } from "./HallOfFame";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("hallOfFame.metadata");
  return { title: t("title") };
}

export default async function HallOfFamePage() {
  const t = await getTranslations("hallOfFame");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-star">
        {t("tagline")}
      </p>
      <h1 className="font-display text-4xl font-black uppercase tracking-tight">
        {t("heading")}
      </h1>
      <HallOfFame />
    </main>
  );
}
