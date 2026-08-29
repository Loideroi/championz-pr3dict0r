import { z } from 'zod';
import type { UefaMatch } from './schema.js';

/**
 * Team strength facts for Match Insights (ADR-0011).
 *
 * The insight generator could only ever describe what had already happened
 * this season, so before a ball is kicked every fixture rendered the same
 * sentence. These are the two things UEFA publishes that say something about a
 * fixture BEFORE it has a history:
 *
 *   1. the club coefficient — UEFA's own five-season strength ranking, and the
 *      basis for the draw pots, from `comp.uefa.com/v2/coefficients`;
 *   2. last season's Champions League run, derived from the previous season's
 *      match feed plus its final league-phase table.
 *
 * Both are facts with a source, not opinions, and both are stable for a whole
 * season — so the favourite call below is a transparent function of published
 * numbers rather than a model anyone has to trust.
 */

export const UEFA_COEFFICIENTS_URL = 'https://comp.uefa.com/v2/coefficients';
export const UEFA_STANDINGS_URL = 'https://standings.uefa.com/v1/standings';

/** How far a club got in the previous season's Champions League. */
export type PrevRun =
  | 'WINNER'
  | 'FINALIST'
  | 'SEMI_FINAL'
  | 'QUARTER_FINAL'
  | 'ROUND_OF_16'
  | 'PLAY_OFF'
  | 'LEAGUE_PHASE'
  | 'ABSENT';

export interface Coefficient {
  /** Position in UEFA's club coefficient ranking (1 = strongest in Europe). */
  rank: number;
  /** Coefficient points over the five-season window. */
  value: number;
}

export interface TeamStrength {
  /** null when the club does not appear in the ranking at all. */
  coefRank: number | null;
  /** {@link UNRANKED_COEFFICIENT} when unranked, so comparisons stay total. */
  coefValue: number;
  prevRun: PrevRun;
  /** Finishing position in last season's league phase (1–36), when they were in it. */
  prevLeagueRank: number | null;
}

/**
 * UEFA lists 415 clubs and stops at a coefficient of 1, so a club that is
 * absent has earned nothing in Europe across the whole window. Treating that
 * as the floor keeps every fixture comparable; the copy still says
 * "unranked" rather than inventing a position.
 */
export const UNRANKED_COEFFICIENT = 1;

/* ------------------------------------------------------------------------ */
/* Previous season's run — derived from the season match feed                */
/* ------------------------------------------------------------------------ */

/** `round.metaData.type` → how deep it is. Deepest appearance wins. */
const ROUND_DEPTH: Record<string, { depth: number; run: PrevRun }> = {
  GROUP_STANDINGS: { depth: 1, run: 'LEAGUE_PHASE' },
  FINAL_TOURNAMENT_PLAY_OFF: { depth: 2, run: 'PLAY_OFF' },
  ROUND_OF_16: { depth: 3, run: 'ROUND_OF_16' },
  QUARTER_FINALS: { depth: 4, run: 'QUARTER_FINAL' },
  SEMIFINAL: { depth: 5, run: 'SEMI_FINAL' },
  FINAL: { depth: 6, run: 'FINALIST' },
};
const WINNER_DEPTH = 7;

/**
 * Deepest round each club reached in a completed season. Qualifying rounds are
 * excluded: "reached the league phase" is the floor of a tournament run, and a
 * club knocked out in the third qualifying round never entered the tournament
 * proper — it reads as ABSENT, which is what a predictor cares about.
 */
export function runsFromMatches(matches: UefaMatch[]): Map<string, PrevRun> {
  const deepest = new Map<string, { depth: number; run: PrevRun }>();
  const record = (teamId: string, entry: { depth: number; run: PrevRun }) => {
    const current = deepest.get(teamId);
    if (!current || current.depth < entry.depth) deepest.set(teamId, entry);
  };

  for (const match of matches) {
    if ((match.competitionPhase ?? 'TOURNAMENT') !== 'TOURNAMENT') continue;
    const entry = ROUND_DEPTH[match.round.metaData.type ?? ''];
    if (!entry) continue;
    for (const team of [match.homeTeam, match.awayTeam]) {
      if (team.isPlaceHolder) continue;
      record(team.id, entry);
    }
    if (match.round.metaData.type === 'FINAL') {
      // Mirror the feed: the trophy goes to whoever it says won, penalties included.
      const winner = match.winner?.aggregate?.team?.id ?? match.winner?.match?.team?.id;
      if (winner) record(winner, { depth: WINNER_DEPTH, run: 'WINNER' });
    }
  }
  return new Map([...deepest].map(([id, entry]) => [id, entry.run]));
}

/* ------------------------------------------------------------------------ */
/* Feed readers                                                              */
/* ------------------------------------------------------------------------ */

const CoefficientsSchema = z.object({
  data: z.object({
    members: z.array(
      z.object({
        member: z.object({ id: z.string().min(1) }),
        overallRanking: z
          .object({ position: z.number(), totalValue: z.number() })
          .nullish(),
      }),
    ),
  }),
});

