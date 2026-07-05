/**
 * ResultSource — the one interface every feed adapter implements (PRD §7.2).
 *
 * The whole data layer swaps in one module: `UefaApiSource` is the launch
 * implementation (match.uefa.com/v5 + zod validation, vendored uefa-api v1.0.2
 * types as reference); `FootballDataSource` (api.football-data.org) is the
 * documented fallback, stubbed behind the same interface.
 *
 * Mirror-UEFA verbatim (ADR-0006 / D6): whatever the feed records in
 * `score.regular` is the result — forfeits, abandonments and green-table
 * outcomes included. NO filtering logic lives here or anywhere downstream.
 */
import { z } from 'zod';
import {
  LivescoreArraySchema,
  UefaMatchArraySchema,
  type LivescoreItem,
  type MatchStatus,
  type MatchType,
  type UefaMatch,
  type WinnerReason,
} from './schema.js';

/* ------------------------------------------------------------------------ */
/* Domain types                                                              */
/* ------------------------------------------------------------------------ */

/** A fixture as the generator/relayer consumes it (teamA = home, teamB = away). */
export interface Fixture {
  /** UEFA match id (string in the feed) */
  uefaMatchId: string;
  /** Kickoff as unix seconds (UTC); null while UEFA has a date but no time yet */
  kickoffUnix: number | null;
  /** YYYY-MM-DD from the feed (always present) */
  kickoffDate: string;
  status: MatchStatus;
  type: MatchType;
  /** QUALIFYING | TOURNAMENT (undocumented feed field; tournament proper = TOURNAMENT) */
  competitionPhase: string | null;
  roundId: string;
  roundName: string;
  /** Matchday sequence number within the round (league phase: 1..8) */
  matchday: number | null;
  home: FixtureTeam;
  away: FixtureTeam;
  /** 1 or 2 on two-legged ties, null otherwise */
  legNumber: number | null;
  /**
   * Stable tie identity for two-legged rounds: round id + the unordered pair
   * of UEFA team ids. Identical for both legs, null for single matches.
   */
  tieId: string | null;
}

export interface FixtureTeam {
  uefaTeamId: string;
  name: string;
  /** UEFA 3-letter code where known (real teams have one; placeholders may not) */
  code: string | null;
  isPlaceHolder: boolean;
}

/**
 * A finished (or in-progress) result, decoded per the 90-minute rule
 * (PRD §5.1): `scoreA90`/`scoreB90` are ALWAYS `score.regular` — never the
 * after-extra-time total.
 */
export interface MatchResult {
  uefaMatchId: string;
  /** Raw feed status — the caller decides what FINISHED/ABANDONED/… mean (D6) */
  status: MatchStatus;
  /** 90-minute score (score.regular) — the on-chain scoreline */
  scoreA90: number;
  scoreB90: number;
  /** Full-time score incl. extra time (score.total) */
  totalA: number;
  totalB: number;
  /** Penalty shoot-out score, when one happened */
  penaltyA: number | null;
  penaltyB: number | null;
  /** Two-legged tie aggregate, when applicable */
  aggregateA: number | null;
  aggregateB: number | null;
  /** The decider went to extra time */
  extraTime: boolean;
  /** The decider went to a penalty shoot-out */
  penalties: boolean;
  /**
   * UEFA team id of the team that goes through (or lifts the trophy).
   * Derived from `winner.aggregate.team` on legs, else `winner.match.team`.
   * Null for drawn league-phase matches and first legs without an outcome.
   */
  advancerTeamId: string | null;
  /** Raw `winner.match.reason` (this match) — includes WIN_BY_FORFEIT verbatim */
  winnerReason: WinnerReason | null;
  /** Raw `winner.aggregate.reason` (the tie), when present */
  aggregateWinnerReason: WinnerReason | null;
}

export interface LiveMatch {
  uefaMatchId: string;
  status: MatchStatus;
  /** 90′ score so far, when the feed exposes one */
  scoreA90: number | null;
  scoreB90: number | null;
  /** Feed-provided hash of all exposed match properties — cheap change detector */
  hash: string;
}

