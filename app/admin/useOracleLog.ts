"use client";

import { useCallback, useState } from "react";
import type { OracleLogRow } from "@/lib/admin/health";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Enough for a week of cron runs + a matchday of pushes and reminders. */
const LOG_LOOKBACK_MS = 7 * 24 * 3600 * 1000;
const LOG_LIMIT = 400;

/**
 * clp_oracle_log, read twice for two questions:
 *
 *  - `logs`: this chain's last week — feeds the last-run / heartbeat tiles
 *    and the 24h alert groups.
 *  - `pipelineRows`: every match-scoped row of the season (pushes,
 *    corrections, reminders). A push from MD1 is still the answer to "when
 *    did the bot handle match 3" in May; 144 pushes + a few corrections +
 *    two reminders per match fits the cap comfortably.
 *
 * Both are filtered on chain_id: the Spicy sentinel writes to the same table
 * and its alerts must not read as mainnet incidents. Both are best-effort —
 * a failed read leaves the previous rows in place.
 */
export function useOracleLog(chainId: number) {
  const [logs, setLogs] = useState<OracleLogRow[] | null>(null);
  const [pipelineRows, setPipelineRows] = useState<OracleLogRow[]>([]);
  /** Wall clock at the last refresh — set client-side only (SSR safety). */
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const available = Boolean(SUPABASE_URL && ANON_KEY);

  const reload = useCallback(async () => {
    const now = Date.now();
    setLoadedAt(now);
    if (!available) return;
    const query = async (extra: Record<string, string>): Promise<OracleLogRow[] | null> => {
      const params = new URLSearchParams({
        select: "kind,chain_id,match_id,tx_hash,created_at,detail",
        chain_id: `eq.${chainId}`,
        order: "created_at.desc",
        ...extra,
      });
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/clp_oracle_log?${params}`, {
          headers: { apikey: ANON_KEY },
        });
        return res.ok ? ((await res.json()) as OracleLogRow[]) : null;
      } catch {
        return null;
      }
    };
    const since = new Date(now - LOG_LOOKBACK_MS).toISOString();
    const [recent, scoped] = await Promise.all([
      query({ created_at: `gte.${since}`, limit: String(LOG_LIMIT) }),
      query({ match_id: "not.is.null", limit: "1000" }),
    ]);
    if (recent) setLogs(recent);
    if (scoped) setPipelineRows(scoped);
  }, [chainId, available]);

  return { logs, pipelineRows, loadedAt, available, reload };
}
