"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/**
 * Degraded-mode banner (PRD §8.3): reads the latest relayer 'run' row from
 * clp_oracle_log (public read) and banners when the last run raised alerts or
 * errors. Absent env / absent rows → renders nothing (never blocks the app).
 */
export function HealthBanner() {
  const t = useTranslations("health");
  // Boolean state only — the copy itself comes from the (locale-reactive)
  // translator so switching language re-renders the banner text.
  const [troubled, setTroubled] = useState(false);

  useEffect(() => {
    if (!SUPABASE_URL || !ANON_KEY) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/clp_oracle_log?kind=eq.run&order=created_at.desc&limit=1`,
          { headers: { apikey: ANON_KEY } },
        );
        if (!res.ok) return;
        const [row] = (await res.json()) as Array<{
          created_at: string;
          detail?: { errors?: unknown[]; alerts?: string[] };
        }>;
        if (!row) return;
        const ageMs = Date.now() - new Date(row.created_at).getTime();
        const isTroubled =
          (row.detail?.errors?.length ?? 0) > 0 || (row.detail?.alerts?.length ?? 0) > 0;
        if (isTroubled && ageMs < 6 * 3600 * 1000) setTroubled(true);
      } catch {
        /* health read is best-effort */
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!troubled) return null;
  return (
    <div role="status" className="border-b border-star/30 bg-star/10 px-5 py-2 text-center font-mono text-xs text-star">
      ◌ {t("delayed")}
    </div>
  );
}