export type SourceHealthIssue =
  | 'SOURCE_UNREACHABLE'
  | 'SOURCE_HTTP_ERROR'
  | 'SOURCE_SCHEMA_CHANGED';

export interface SourceHealth {
  ok: boolean;
  sourceId: string;
  checkedAt: string;
  latencyMs: number;
  issue: SourceHealthIssue | null;
  detail: string | null;
}

/** All feed access goes through this — PRD §7.2. */
export interface ResultSource {
  /** e.g. "uefa-api@1.0.2" — mirrored on-chain as `resultSourceRef` */
  id: string;
  /** All matches of a season (season = year the season ENDS, e.g. "2026") */
  fixtures(season: string): Promise<Fixture[]>;
  /** Result for one match ref (UEFA match id); null if the feed has no score yet */
  result(matchRef: string): Promise<MatchResult | null>;
  /** Running + recently finished matches (all competitions) */
  livescore(): Promise<LiveMatch[]>;
  health(): Promise<SourceHealth>;
}

/* ------------------------------------------------------------------------ */
/* Errors                                                                    */
/* ------------------------------------------------------------------------ */

/** Feed responded but the payload no longer matches our schemas → alert. */
export class SourceSchemaError extends Error {
  override readonly name = 'SourceSchemaError';
  constructor(
    readonly sourceId: string,
    readonly cause_: z.ZodError,
    context: string,
  ) {
    super(`[${sourceId}] schema drift in ${context}: ${cause_.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ')}`);
  }
}

export class NotImplementedError extends Error {
  override readonly name = 'NotImplementedError';
  constructor(what: string) {
    super(`${what} is not implemented yet (documented fallback, PRD §7.2)`);
  }
}

/* ------------------------------------------------------------------------ */
/* Pure mapping (exported for tests + reuse by the generator)                */
/* ------------------------------------------------------------------------ */

const kickoffUnix = (m: UefaMatch): number | null => {
  const iso = m.kickOffTime.dateTime;
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
};

/** Stable tie identity: round id + unordered team-id pair. */
export const tieIdOf = (m: UefaMatch): string | null => {
  if (m.type !== 'FIRST_LEG' && m.type !== 'SECOND_LEG') return null;
  const [a, b] = [m.homeTeam.id, m.awayTeam.id].sort();
  return `${m.round.id}:${a}-${b}`;
};

export const toFixture = (m: UefaMatch): Fixture => ({
  uefaMatchId: m.id,
  kickoffUnix: kickoffUnix(m),
  kickoffDate: m.kickOffTime.date,
  status: m.status,
  type: m.type,
  competitionPhase: m.competitionPhase ?? null,
  roundId: m.round.id,
  roundName: m.round.metaData.name,
  matchday: m.matchday.sequenceNumber ? Number(m.matchday.sequenceNumber) : null,
  home: toFixtureTeam(m.homeTeam),
  away: toFixtureTeam(m.awayTeam),
  legNumber: m.leg?.number ?? (m.type === 'FIRST_LEG' ? 1 : m.type === 'SECOND_LEG' ? 2 : null),
  tieId: tieIdOf(m),
});

const toFixtureTeam = (t: UefaMatch['homeTeam']): FixtureTeam => ({
  uefaTeamId: t.id,
  name: t.internationalName,
  code: t.teamCode ?? null,
  isPlaceHolder: t.isPlaceHolder,
});

const REASONS_EXTRA_TIME: readonly WinnerReason[] = ['WIN_ON_EXTRA_TIME'];
const REASONS_PENALTIES: readonly WinnerReason[] = ['WIN_ON_PENALTIES'];

