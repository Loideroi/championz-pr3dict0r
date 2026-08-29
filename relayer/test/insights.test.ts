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

describe('matchday 1 — no form on either side', () => {
  it('renders one opening-night sentence instead of two "open their campaign" stubs, in every locale', () => {
    const league = played.find((p) => p.fixture.type === 'GROUP_STAGE')!;
    const facts = { ...buildFacts(league.fixture, [], false), homePos: null, awayPos: null };
    expect(facts.homeForm).toEqual([]);
    expect(facts.awayForm).toEqual([]);
    const en = renderInsight(facts, 'en');
    expect(en).toContain('Opening night');
    expect(en).toContain(facts.home);
    expect(en).toContain(facts.away);
    expect(en).not.toContain('open their campaign');
    const all = renderAllLocales(facts);
    expect(new Set(Object.values(all)).size).toBe(INSIGHT_LOCALES.length);
    // one side with form → back to the per-team lines
    const mixed = renderInsight({ ...facts, homeForm: ['W', 'D'] }, 'en');
    expect(mixed).toContain('arrive on a W-D run');
    expect(mixed).toContain('open their campaign');
  });
});

describe('matchday 2+ before any result — schedule context', () => {
  const base = played.find((p) => p.fixture.type === 'GROUP_STAGE')!.fixture;
  const team = (id: string, name: string) => ({ uefaTeamId: id, name, code: null, isPlaceHolder: false });
  const fx = (id: string, kickoff: number, home: ReturnType<typeof team>, away: ReturnType<typeof team>, matchday: number) => ({
    ...base, uefaMatchId: id, kickoffUnix: kickoff, kickoffDate: '2026-10-13', status: 'UPCOMING' as const,
    type: 'GROUP_STAGE' as const, matchday, home, away, legNumber: null, tieId: null,
  });
  const lens = team('52277', 'Lens'), slavia = team('52498', 'Slavia Praha'), sporting = team('50149', 'Sporting CP'), gala = team('50067', 'Galatasaray');
  const md1a = fx('a', 1_000, slavia, lens, 1); // Lens away at Slavia
  const md1b = fx('b', 1_000, sporting, gala, 1); // Sporting host Galatasaray
  const md2 = fx('c', 2_000, lens, sporting, 2);
  const schedule = [md1a, md1b, md2];

  it('names each side\'s previous fixture and venue when no result exists yet, in every locale', () => {
    const facts = buildFacts(md2, [], false, schedule);
    expect(facts.matchday).toBe(2);
    expect(facts.homePrev).toEqual({ opponent: 'Slavia Praha', home: false });
    expect(facts.awayPrev).toEqual({ opponent: 'Galatasaray', home: true });
    const en = renderInsight(facts, 'en');
    expect(en).toBe('Lens after visiting Slavia Praha; Sporting CP after hosting Galatasaray.');
    const all = renderAllLocales(facts);
    for (const locale of INSIGHT_LOCALES) {
      expect(all[locale]).toContain('Slavia Praha');
      expect(all[locale]).toContain('Galatasaray');
      expect(all[locale]).not.toContain('Opening night');
    }
    expect(new Set(Object.values(all)).size).toBe(INSIGHT_LOCALES.length);
  });

  it('matchday 1 (nothing before it on the schedule) still renders the opening-night line', () => {
    const facts = buildFacts(md1a, [], false, schedule);
    expect(facts.matchday).toBe(1);
    expect(facts.homePrev).toBeNull();
    expect(renderInsight(facts, 'en')).toContain('Opening night');
  });

  it('a result trumps the schedule line (form wins once it exists)', () => {
    const facts = { ...buildFacts(md2, [], false, schedule), homeForm: ['L'] };
    const en = renderInsight(facts, 'en');
    expect(en).toContain('Lens arrive on a L run');
    expect(en).toContain('Sporting CP after hosting Galatasaray');
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
