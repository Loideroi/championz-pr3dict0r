import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EnterPanel } from "./EnterPanel";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("enter.metadata");
  return { title: t("title") };
}

export default async function EnterPage() {
  const t = await getTranslations("enter");
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-glow-2">
        {t("tagline")}
      </p>
      <h1 className="font-display text-4xl font-black uppercase tracking-tight text-center">
        {t("heading")}
      </h1>
      <p className="max-w-lg text-center text-sm text-muted">{t("intro")}</p>
      <EnterPanel />
    </main>
  );
}
