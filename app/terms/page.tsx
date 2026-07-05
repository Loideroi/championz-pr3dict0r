import { isTermsLocale, type TermsLocaleCode } from "@/content/terms";
import { TermsView } from "./TermsView";

export const metadata = {
  title: "Terms & Conditions — ₵h@mpi0nz Pr3dict0r",
};

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const locale: TermsLocaleCode = isTermsLocale(lang) ? lang : "en";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.32em] text-glow-2">
        Funnier than the predecessor · still binding
      </p>
      <TermsView locale={locale} />
    </main>
  );
}
