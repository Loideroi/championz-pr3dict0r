import type { Alert } from './alerts.js';
import type { ChainState, MapEntry, RelaySummary } from './relay.js';
import type { ResultSource } from './source.js';

/**
 * Breakage detection (slice 06, PRD §8.3). Assume the unofficial feed breaks
 * at the worst moment; make it loud:
 *  - SOURCE_SCHEMA_CHANGED: source.health() reports drift (zod already threw)
 *  - SOURCE_STALE: a match kicked off > staleAfterSeconds ago, chain has no
 *    result AND the feed offers none either
 *  - RELAY_ERRORS: any per-match error in the run summary
 */
export const STALE_AFTER_SECONDS = 2 * 3600;

export async function detectIssues(opts: {
  source: ResultSource;
  map: MapEntry[];
  chainStates: Map<number, ChainState>;
  summary: RelaySummary;
  nowSeconds: number;
  staleAfterSeconds?: number;
}): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const staleAfter = opts.staleAfterSeconds ?? STALE_AFTER_SECONDS;

  const health = await opts.source.health().catch(
    (err): { ok: false; issue: string; detail: string } => ({
      ok: false,
      issue: 'SOURCE_UNREACHABLE',
      detail: String(err),
    }),
  );
  if (!health.ok) {
    alerts.push({
      kind: 'SOURCE_SCHEMA_CHANGED',
      summary: `source ${opts.source.id} is unhealthy (${'issue' in health ? health.issue : 'unknown'})`,
      detail: 'detail' in health ? (health.detail ?? undefined) : undefined,
    });
  }

  const stale: string[] = [];
  for (const entry of opts.map) {
    const state = opts.chainStates.get(entry.matchId);
    if (!state || state.completed) continue;
    if (state.kickoff === 0 || opts.nowSeconds < state.kickoff + staleAfter) continue;
    const feed = await opts.source.result(entry.uefaMatchId).catch(() => null);
    if (!feed || feed.status !== 'FINISHED') {
      stale.push(`match ${entry.matchId} (uefa ${entry.uefaMatchId}) kicked off ${Math.round((opts.nowSeconds - state.kickoff) / 3600)}h ago — no result anywhere`);
    }
  }
  if (stale.length > 0) {
    alerts.push({ kind: 'SOURCE_STALE', summary: `${stale.length} match(es) overdue`, detail: stale.join('\n') });
  }

  if (opts.summary.errors.length > 0) {
    alerts.push({
      kind: 'RELAY_ERRORS',
      summary: `${opts.summary.errors.length} match(es) errored this run`,
      detail: opts.summary.errors.map((e) => `match ${e.matchId}: ${e.error}`).join('\n'),
    });
  }
  return alerts;
}