/**
 * Decode a match with a score into a MatchResult (the 90-minute rule).
 *
 * Field-name subtleties locked in by the recorded live payloads
 * (test/fixtures/matches-ucl-2026-aet.json):
 * - `score.regular` is the 90′ score, `score.total` includes ET. AET is
 *   observable as `regular !== total` even when `winner.match.reason` is
 *   still `WIN_REGULAR` (a second leg won in 90′ after the TIE went to ET).
 * - On legs, the tie outcome (and therefore the advancer + the ET/pens
 *   bonuses, PRD §5.2) comes from `winner.aggregate`, not `winner.match`
 *   (e.g. 2047770: Juventus win the leg, Galatasaray advance).
 * - A shoot-out implies extra time was played (UCL format is
 *   EXTRA_TIME_WITH_PENALTIES), so `penalties === true` forces
 *   `extraTime === true` even though `regular === total` (e.g. the 2026
 *   final, 1-1 after 120′, 4-3 on pens).
 *
 * Returns null when the feed has no score for the match yet.
 */
export const toMatchResult = (m: UefaMatch): MatchResult | null => {
  const score = m.score;
  if (!score) return null;

  const matchReason = m.winner?.match?.reason ?? null;
  const aggregateReason = m.winner?.aggregate?.reason ?? null;

  const wentToPenalties =
    score.penalty !== undefined ||
    matchReason !== null && REASONS_PENALTIES.includes(matchReason) ||
    aggregateReason !== null && REASONS_PENALTIES.includes(aggregateReason);

  const wentToExtraTime =
    score.regular.home !== score.total.home ||
    score.regular.away !== score.total.away ||
    wentToPenalties ||
    matchReason !== null && REASONS_EXTRA_TIME.includes(matchReason) ||
    aggregateReason !== null && REASONS_EXTRA_TIME.includes(aggregateReason);

  // Advancer: the tie winner on legs, the match winner otherwise. DRAW (league
  // phase) has no advancer. Mirror-UEFA verbatim: WIN_BY_FORFEIT advances too.
  const advancer =
    m.winner?.aggregate?.team?.id ??
    (matchReason !== null && matchReason !== 'DRAW' ? m.winner?.match?.team?.id ?? null : null);

  return {
    uefaMatchId: m.id,
    status: m.status,
    scoreA90: score.regular.home,
    scoreB90: score.regular.away,
    totalA: score.total.home,
    totalB: score.total.away,
    penaltyA: score.penalty?.home ?? null,
    penaltyB: score.penalty?.away ?? null,
    aggregateA: score.aggregate?.home ?? null,
    aggregateB: score.aggregate?.away ?? null,
    extraTime: wentToExtraTime,
    penalties: wentToPenalties,
    advancerTeamId: advancer ?? null,
    winnerReason: matchReason,
    aggregateWinnerReason: aggregateReason,
  };
};

export const toLiveMatch = (item: LivescoreItem): LiveMatch => ({
  uefaMatchId: item.id,
  status: item.status,
  scoreA90: item.score?.regular.home ?? null,
  scoreB90: item.score?.regular.away ?? null,
  hash: item.hash,
});

/* ------------------------------------------------------------------------ */
/* UefaApiSource — the launch implementation                                 */
/* ------------------------------------------------------------------------ */

export const UEFA_MATCHES_URL = 'https://match.uefa.com/v5/matches';
export const UEFA_LIVESCORE_URL = 'https://match.uefa.com/v5/livescore';
/** UEFA Champions League (verified live against ?competitionId=1, PRD §7.1) */
export const UCL_COMPETITION_ID = '1';

export interface UefaApiSourceOptions {
  /** Injectable for tests / recorded fixtures */
  fetchImpl?: typeof fetch;
  competitionId?: string;
  /** Page size while paging a season (feed max observed well above this) */
  pageSize?: number;
}

export class UefaApiSource implements ResultSource {
  readonly id = 'uefa-api@1.0.2';

  private readonly fetchImpl: typeof fetch;
  private readonly competitionId: string;
  private readonly pageSize: number;

  constructor(options: UefaApiSourceOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.competitionId = options.competitionId ?? UCL_COMPETITION_ID;
    this.pageSize = options.pageSize ?? 50;
  }

  private async getJson(url: string): Promise<unknown> {
    const res = await this.fetchImpl(url, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`[${this.id}] HTTP ${res.status} for ${url}`);
    return res.json();
  }

