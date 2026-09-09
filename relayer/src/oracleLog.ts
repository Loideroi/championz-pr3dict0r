/**
 * clp_oracle_log writer (slice 06) — the read-model behind the admin console
 * dashboard, the app's degraded-mode banner and the heartbeat. Service-role
 * REST insert; fetch injected for tests. Logging must never break relaying:
 * failures are reported in the return value, not thrown.
 */
export type LogKind = 'run' | 'result_push' | 'correction' | 'alert' | 'heartbeat';

export interface LogRow {
  kind: LogKind;
  chain_id: number;
  match_id?: number;
  tx_hash?: string;
  detail?: unknown;
}

export interface OracleLogger {
  insert(rows: LogRow[]): Promise<boolean>;
  /** match_ids that already got a T-75 reminder recently (dedupe for the 5-min cron). */
  recentReminderIds(sinceIso: string, type?: string): Promise<Set<number>>;
  /** True when an alert of detail.type already fired for chain_id since sinceIso (dedupe). */
  hasRecentAlert(type: string, chainId: number, sinceIso: string): Promise<boolean>;
}

export function supabaseLogger(opts: {
  url: string | undefined;
  serviceKey: string | undefined;
  fetchImpl?: typeof fetch;
}): OracleLogger {
  const doFetch = opts.fetchImpl ?? fetch;
  return {
    async insert(rows: LogRow[]): Promise<boolean> {
      if (!opts.url || !opts.serviceKey) {
        console.error('[oracle log skipped — SUPABASE env missing]');
        return false;
      }
      // PostgREST rejects a bulk insert whose objects do not all carry the
      // same keys (PGRST102), and it rejects the whole batch rather than the
      // odd row. Mixed batches are the normal case here: a 'run' row has
      // detail but no match_id, a 'result_push' row the reverse. On 8 Sep
      // 2026 that silently lost every result_push of MD1 *and* its run row.
      // Pad every row to one shape so the batch is always uniform.
      const padded = rows.map((r) => ({
        kind: r.kind,
        chain_id: r.chain_id ?? null,
        match_id: r.match_id ?? null,
        tx_hash: r.tx_hash ?? null,
        detail: r.detail ?? null,
      }));
      try {
        const res = await doFetch(`${opts.url}/rest/v1/clp_oracle_log`, {
          method: 'POST',
          headers: {
            apikey: opts.serviceKey,
            authorization: `Bearer ${opts.serviceKey}`,
            'content-type': 'application/json',
            prefer: 'return=minimal',
          },
          body: JSON.stringify(padded),
        });
        if (!res.ok) console.error(`oracle log insert failed: HTTP ${res.status}`);
        return res.ok;
      } catch (err) {
        console.error(`oracle log insert failed: ${err}`);
        return false;
      }
    },

    async hasRecentAlert(type: string, chainId: number, sinceIso: string): Promise<boolean> {
      if (!opts.url || !opts.serviceKey) return false;
      try {
        const params = new URLSearchParams({
          select: 'id',
          kind: 'eq.alert',
          'detail->>type': `eq.${type}`,
          chain_id: `eq.${chainId}`,
          created_at: `gte.${sinceIso}`,
          limit: '1',
        });
        const res = await doFetch(`${opts.url}/rest/v1/clp_oracle_log?${params}`, {
          headers: { apikey: opts.serviceKey, authorization: `Bearer ${opts.serviceKey}` },
        });
        if (!res.ok) return false;
        const rows = (await res.json()) as unknown[];
        return rows.length > 0;
      } catch {
        return false; // dedupe is best-effort; worst case = a duplicate warning
      }
    },

    async recentReminderIds(sinceIso: string, type = 't75_reminder'): Promise<Set<number>> {
      if (!opts.url || !opts.serviceKey) return new Set();
      try {
        const params = new URLSearchParams({
          select: 'match_id',
          kind: 'eq.alert',
          'detail->>type': `eq.${type}`,
          created_at: `gte.${sinceIso}`,
        });
        const res = await doFetch(`${opts.url}/rest/v1/clp_oracle_log?${params}`, {
          headers: { apikey: opts.serviceKey, authorization: `Bearer ${opts.serviceKey}` },
        });
        if (!res.ok) return new Set();
        const rows = (await res.json()) as Array<{ match_id: number | null }>;
        return new Set(rows.map((r) => r.match_id).filter((x): x is number => x !== null));
      } catch {
        return new Set(); // dedupe is best-effort; worst case = a duplicate reminder
      }
    },
  };
}