const StandingsSchema = z.array(
  z.object({
    items: z.array(
      z.object({ rank: z.number(), team: z.object({ id: z.string().min(1) }) }),
    ),
  }),
);

export interface FeedOptions {
  fetchImpl?: typeof fetch;
}

async function getJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const res = await fetchImpl(url, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

/**
 * Club coefficients for the season that seeded `seasonYear`'s draw — i.e. the
 * ranking published at the end of the previous season, which is the one the
 * pots were built from.
 */
export async function fetchClubCoefficients(
  baseSeasonYear: string,
  options: FeedOptions = {},
): Promise<Map<string, Coefficient>> {
  const url =
    `${UEFA_COEFFICIENTS_URL}?coefficientRange=OVERALL&coefficientType=MEN_CLUB` +
    `&language=EN&page=1&pagesize=500&seasonYear=${encodeURIComponent(baseSeasonYear)}`;
  const parsed = CoefficientsSchema.parse(await getJson(url, options.fetchImpl ?? fetch));
  const out = new Map<string, Coefficient>();
  for (const entry of parsed.data.members) {
    if (!entry.overallRanking) continue;
    out.set(entry.member.id, {
      rank: entry.overallRanking.position,
      value: entry.overallRanking.totalValue,
    });
  }
  return out;
}

/** Final league-phase positions of a completed season (1–36). */
export async function fetchLeaguePhaseRanks(
  seasonYear: string,
  options: FeedOptions = {},
): Promise<Map<string, number>> {
  const url =
    `${UEFA_STANDINGS_URL}?competitionId=1&seasonYear=${encodeURIComponent(seasonYear)}`;
  const parsed = StandingsSchema.parse(await getJson(url, options.fetchImpl ?? fetch));
  const out = new Map<string, number>();
  for (const group of parsed) {
    for (const item of group.items) out.set(item.team.id, item.rank);
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Index                                                                     */
/* ------------------------------------------------------------------------ */

export function buildStrengthIndex(input: {
  teamIds: Iterable<string>;
  coefficients: Map<string, Coefficient>;
  prevRuns: Map<string, PrevRun>;
  prevLeagueRanks: Map<string, number>;
}): Map<string, TeamStrength> {
  const out = new Map<string, TeamStrength>();
  for (const teamId of input.teamIds) {
    const coefficient = input.coefficients.get(teamId) ?? null;
    out.set(teamId, {
      coefRank: coefficient?.rank ?? null,
      coefValue: coefficient?.value ?? UNRANKED_COEFFICIENT,
      prevRun: input.prevRuns.get(teamId) ?? 'ABSENT',
      prevLeagueRank: input.prevLeagueRanks.get(teamId) ?? null,
    });
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* The call                                                                  */
/* ------------------------------------------------------------------------ */

export type EdgeTier = 'level' | 'edge' | 'favourite' | 'clear';

export interface Verdict {
  side: 'home' | 'away' | 'level';
  tier: EdgeTier;
  /** True when the coefficients favour the other side and home ground flips it. */
  homeGroundDecides: boolean;
}

/**
 * Home advantage on the log-coefficient scale. 0.20 ≈ a 22% coefficient
 * advantage, which puts it between "nothing" and "a pot's worth" — enough to
 * decide 17 of this season's 144 league-phase fixtures and no more.
 */
export const HOME_ADVANTAGE = 0.2;

/**
 * Thresholds on |edge|, measured against this season's 144 league-phase
 * fixtures so the tiers spread instead of piling into one: level 8%, edge 39%,
 * favourite 26%, clear 26%.
 *
 * The level band is deliberately narrower than home advantage. A wider one
 * swallows every fixture where the visitors are marginally stronger and home
 * ground cancels it out — 22 of the 144 — and answers "too close to call" when
 * there is in fact something to say.
 */
const TIER_BOUNDS: readonly [EdgeTier, number][] = [
  ['level', 0.1],
  ['edge', 0.55],
  ['favourite', 1.2],
  ['clear', Number.POSITIVE_INFINITY],
];

/**
 * Who the published numbers favour, and by how much. A ratio of coefficients
 * rather than a difference of ranks: the gap between Europe's 1st and 6th is
 * worth more than the gap between its 90th and 95th, and only the ratio knows
 * that.
 */
export function verdictFor(home: TeamStrength, away: TeamStrength): Verdict {
  const raw = Math.log(home.coefValue / away.coefValue);
  const edge = raw + HOME_ADVANTAGE;
  const magnitude = Math.abs(edge);
  const tier = TIER_BOUNDS.find(([, bound]) => magnitude < bound)![0];
  if (tier === 'level') return { side: 'level', tier, homeGroundDecides: false };
  return {
    side: edge > 0 ? 'home' : 'away',
    tier,
    // Only meaningful when home actually wins the call on the back of it.
    homeGroundDecides: edge > 0 && raw <= 0,
  };
}
