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
      try {
        const res = await doFetch(`${opts.url}/rest/v1/clp_oracle_log`, {
          method: 'POST',
          headers: {
            apikey: opts.serviceKey,
            authorization: `Bearer ${opts.serviceKey}`,
            'content-type': 'application/json',
            prefer: 'return=minimal',
          },
          body: JSON.stringify(rows),
        });
        if (!res.ok) console.error(`oracle log insert failed: HTTP ${res.status}`);
        return res.ok;
      } catch (err) {
        console.error(`oracle log insert failed: ${err}`);
        return false;
      }
    },
  };
}
