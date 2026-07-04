/**
 * ResultSource adapters (PRD §7.2): UefaApiSource against the recorded feed
 * (injected fetch — no network in tests) + the FootballDataSource stub
 * behind the same interface.
 */
import { describe, expect, it } from 'vitest';
import {
  FootballDataSource,
  NotImplementedError,
  SourceSchemaError,
  UefaApiSource,
  type ResultSource,
} from '../src/source.js';
import { AET_BATCH, KNOWN, loadFixture } from './helpers.js';

type RawMatch = { id: string; [k: string]: unknown };
const archive = loadFixture<RawMatch[]>(AET_BATCH);

/** Serve the recorded archive through the real URL contract of match.uefa.com/v5. */
const makeFetch = (opts: { livescore?: unknown; breakPayload?: boolean } = {}) =>
  (async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    let body: unknown;
    if (url.pathname.endsWith('/livescore')) {
      body = opts.livescore ?? [];
    } else {
      const matchId = url.searchParams.get('matchId');
      if (matchId) {
        body = archive.filter((m) => m.id === matchId);
      } else {
        const limit = Number(url.searchParams.get('limit') ?? 50);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        body = archive.slice(offset, offset + limit);
      }
    }
    if (opts.breakPayload && Array.isArray(body) && body.length > 0) {
      body = body.map((m) => ({ ...(m as RawMatch), status: 'SOMETHING_NEW' }));
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

describe('UefaApiSource', () => {
  it('identifies as the vendored uefa-api version (on-chain resultSourceRef)', () => {
    expect(new UefaApiSource().id).toBe('uefa-api@1.0.2');
  });

  it('fixtures() pages the whole season and maps tie wiring', async () => {
    const source = new UefaApiSource({ fetchImpl: makeFetch(), pageSize: 20 });
    const fixtures = await source.fixtures('2026');
    expect(fixtures).toHaveLength(archive.length);

    const leg2 = fixtures.find((f) => f.uefaMatchId === KNOWN.aetSecondLeg)!;
    expect(leg2.legNumber).toBe(2);
    expect(leg2.tieId).toMatch(/^\d+:\d+-\d+$/);
    expect(leg2.home.name).toBe('Sporting CP');
    expect(leg2.kickoffUnix).toBe(Math.floor(Date.parse('2026-03-17T17:45:00Z') / 1000));

    // both legs of a tie share the tieId, single matches have none
    const sameTie = fixtures.filter((f) => f.tieId === leg2.tieId);
    expect(sameTie.map((f) => f.legNumber).sort()).toEqual([1, 2]);
    expect(fixtures.find((f) => f.uefaMatchId === KNOWN.finalOnPenalties)!.tieId).toBeNull();
  });

  it('result() returns the 90′ decoded result for a match ref', async () => {
    const source = new UefaApiSource({ fetchImpl: makeFetch() });
    const result = (await source.result(KNOWN.aetAdvancerIsNotMatchWinner))!;
    expect([result.scoreA90, result.scoreB90]).toEqual([3, 0]);
    expect(result.extraTime).toBe(true);
    expect(result.advancerTeamId).toBe(KNOWN.galatasarayTeamId);
    expect(result.status).toBe('FINISHED');
  });

  it('result() is null for an unknown match ref', async () => {
    const source = new UefaApiSource({ fetchImpl: makeFetch() });
    expect(await source.result('999999999')).toBeNull();
  });

  it('livescore() exposes the feed hash change detector', async () => {
    const source = new UefaApiSource({
      fetchImpl: makeFetch({
        livescore: [
          {
            id: '123',
            status: 'LIVE',
            score: { regular: { home: 1, away: 0 }, total: { home: 1, away: 0 } },
            hash: 'abc123',
          },
        ],
      }),
    });
    const live = await source.livescore();
    expect(live).toEqual([
      { uefaMatchId: '123', status: 'LIVE', scoreA90: 1, scoreB90: 0, hash: 'abc123' },
    ]);
  });

  it('schema drift throws SourceSchemaError (→ SOURCE_SCHEMA_CHANGED alert)', async () => {
    const source = new UefaApiSource({ fetchImpl: makeFetch({ breakPayload: true }) });
    await expect(source.result(KNOWN.finalOnPenalties)).rejects.toBeInstanceOf(SourceSchemaError);
  });

  it('health() is ok on a valid feed and classifies drift', async () => {
    const healthy = await new UefaApiSource({ fetchImpl: makeFetch() }).health();
    expect(healthy.ok).toBe(true);
    expect(healthy.issue).toBeNull();
    expect(healthy.sourceId).toBe('uefa-api@1.0.2');

    const drifted = await new UefaApiSource({ fetchImpl: makeFetch({ breakPayload: true }) }).health();
    expect(drifted.ok).toBe(false);
    expect(drifted.issue).toBe('SOURCE_SCHEMA_CHANGED');

    const down = await new UefaApiSource({
      fetchImpl: (async () => new Response('gateway error', { status: 502 })) as typeof fetch,
    }).health();
    expect(down.ok).toBe(false);
    expect(down.issue).toBe('SOURCE_HTTP_ERROR');
  });
});

describe('FootballDataSource (documented fallback stub)', () => {
  // Type-satisfaction smoke: the stub compiles behind the same interface.
  const source: ResultSource = new FootballDataSource();

  it('satisfies ResultSource and reports itself unimplemented via health()', async () => {
    const health = await source.health();
    expect(health.ok).toBe(false);
    expect(health.sourceId).toBe('football-data.org@v4');
    expect(health.detail).toContain('not implemented');
  });

  it('data methods throw NotImplementedError (loud, never silent)', async () => {
    await expect(source.fixtures('2026')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(source.result('1')).rejects.toBeInstanceOf(NotImplementedError);
    await expect(source.livescore()).rejects.toBeInstanceOf(NotImplementedError);
  });
});
