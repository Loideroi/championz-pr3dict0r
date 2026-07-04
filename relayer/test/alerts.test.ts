import { describe, expect, it, vi } from 'vitest';
import { composeAlert, composeHeartbeat, escapeHtml, telegramTransport } from '../src/alerts.js';
import { supabaseLogger } from '../src/oracleLog.js';
import { detectIssues } from '../src/watchdog.js';
import type { ChainState, MapEntry, RelaySummary } from '../src/relay.js';
import type { ResultSource, SourceHealth } from '../src/source.js';

const entry = (matchId: number, uefaMatchId: string): MapEntry => ({
  matchId,
  uefaMatchId,
  homeTeamId: 'H',
  awayTeamId: 'A',
});

const okHealth: SourceHealth = {
  ok: true,
  sourceId: 'stub',
  checkedAt: '',
  latencyMs: 1,
  issue: null,
  detail: null,
};

function stubSource(over: Partial<ResultSource> = {}): ResultSource {
  return {
    id: 'stub',
    fixtures: async () => [],
    livescore: async () => [],
    health: async () => okHealth,
    result: async () => null,
    ...over,
  };
}

const emptySummary = (): RelaySummary => ({
  pushed: [],
  corrected: [],
  skipped: [],
  errors: [],
  states: new Map<number, ChainState>(),
});

describe('alert composition', () => {
  it('escapes HTML and includes the runbook link', () => {
    const text = composeAlert({ kind: 'SOURCE_SCHEMA_CHANGED', summary: 's', detail: '<tag> & stuff' });
    expect(text).toContain('🚨');
    expect(text).toContain('&lt;tag&gt; &amp; stuff');
    expect(text).toContain('Runbook:');
    expect(escapeHtml('<&>')).toBe('&lt;&amp;&gt;');
  });

  it('heartbeat summarizes the run', () => {
    const beat = composeHeartbeat({
      pushed: [1],
      corrected: [],
      skippedCount: 3,
      errorCount: 0,
      trackedMatches: 4,
      sourceId: 'uefa-api@1.0.2',
    });
    expect(beat).toContain('oracle healthy');
    expect(beat).toContain('4 matches tracked');
    expect(beat).toContain('pushed 1');
  });
});

describe('telegram transport', () => {
  it('degrades to console when env is missing (never throws)', async () => {
    const t = telegramTransport(undefined, undefined);
    await expect(t.send('x')).resolves.toBe(false);
  });
});

describe('watchdog (PRD §8.3)', () => {
  it('schema drift → SOURCE_SCHEMA_CHANGED', async () => {
    const source = stubSource({
      health: async () => ({ ...okHealth, ok: false, issue: 'SOURCE_SCHEMA_CHANGED', detail: 'zod: score.regular missing' }),
    });
    const alerts = await detectIssues({
      source,
      map: [],
      chainStates: new Map(),
      summary: emptySummary(),
      nowSeconds: 0,
    });
    expect(alerts.map((a) => a.kind)).toEqual(['SOURCE_SCHEMA_CHANGED']);
    expect(alerts[0]?.detail).toContain('score.regular');
  });

  it('match finished >2h ago with no result anywhere → SOURCE_STALE', async () => {
    const kickoff = 1_000_000;
    const states = new Map<number, ChainState>([
      [1, { completed: false, provisional: false, packed: null, kickoff }],
    ]);
    const alerts = await detectIssues({
      source: stubSource(), // result() → null: the feed has nothing either
      map: [entry(1, 'u1')],
      chainStates: states,
      summary: emptySummary(),
      nowSeconds: kickoff + 3 * 3600,
    });
    expect(alerts.map((a) => a.kind)).toEqual(['SOURCE_STALE']);
  });

  it('quiet inside the window, quiet when completed, loud on run errors', async () => {
    const kickoff = 1_000_000;
    const states = new Map<number, ChainState>([
      [1, { completed: false, provisional: false, packed: null, kickoff }], // 1h ago — fine
      [2, { completed: true, provisional: true, packed: 1n, kickoff }], // done — fine
    ]);
    const summary = emptySummary();
    summary.errors.push({ matchId: 3, error: 'boom' });
    const alerts = await detectIssues({
      source: stubSource(),
      map: [entry(1, 'u1'), entry(2, 'u2')],
      chainStates: states,
      summary,
      nowSeconds: kickoff + 3600,
    });
    expect(alerts.map((a) => a.kind)).toEqual(['RELAY_ERRORS']);
    expect(alerts[0]?.detail).toContain('match 3: boom');
  });
});

describe('oracle log writer', () => {
  it('POSTs rows with service headers; failures return false, never throw', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    const log = supabaseLogger({ url: 'https://x.supabase.co', serviceKey: 'k', fetchImpl });
    expect(await log.insert([{ kind: 'run', chain_id: 88882 }])).toBe(true);
    expect(calls[0]?.url).toContain('/rest/v1/clp_oracle_log');
    expect((calls[0]?.init.headers as Record<string, string>).apikey).toBe('k');

    const failing = supabaseLogger({
      url: 'https://x.supabase.co',
      serviceKey: 'k',
      fetchImpl: (async () => {
        throw new Error('net down');
      }) as unknown as typeof fetch,
    });
    expect(await failing.insert([{ kind: 'run', chain_id: 88882 }])).toBe(false);
  });

  it('missing env → skipped, false, no throw', async () => {
    const log = supabaseLogger({ url: undefined, serviceKey: undefined });
    expect(await log.insert([{ kind: 'heartbeat', chain_id: 88882 }])).toBe(false);
  });
});
