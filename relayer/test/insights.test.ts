import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildFacts,
  formFor,
  INSIGHT_LOCALES,
  renderAllLocales,
  renderInsight,
  tablePositions,
  type PlayedMatch,
} from '../src/insights.js';
import { toFixture, toMatchResult } from '../src/source.js';

const archive = JSON.parse(
  readFileSync(new URL('./fixtures/matches-ucl-2026-aet.json', import.meta.url), 'utf8'),
) as unknown[];

const matches = (archive as Array<Record<string, unknown>>).filter(
  (m) => (m.competitionPhase ?? 'TOURNAMENT') === 'TOURNAMENT',
);
const played: PlayedMatch[] = matches
  .map((m) => ({ fixture: toFixture(m as never), result: toMatchResult(m as never) }))
  .filter((x): x is PlayedMatch => x.result !== null && x.fixture.status === 'FINISHED');

describe('insight facts from the recorded archive', () => {
  it('computes W/D/L form strictly before kickoff, newest first', () => {
    // take the LAST played fixture in the slice — its teams must have prior matches
    const latest = [...played].sort(
      (a, b) => (b.fixture.kickoffUnix ?? 0) - (a.fixture.kickoffUnix ?? 0),
    )[0]!;
    const form = formFor(
      latest.fixture.home.uefaTeamId,
      played,
      latest.fixture.kickoffUnix ?? 0,
    );
    expect(form.length).toBeGreaterThan(0);
    expect(form.length).toBeLessThanOrEqual(5);
    for (const f of form) expect(['W', 'D', 'L']).toContain(f);
    // strictly before: the match itself is never part of its own form
    expect(
      formFor(latest.fixture.home.uefaTeamId, [latest], latest.fixture.kickoffUnix ?? 0),
    ).toEqual([]);
  });

  it('builds a mini table from league-phase results only', () => {
    const table = tablePositions(played);
    expect(table.size).toBeGreaterThan(0);
    const positions = [...table.values()];
    expect(Math.min(...positions)).toBe(1);
    expect(new Set(positions).size).toBe(positions.length); // dense unique ranks
  });

  it('deciders carry the decider line; league matches the table line', () => {
    const decider = played.find((p) => p.fixture.type === 'SECOND_LEG')!;
    const facts = buildFacts(decider.fixture, played, true);
    expect(facts.knockout).toBe(true);
    const en = renderInsight(facts, 'en');
    expect(en).toContain('decider');
    expect(en).not.toContain('table says'); // knockout: no league positions

    const league = played.find((p) => p.fixture.type === 'GROUP_STAGE')!;
    const lFacts = buildFacts(league.fixture, played, false);
    expect(renderInsight(lFacts, 'en')).toContain('table says');
  });
});

describe('six-locale parity (ADR-0011)', () => {
  it('renders all six locales with identical numeric slots', () => {
    const league = played.find((p) => p.fixture.type === 'GROUP_STAGE')!;
    const facts = buildFacts(league.fixture, played, false);
    const all = renderAllLocales(facts);
    expect(Object.keys(all).sort()).toEqual([...INSIGHT_LOCALES].sort());
    const numbers = (s: string) => (s.match(/\d+/g) ?? []).join(',');
    const reference = numbers(all.en);
    for (const locale of INSIGHT_LOCALES) {
      expect(numbers(all[locale]), locale).toBe(reference);
      expect(all[locale].length).toBeGreaterThan(30);
    }
    // texts are actually localized, not copies
    expect(new Set(Object.values(all)).size).toBe(INSIGHT_LOCALES.length);
  });

  it('committed sample output has identical key sets across locales', () => {
    const load = (l: string) =>
      JSON.parse(
        readFileSync(new URL(`./output/insights-sample/${l}.json`, import.meta.url), 'utf8'),
      ) as Record<string, string>;
    const en = load('en');
    for (const locale of INSIGHT_LOCALES) {
      expect(Object.keys(load(locale)).sort(), locale).toEqual(Object.keys(en).sort());
    }
    expect(Object.keys(en).length).toBeGreaterThan(10);
  });
});
