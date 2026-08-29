import { describe, expect, it } from 'vitest';
import {
  buildStrengthIndex,
  fetchClubCoefficients,
  fetchLeaguePhaseRanks,
  runsFromMatches,
  UNRANKED_COEFFICIENT,
  verdictFor,
  type TeamStrength,
} from '../src/strength.js';
import type { UefaMatch } from '../src/schema.js';

/* ------------------------------------------------------------------------ */
/* runsFromMatches                                                           */
/* ------------------------------------------------------------------------ */

const team = (id: string, isPlaceHolder = false) => ({ id, isPlaceHolder }) as UefaMatch['homeTeam'];

const match = (
  roundType: string,
  home: string,
  away: string,
  extra: Partial<UefaMatch> = {},
): UefaMatch =>
  ({
    id: `${roundType}-${home}-${away}`,
    competitionPhase: 'TOURNAMENT',
    round: { id: '1', metaData: { name: roundType, type: roundType } },
    homeTeam: team(home),
    awayTeam: team(away),
    ...extra,
  }) as unknown as UefaMatch;

describe('runsFromMatches', () => {
  it('keeps the deepest round a club appeared in, whatever order the feed lists', () => {
    const runs = runsFromMatches([
      match('QUARTER_FINALS', 'a', 'b'),
      match('GROUP_STANDINGS', 'a', 'c'),
      match('ROUND_OF_16', 'a', 'd'),
    ]);
    expect(runs.get('a')).toBe('QUARTER_FINAL');
    expect(runs.get('c')).toBe('LEAGUE_PHASE');
  });

  it('promotes the final winner over the losing finalist', () => {
    const final = match('FINAL', 'psg', 'ars', {
      winner: { match: { team: { id: 'psg' }, reason: 'WIN_ON_PENALTIES' } },
    } as Partial<UefaMatch>);
    const runs = runsFromMatches([final]);
    expect(runs.get('psg')).toBe('WINNER');
    expect(runs.get('ars')).toBe('FINALIST');
  });

  it('reads the tie winner on two-legged rounds, not just the match winner', () => {
    const runs = runsFromMatches([
      match('FINAL', 'a', 'b', {
        winner: {
          match: { team: { id: 'b' }, reason: 'WIN_REGULAR' },
          aggregate: { team: { id: 'a' }, reason: 'WIN_ON_AWAY_GOAL' },
        },
      } as Partial<UefaMatch>),
    ]);
    expect(runs.get('a')).toBe('WINNER');
  });

  it('ignores qualifying: a club knocked out before the league phase reads as absent', () => {
    const runs = runsFromMatches([
      match('THIRD_QUALIFYING', 'q', 'r', { competitionPhase: 'QUALIFYING' } as Partial<UefaMatch>),
    ]);
    expect(runs.has('q')).toBe(false);
  });

  it('skips placeholder teams — a bracket slot is not a club', () => {
    const fixture = match('ROUND_OF_16', 'real', 'tbd');
    (fixture.awayTeam as { isPlaceHolder: boolean }).isPlaceHolder = true;
    const runs = runsFromMatches([fixture]);
    expect(runs.get('real')).toBe('ROUND_OF_16');
    expect(runs.has('tbd')).toBe(false);
  });

  it('ignores rounds it does not recognise rather than guessing a depth', () => {
    expect(runsFromMatches([match('INTERGALACTIC_PLAYOFF', 'a', 'b')]).size).toBe(0);
  });
});

/* ------------------------------------------------------------------------ */
/* buildStrengthIndex                                                        */
/* ------------------------------------------------------------------------ */

describe('buildStrengthIndex', () => {
  it('floors an unranked club instead of dropping it from the comparison', () => {
    const index = buildStrengthIndex({
      teamIds: ['como'],
      coefficients: new Map(),
      prevRuns: new Map(),
      prevLeagueRanks: new Map(),
    });
    // No coefficient at all means no European points across the five-season
    // window — the floor is the honest reading, and it keeps the call total.
    expect(index.get('como')).toEqual({
      coefRank: null,
      coefValue: UNRANKED_COEFFICIENT,
      prevRun: 'ABSENT',
      prevLeagueRank: null,
    });
  });

  it('carries coefficient, run and league finish together', () => {
    const index = buildStrengthIndex({
      teamIds: ['napoli'],
      coefficients: new Map([['napoli', { rank: 34, value: 63 }]]),
      prevRuns: new Map([['napoli', 'LEAGUE_PHASE' as const]]),
      prevLeagueRanks: new Map([['napoli', 30]]),
    });
    expect(index.get('napoli')).toEqual({
      coefRank: 34,
      coefValue: 63,
      prevRun: 'LEAGUE_PHASE',
      prevLeagueRank: 30,
    });
  });
});

