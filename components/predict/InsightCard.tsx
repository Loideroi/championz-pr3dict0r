"use client";

import { useEffect, useState } from "react";

/**
 * Match Insight (slice 15, ADR-0011): renders the pre-match blurb for a
 * uefaMatchId if the current locale's insights file carries it — and renders
 * NOTHING otherwise (insights may lag fixtures; knockout rounds appear only
 * after each draw). Files are static: /insights/<locale>.json, produced by
 * relayer/scripts/generate-insights.mjs before each matchday.
 */

const cache = new Map<string, Promise<Record<string, string>>>();

function loadInsights(locale: string): Promise<Record<string, string>> {
  if (!cache.has(locale)) {
    cache.set(
      locale,
      fetch(`/insights/${locale}.json`)
        .then((r) => (r.ok ? (r.json() as Promise<Record<string, string>>) : {}))
        .catch(() => ({})),
    );
  }
  return cache.get(locale)!;
}

export function InsightCard({
  uefaMatchId,
  locale = "en",
}: {
  uefaMatchId?: string | null;
  locale?: string;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!uefaMatchId) return;
    let alive = true;
    const t = setTimeout(async () => {
      const insights = await loadInsights(locale);
      if (alive) setText(insights[uefaMatchId] ?? null);
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [uefaMatchId, locale]);

  if (!text) return null;
  return (
    <p className="mt-2 rounded-lg border border-line-soft bg-white/[0.02] px-3 py-2 font-mono text-[11px] leading-relaxed text-muted">
      ✦ {text}
    </p>
  );
}
