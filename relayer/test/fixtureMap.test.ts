import { describe, expect, it } from 'vitest';
import { assertContiguous, mapFromMatches, selectMatches, type MatchesDoc } from '../src/fixtureMap.js';
import { relayerRoot } from './helpers.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sample = JSON.parse(
  readFileSync(resolve(relayerRoot, 'test/output/matches-sample.json'), 'utf8'),
) as MatchesDoc;

describe('fixtureMap', () => {
  it('selectMatches filters by phase and sorts by matchId', () => {
    const league = selectMatches(sample, 0);
    expect(league.length).toBe(5);
    expect(league.every((m) => m.phase === 0)).toBe(true);
    const all = selectMatches(sample, null);
    expect(all.map((m) => m.matchId)).toEqual(all.map((_, i) => i + 1));
  });

  it('assertContiguous rejects gaps and reorders (on-chain ids are sequential)', () => {
    expect(() => assertContiguous(selectMatches(sample, null))).not.toThrow();
    expect(() => assertContiguous(selectMatches(sample, 2))).toThrow(/contiguous/);
    const swapped = [sample.matches[1]!, sample.matches[0]!];
    expect(() => assertContiguous(swapped)).toThrow(/contiguous/);
  });

  it('builds the relayer map with UEFA team ids resolved from the teams map', () => {
    const map = mapFromMatches(sample);
    expect(map.length).toBe(sample.matches.length);
    const first = map[0]!;
    const m = sample.matches[0]!;
    expect(first.matchId).toBe(1);
    expect(first.uefaMatchId).toBe(m.uefaMatchId);
    expect(first.homeTeamId).toBe(sample.teams[m.teamA]!.uefaId);
    expect(first.awayTeamId).toBe(sample.teams[m.teamB]!.uefaId);
    expect(first.label).toBe(`${m.teamA}–${m.teamB}`);
  });

  it('applies the id offset for a proxy that already holds matches', () => {
    const map = mapFromMatches(sample, { idOffset: 4 });
    expect(map[0]!.matchId).toBe(5);
    expect(map.at(-1)!.matchId).toBe(4 + sample.matches.length);
  });

  it('refuses placeholder fixtures (no UEFA team id to resolve the advancer against)', () => {
    const doc: MatchesDoc = structuredClone(sample);
    doc.matches[0]!.teamA = 'Winner of Group X';
    expect(() => mapFromMatches(doc)).toThrow(/placeholder/);
  });
});
