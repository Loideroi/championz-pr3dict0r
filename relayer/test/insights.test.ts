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
import type { TeamStrength } from '../src/strength.js';

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

  it('builds a league table from league-phase results only, positions 1..n', () => {
    const table = tablePositions(played);
    expect(table.size).toBeGreaterThan(0);
    const positions = [...table.values()];
    expect(Math.min(...positions)).toBe(1);
    expect(Math.max(...positions)).toBeLessThanOrEqual(table.size);
    // no knockout club sneaks in via a knockout result
    const leagueClubs = new Set(
      played
        .filter((p) => p.fixture.type === 'GROUP_STAGE')
        .flatMap((p) => [p.fixture.home.uefaTeamId, p.fixture.away.uefaTeamId]),
    );
    for (const id of table.keys()) expect(leagueClubs.has(id)).toBe(true);
  });

  it('the table is the one at kickoff — the first league match has none, and none counts towards its own', () => {
    const first = played
      .filter((p) => p.fixture.type === 'GROUP_STAGE')
      .sort((a, b) => (a.fixture.kickoffUnix ?? 0) - (b.fixture.kickoffUnix ?? 0))[0]!;
    expect(tablePositions(played, first.fixture.kickoffUnix ?? 0).size).toBe(0);
    const facts = buildFacts(first.fixture, played, false);
    expect(facts.homePos).toBeNull();
    expect(renderInsight(facts, 'en')).not.toContain('table says');
  });

  it('deciders carry the decider line, never the table', () => {
    const decider = played.find((p) => p.fixture.type === 'SECOND_LEG')!;
    const facts = buildFacts(decider.fixture, played, true);
    expect(facts.knockout).toBe(true);
    const en = renderInsight(facts, 'en');
    expect(en).toContain('decider');
    expect(en).not.toContain('table says'); // knockout: no league positions
  });
});