  private parseMatches(payload: unknown, context: string): UefaMatch[] {
    const parsed = UefaMatchArraySchema.safeParse(payload);
    if (!parsed.success) throw new SourceSchemaError(this.id, parsed.error, context);
    return parsed.data;
  }

  /** All matches of a season, kickoff-ascending, zod-validated. */
  /** Raw season payload — the insights generator wants fixture+result in one pass. */
  async rawSeason(season: string): Promise<UefaMatch[]> {
    const all: UefaMatch[] = [];
    for (let offset = 0; ; offset += this.pageSize) {
      const url =
        `${UEFA_MATCHES_URL}?competitionId=${this.competitionId}` +
        `&seasonYear=${encodeURIComponent(season)}&order=ASC&limit=${this.pageSize}&offset=${offset}`;
      const page = this.parseMatches(await this.getJson(url), `matches page offset=${offset}`);
      all.push(...page);
      if (page.length < this.pageSize) break;
    }
    return all;
  }

  async fixtures(season: string): Promise<Fixture[]> {
    return (await this.rawSeason(season)).map(toFixture);
  }

  /** Result by UEFA match id; null when the feed has no score yet. */
  async result(matchRef: string): Promise<MatchResult | null> {
    const url = `${UEFA_MATCHES_URL}?matchId=${encodeURIComponent(matchRef)}`;
    const matches = this.parseMatches(await this.getJson(url), `match ${matchRef}`);
    const match = matches.find((m) => m.id === matchRef) ?? null;
    if (!match) return null;
    return toMatchResult(match);
  }

  async livescore(): Promise<LiveMatch[]> {
    const payload = await this.getJson(UEFA_LIVESCORE_URL);
    const parsed = LivescoreArraySchema.safeParse(payload);
    if (!parsed.success) throw new SourceSchemaError(this.id, parsed.error, 'livescore');
    return parsed.data.map(toLiveMatch);
  }

  /** One cheap validated request; classifies failures for the alerting layer. */
  async health(): Promise<SourceHealth> {
    const checkedAt = new Date().toISOString();
    const started = Date.now();
    const done = (issue: SourceHealthIssue | null, detail: string | null): SourceHealth => ({
      ok: issue === null,
      sourceId: this.id,
      checkedAt,
      latencyMs: Date.now() - started,
      issue,
      detail,
    });
    try {
      const url = `${UEFA_MATCHES_URL}?competitionId=${this.competitionId}&limit=1&offset=0`;
      const payload = await this.getJson(url);
      this.parseMatches(payload, 'health probe');
      return done(null, null);
    } catch (err) {
      if (err instanceof SourceSchemaError) return done('SOURCE_SCHEMA_CHANGED', err.message);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('HTTP ')) return done('SOURCE_HTTP_ERROR', msg);
      return done('SOURCE_UNREACHABLE', msg);
    }
  }
}

/* ------------------------------------------------------------------------ */
/* FootballDataSource — documented fallback, stubbed (PRD §7.2)              */
/* ------------------------------------------------------------------------ */

/**
 * api.football-data.org free tier covers the UCL. Same interface, so the
 * whole data layer swaps by constructing this instead of UefaApiSource and
 * pointing the on-chain `resultSourceRef` at it. Methods throw
 * NotImplementedError until the fallback is actually needed.
 */
export class FootballDataSource implements ResultSource {
  readonly id = 'football-data.org@v4';

  fixtures(_season: string): Promise<Fixture[]> {
    return Promise.reject(new NotImplementedError(`${this.id} fixtures()`));
  }

  result(_matchRef: string): Promise<MatchResult | null> {
    return Promise.reject(new NotImplementedError(`${this.id} result()`));
  }

  livescore(): Promise<LiveMatch[]> {
    return Promise.reject(new NotImplementedError(`${this.id} livescore()`));
  }

  health(): Promise<SourceHealth> {
    return Promise.resolve({
      ok: false,
      sourceId: this.id,
      checkedAt: new Date().toISOString(),
      latencyMs: 0,
      issue: 'SOURCE_UNREACHABLE',
      detail: 'stub — fallback source not implemented yet',
    });
  }
}
