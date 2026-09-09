"use client";

import { useCallback, useEffect, useState } from "react";
import type { OracleLogRow } from "@/lib/admin/health";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Enough for a week of cron runs + a matchday of pushes and reminders. */
const LOG_LOOKBACK_MS = 7 * 24 * 3600 * 1000;
const LOG_LIMIT = 400;
/** The clock every age on the page is measured against ticks this often. */
const CLOCK_TICK_MS = 30_000;
/** Re-read the log this often while the tab stays open (a watcher ticks every 5 min). */
const RELOAD_EVERY_MS = 5 * 60_000;

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
  /**
   * A ticking clock for ages. Measuring against loadedAt alone froze every
   * age at the moment of the last refresh, so a tab left open showed a
   * six-hour-old run as fresh forever (review finding on PR #85).
   */
  const [now, setNow] = useState<number | null>(null);
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
    // Match-scoped rows are read per kind so a season of reminders (two per
    // match) can never push the oldest pushes off the tail of one capped query.
    const [recent, pushes, reminders] = await Promise.all([
      query({ created_at: `gte.${since}`, limit: String(LOG_LIMIT) }),
      query({ match_id: "not.is.null", kind: "in.(result_push,correction)", limit: "1000" }),
      query({ match_id: "not.is.null", kind: "eq.alert", limit: "1000" }),
    ]);
    if (recent) setLogs(recent);
    if (pushes && reminders) setPipelineRows([...pushes, ...reminders]);
  }, [chainId, available]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const clock = setInterval(tick, CLOCK_TICK_MS);
    const refresh = setInterval(() => void reload(), RELOAD_EVERY_MS);
    return () => {
      clearInterval(clock);
      clearInterval(refresh);
    };
  }, [reload]);

  return { logs, pipelineRows, loadedAt, now, available, reload };
}
