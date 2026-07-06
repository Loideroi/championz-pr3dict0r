import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlayPanel } from "./PlayPanel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("play.metadata");
  return { title: t("title") };
}

export default async function PlayPage() {
  const t = await getTranslations("play");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-glow-2">
        {t("tagline")}
      </p>
      <h1 className="font-display text-4xl font-black uppercase tracking-tight">
        {t("heading")}
      </h1>
      <p className="max-w-md text-center text-sm text-muted">{t("intro")}</p>
      <PlayPanel />
    </main>
  );
}