/* ------------------------------------------------------------------------ */
/* verdictFor                                                                */
/* ------------------------------------------------------------------------ */

const strength = (value: number, rank: number | null = 1): TeamStrength => ({
  coefRank: rank,
  coefValue: value,
  prevRun: 'ABSENT',
  prevLeagueRank: null,
});

describe('verdictFor', () => {
  it('splits two identical clubs by home ground, and says so', () => {
    const v = verdictFor(strength(100), strength(100));
    expect(v.side).toBe('home');
    expect(v.tier).toBe('edge');
    expect(v.homeGroundDecides).toBe(true);
  });

  it('does not credit home ground when the home side was already ahead', () => {
    const v = verdictFor(strength(140), strength(100));
    expect(v.side).toBe('home');
    expect(v.homeGroundDecides).toBe(false);
  });

  it('lets a strong enough away side win the call anyway', () => {
    const v = verdictFor(strength(60), strength(130));
    expect(v.side).toBe('away');
    expect(v.homeGroundDecides).toBe(false);
  });

  it('calls a real mismatch clear, not merely favoured', () => {
    // Barcelona (113.25) hosting a club with no coefficient at all.
    expect(verdictFor(strength(113.25), strength(UNRANKED_COEFFICIENT)).tier).toBe('clear');
  });

  it('refuses to pick when the gap is inside the noise', () => {
    // 20% the other way is almost exactly cancelled by home ground.
    const v = verdictFor(strength(100), strength(122));
    expect(v.side).toBe('level');
    expect(v.homeGroundDecides).toBe(false);
  });

  it('scales by ratio, not by rank distance', () => {
    // The same 19-place gap in the ranking, from real 2026 coefficients: near
    // the top it is a chasm, in the tail it is nothing. Rank arithmetic cannot
    // tell those apart; the ratio can.
    const top = verdictFor(strength(147.5, 1), strength(80.75, 20)); // Bayern v Porto
    const tail = verdictFor(strength(27.5, 80), strength(21, 99)); // Stuttgart v LASK
    expect(top.tier).toBe('favourite');
    expect(tail.tier).toBe('edge');
  });
});

/* ------------------------------------------------------------------------ */
/* Feed readers                                                              */
/* ------------------------------------------------------------------------ */

const jsonResponse = (body: unknown) =>
  ({ ok: true, status: 200, json: async () => body }) as Response;

describe('feed readers', () => {
  it('reads coefficients and skips members UEFA lists without a ranking', () => {
    const payload = {
      data: {
        members: [
          { member: { id: '50037' }, overallRanking: { position: 1, totalValue: 147.5 } },
          { member: { id: '79946' } }, // first-timer: listed, no ranking block
          { member: { id: '52747' }, overallRanking: null },
        ],
      },
    };
    return fetchClubCoefficients('2026', {
      fetchImpl: async () => jsonResponse(payload),
    }).then((coefficients) => {
      expect(coefficients.get('50037')).toEqual({ rank: 1, value: 147.5 });
      expect(coefficients.has('79946')).toBe(false);
      expect(coefficients.has('52747')).toBe(false);
    });
  });

  it('flattens every standings group into one team → rank map', async () => {
    const ranks = await fetchLeaguePhaseRanks('2026', {
      fetchImpl: async () =>
        jsonResponse([
          { items: [{ rank: 1, team: { id: '52280' } }, { rank: 2, team: { id: '50037' } }] },
        ]),
    });
    expect(ranks.get('52280')).toBe(1);
    expect(ranks.get('50037')).toBe(2);
  });

  it('throws on a non-200 rather than returning a silently empty index', async () => {
    await expect(
      fetchClubCoefficients('2026', {
        fetchImpl: async () => ({ ok: false, status: 503 }) as Response,
      }),
    ).rejects.toThrow('HTTP 503');
  });

  it('throws when the payload shape changes under us', async () => {
    await expect(
      fetchLeaguePhaseRanks('2026', {
        fetchImpl: async () => jsonResponse({ standings: [] }),
      }),
    ).rejects.toThrow();
  });
});