describe('league table tiebreaks (UEFA order: pts, GD, GF, away GF, wins, away wins)', () => {
  const base = played.find((p) => p.fixture.type === 'GROUP_STAGE')!;
  const team = (id: string) => ({ uefaTeamId: id, name: id, code: null, isPlaceHolder: false });
  const result = (home: string, away: string, hg: number, ag: number, kickoff = 1_000): PlayedMatch => ({
    fixture: {
      ...base.fixture, uefaMatchId: `${home}-${away}`, kickoffUnix: kickoff, status: 'FINISHED',
      type: 'GROUP_STAGE', matchday: 1, home: team(home), away: team(away), legNumber: null, tieId: null,
    },
    result: {
      ...base.result, uefaMatchId: `${home}-${away}`, scoreA90: hg, scoreB90: ag, totalA: hg, totalB: ag,
    },
  });

  it('after one round, winners rank by margin and losers by margin — not by feed order', () => {
    const table = tablePositions([result('A', 'B', 3, 0), result('C', 'D', 1, 0)]);
    expect([...table.entries()]).toEqual([['A', 1], ['C', 2], ['D', 3], ['B', 4]]);
  });

  it('goals scored split equal GD; away goals split equal GF', () => {
    // A and C both +1 on GD; C scored more. E won 1-0 away: same pts/GD/GF as A, more away goals.
    const table = tablePositions([
      result('A', 'B', 1, 0),
      result('C', 'D', 3, 2),
      result('F', 'E', 0, 1),
    ]);
    expect(table.get('C')).toBe(1);
    expect(table.get('E')).toBe(2);
    expect(table.get('A')).toBe(3);
  });

  it('clubs still level after every tiebreak share the position; the next one skips', () => {
    const table = tablePositions([result('A', 'B', 1, 0), result('C', 'D', 1, 0)]);
    expect(table.get('A')).toBe(1);
    expect(table.get('C')).toBe(1);
    expect(table.get('B')).toBe(3);
    expect(table.get('D')).toBe(3);
  });

  it('wins split clubs level on points, GD, GF and away GF', () => {
    // A: one win, one loss (3 pts, GD 0, GF 2, 0 away goals, 1 win)
    // B: three home draws (3 pts, GD 0, GF 2, 0 away goals, 0 wins)
    const table = tablePositions([
      result('A', 'X', 2, 0), result('Y', 'A', 2, 0),
      result('B', 'P', 1, 1), result('B', 'Q', 1, 1), result('B', 'R', 0, 0),
    ]);
    expect(table.get('A')).toBeLessThan(table.get('B')!);
  });

  it('away wins split clubs level through wins', () => {
    // A: won away 1-0, lost at home 1-2 · B: won at home 1-0, lost away 1-2
    // — identical on pts, GD, GF, away GF (1 each) and wins; A has the away win
    const table = tablePositions([
      result('X', 'A', 0, 1), result('A', 'Y', 1, 2),
      result('B', 'P', 1, 0), result('Q', 'B', 2, 1),
    ]);
    expect(table.get('A')).toBeLessThan(table.get('B')!);
  });

  it("opponents' collective points split clubs level on their own record (criterion f)", () => {
    // A and B both drew 0-0; A's opponent C went on to win, B's opponent D to lose
    const table = tablePositions([
      result('A', 'C', 0, 0), result('B', 'D', 0, 0),
      result('C', 'E', 1, 0), result('D', 'F', 0, 1),
    ]);
    expect(table.get('A')).toBeLessThan(table.get('B')!);
  });

  it("opponents' goal difference, then goals, split clubs level on opponents' points (g, h)", () => {
    // A/B both lost 0-1 at home; their conquerors C/D both then lost — C by
    // less (opp GD), while E/F below sit behind conquerors of equal GD but
    // different goals scored
    const gd = tablePositions([
      result('A', 'C', 0, 1), result('B', 'D', 0, 1),
      result('C', 'X', 0, 1), result('D', 'Y', 0, 2),
    ]);
    expect(gd.get('A')).toBeLessThan(gd.get('B')!);
    const gf = tablePositions([
      result('A', 'C', 0, 1), result('B', 'D', 0, 1),
      result('C', 'X', 1, 2), result('D', 'Y', 0, 1),
    ]);
    expect(gf.get('A')).toBeLessThan(gf.get('B')!);
  });

  it('ranks on the 90-minute score, never the AET total', () => {
    const aet = result('A', 'B', 1, 1);
    aet.result.totalA = 2; // a league match never has one, but the rule is absolute
    // a 1-1 draw: B's away goal splits it, and the phantom total changes nothing
    expect([...tablePositions([aet])]).toEqual([...tablePositions([result('A', 'B', 1, 1)])]);
    expect(tablePositions([aet]).get('B')).toBe(1);
  });

  it('only counts matches kicked off strictly before the cut', () => {
    const table = tablePositions([result('A', 'B', 1, 0, 1_000), result('C', 'D', 5, 0, 2_000)], 2_000);
    expect([...table.keys()].sort()).toEqual(['A', 'B']);
  });

  it('a matchday-2 fixture reads the matchday-1 table, and a played fixture never reads its own result', () => {
    const md1 = [result('A', 'B', 2, 0, 1_000), result('C', 'D', 0, 1, 1_000)];
    const md2 = result('A', 'D', 0, 3, 2_000);
    const before = buildFacts(md2.fixture, [...md1, md2], false);
    expect(before.homePos).toBe(1); // A, +2
    expect(before.awayPos).toBe(2); // D, +1 — not the 1st that its 3-0 win would give
    expect(renderInsight(before, 'en')).toContain('The table says A 1st, D 2nd');
  });

  it("reproduces UEFA's published 2026/27 table after matchday 1, shared positions included", () => {
    const snap = JSON.parse(
      readFileSync(new URL('./fixtures/standings-ucl-2027-md1.json', import.meta.url), 'utf8'),
    ) as {
      results: Array<{ home: string; away: string; scoreA90: number; scoreB90: number; kickoffUnix: number }>;
      officialRanks: Record<string, number>;
    };
    const played = snap.results.map((r) => result(r.home, r.away, r.scoreA90, r.scoreB90, r.kickoffUnix));
    const ours = Object.fromEntries(tablePositions(played));
    expect(ours).toEqual(snap.officialRanks);
    // the snapshot is only worth keeping while it actually exercises shared ranks
    expect(new Set(Object.values(snap.officialRanks)).size).toBeLessThan(36);
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

describe('matchday 1 with published strength — the whole point of the exercise', () => {
  const league = played.find((p) => p.fixture.type === 'GROUP_STAGE')!;
  const strong = (over: Partial<TeamStrength> = {}): TeamStrength => ({
    coefRank: 2,
    coefValue: 144.5,
    prevRun: 'QUARTER_FINAL',
    prevLeagueRank: 9,
    ...over,
  });
  const index = (home: TeamStrength, away: TeamStrength) =>
    new Map([
      [league.fixture.home.uefaTeamId, home],
      [league.fixture.away.uefaTeamId, away],
    ]);
  const factsWith = (home: TeamStrength, away: TeamStrength) => ({
    ...buildFacts(league.fixture, [], false, [], index(home, away)),
    homePos: null,
    awayPos: null,
  });

  it('replaces the identical opening-night sentence with ranks, a call and last season', () => {
    const facts = factsWith(strong(), strong({ coefRank: 27, coefValue: 71, prevRun: 'ABSENT' }));
    const en = renderInsight(facts, 'en');
    expect(en).not.toContain('Opening night');
    expect(en).toContain('UEFA coefficients');
    expect(en).toContain('No. 2');
    expect(en).toContain('No. 27');
    expect(en).toContain('start favourites');
    expect(en).toContain('quarter-finalists');
    expect(en).toContain('not in the competition');
  });

  it('says "unranked" rather than inventing a position for a club UEFA does not list', () => {
    const facts = factsWith(strong({ coefRank: null, coefValue: 1 }), strong({ coefRank: 37, coefValue: 61 }));
    const en = renderInsight(facts, 'en');
    expect(en).toContain('unranked');
    expect(en).not.toMatch(/No\. (null|NaN|0)\b/);
    expect(en).toContain('clear favourites'); // the floor still produces a call
  });

  it('credits home ground explicitly when that is what decides the call', () => {
    const facts = factsWith(strong({ coefValue: 100 }), strong({ coefValue: 108 }));
    expect(facts.verdict).toEqual({ side: 'home', tier: 'edge', homeGroundDecides: true });
    expect(renderInsight(facts, 'en')).toContain('edge it at home');
  });

  it('collapses two absences into one clause instead of repeating it', () => {
    const absent = strong({ prevRun: 'ABSENT', prevLeagueRank: null });
    const en = renderInsight(factsWith(absent, absent), 'en');
    expect(en).toContain('Neither');
    expect(en.match(/not in the competition/g)).toBeNull();
  });

  it('gives a league-phase finisher its position, with a correct ordinal', () => {
    const facts = factsWith(
      strong({ prevRun: 'LEAGUE_PHASE', prevLeagueRank: 1 }),
      strong({ prevRun: 'LEAGUE_PHASE', prevLeagueRank: 22 }),
    );
    const en = renderInsight(facts, 'en');
    expect(en).toContain('1st in the league phase');
    expect(en).toContain('22nd in the league phase');
    expect(renderInsight(facts, 'fr')).toContain('1er de la phase de ligue');
  });

  it('drops last season once this season has form to read', () => {
    const facts = { ...factsWith(strong(), strong()), homeForm: ['W', 'D'] };
    const en = renderInsight(facts, 'en');
    expect(en).toContain('arrive on a W-D run');
    expect(en).toContain('UEFA coefficients'); // the call still stands
    expect(en).not.toContain('Last season');
  });

  it('falls back to the old copy when the strength feeds were unreachable', () => {
    const facts = { ...buildFacts(league.fixture, [], false), homePos: null, awayPos: null };
    expect(facts.verdict).toBeNull();
    expect(renderInsight(facts, 'en')).toContain('Opening night');
  });

  it('renders the same numbers in all six locales', () => {
    const all = renderAllLocales(factsWith(strong(), strong({ coefRank: 27, coefValue: 71 })));
    const numbers = (s: string) => (s.match(/\d+/g) ?? []).join(',');
    for (const locale of INSIGHT_LOCALES) expect(numbers(all[locale]), locale).toBe(numbers(all.en));
    expect(new Set(Object.values(all)).size).toBe(INSIGHT_LOCALES.length);
  });
});

describe('six-locale parity (ADR-0011)', () => {
  it('renders all six locales with identical numeric slots', () => {
    // the archive holds one league matchday, so no club has a pre-kickoff table
    // in it — pin positions so the table line's numbers are part of the check
    const league = played.find((p) => p.fixture.type === 'GROUP_STAGE')!;
    const facts = { ...buildFacts(league.fixture, played, false), homePos: 3, awayPos: 21 };
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
