"use client";

import { useRouter } from "next/navigation";
import {
  TERMS_LOCALES,
  TERMS_LOCALE_CODES,
  TERMS_LOCALE_LABELS,
  type TermsLocaleCode,
} from "@/content/terms";

/**
 * Renders one locale's T&Cs with a `?lang=` switcher. The active locale is
 * owned by the server page's searchParams (SSR-safe, shareable by URL);
 * switching replaces the query param rather than holding client state.
 */
export function TermsView({ locale }: { locale: TermsLocaleCode }) {
  const router = useRouter();
  const doc = TERMS_LOCALES[locale];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight">
          {doc.title}
        </h1>
        <p className="font-mono text-xs text-muted">Last updated {doc.updated}</p>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Language">
          {TERMS_LOCALE_CODES.map((code) => (
            <button
              key={code}
              type="button"
              lang={code}
              aria-pressed={code === locale}
              onClick={() => router.replace(`/terms?lang=${code}`, { scroll: false })}
              className={`rounded-full border px-4 py-2 font-mono text-xs ${
                code === locale
                  ? "border-glow-2 text-glow-2"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              {TERMS_LOCALE_LABELS[code]}
            </button>
          ))}
        </div>
      </header>

      <article lang={locale} className="flex flex-col gap-6">
        {doc.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="rounded-2xl border border-line bg-night-2/60 p-6"
          >
            <h2 className="font-display text-lg font-black uppercase tracking-wide">
              {section.heading}
            </h2>
            <div className="mt-3 flex flex-col gap-3">
              {section.body.map((paragraph, i) => (
                <p key={i} className="text-sm leading-relaxed text-ink/90">
                  {paragraph}
                </p>
              ))}
            </div>
            {section.joke && (
              <p className="mt-4 border-l-2 border-glow-2/60 pl-4 text-sm italic leading-relaxed text-glow-soft">
                {section.joke}
              </p>
            )}
          </section>
        ))}
      </article>
    </div>
  );
}
