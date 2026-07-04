/**
 * Zod schemas for the UEFA match API (match.uefa.com/v5) — PRD §7.1, §8.3.
 *
 * Locked against a LIVE payload captured 2026-07-04 from
 * `match.uefa.com/v5/matches?competitionId=1&seasonYear=2026` (the archived
 * 2025/26 UCL season) — see `test/fixtures/matches-ucl-2026-*.json` and
 * `test/fixtures/capture-meta.json`. The vendored reference types live in
 * `vendor/uefa-api-types.ts` (uefa-api v1.0.2).
 *
 * Validation policy (drift must be LOUD, noise must not):
 * - Fields the oracle CONSUMES are required and strictly typed — if UEFA
 *   renames `score.regular` or adds a new `status`, parsing throws a ZodError
 *   (→ SOURCE_SCHEMA_CHANGED health state, slice 06).
 * - Unknown EXTRA fields are tolerated (zod objects strip them), so UEFA can
 *   add fields without breaking us.
 *
 * Divergences from the vendored uefa-api v1.0.2 types, observed in the live
 * payload (2026-07-04):
 * - `matchNumber` is present but `null` (typed `number | undefined` upstream).
 * - Undocumented top-level field `competitionPhase`: `"QUALIFYING" | "TOURNAMENT"`
 *   — the season feed includes qualifying rounds; the tournament proper is
 *   `competitionPhase === "TOURNAMENT"`.
 * - On two-legged ties, `winner.match.reason` describes the LEG (a second leg
 *   that goes to extra time still reads `WIN_REGULAR` if the leg itself was
 *   decided in 90′); the tie outcome lives in `winner.aggregate.reason`
 *   (`WIN_ON_AGGREGATE | WIN_ON_EXTRA_TIME | ...`) and `winner.aggregate.team`.
 */
import { z } from 'zod';

/** `score.regular` / `score.total` / `score.penalty` / `score.aggregate` */
export const ScoreResultSchema = z.object({
  home: z.number().int().nonnegative(),
  away: z.number().int().nonnegative(),
});

/**
 * The 90-minute rule (PRD §5.1) hangs off this object: `regular` is the 90′
 * score, `total` includes extra time. Both are REQUIRED whenever a score is
 * present — a payload with a score but no `regular` is schema drift.
 */
export const ScoreSchema = z.object({
  regular: ScoreResultSchema,
  total: ScoreResultSchema,
  penalty: ScoreResultSchema.optional(),
  aggregate: ScoreResultSchema.optional(),
});

export const MatchStatusSchema = z.enum([
  'UPCOMING',
  'FINISHED',
  'LIVE',
  'CURRENT',
  'ABANDONED',
  'CANCELED',
]);
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export const MatchTypeSchema = z.enum([
  'GROUP_STAGE',
  'SINGLE',
  'FIRST_LEG',
  'SECOND_LEG',
]);
export type MatchType = z.infer<typeof MatchTypeSchema>;

export const WinnerReasonSchema = z.enum([
  'WIN_REGULAR',
  'WIN_ON_PENALTIES',
  'WIN_ON_AGGREGATE',
  'WIN_ON_AWAY_GOAL',
  'WIN_ON_EXTRA_TIME',
  'WIN_BY_FORFEIT',
  'DRAW',
]);
export type WinnerReason = z.infer<typeof WinnerReasonSchema>;

export const TeamSchema = z.object({
  id: z.string().min(1),
  internationalName: z.string().min(1),
  isPlaceHolder: z.boolean(),
  /** 3-letter code (e.g. PSG, GAL); observed on every real team in the archive */
  teamCode: z.string().optional(),
  countryCode: z.string().optional(),
});
export type UefaTeam = z.infer<typeof TeamSchema>;

export const WinnerDetailsSchema = z.object({
  reason: WinnerReasonSchema,
  team: TeamSchema.optional(),
});

export const WinnerSchema = z.object({
  /** Outcome of THIS match (a leg's own 90′/ET result) */
  match: WinnerDetailsSchema.optional(),
  /** Outcome of the two-legged tie — only present on legs */
  aggregate: WinnerDetailsSchema.optional(),
});

export const KickOffTimeSchema = z.object({
  /** YYYY-MM-DD */
  date: z.string().min(1),
  /** ISO 8601; absent only while UEFA has date-but-not-time scheduled */
  dateTime: z.string().optional(),
  utcOffsetInHours: z.number().optional(),
});

export const RoundSchema = z.object({
  id: z.string().min(1),
  /** GROUP | KNOCK_OUT | FINAL */
  mode: z.string().optional(),
  /** GROUP | KNOCK_OUT_ONE_LEG | KNOCK_OUT_TWO_LEGS */
  modeDetail: z.string().optional(),
  metaData: z.object({
    name: z.string().min(1),
    type: z.string().optional(),
  }),
});

export const MatchdaySchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  /** REGULAR | EXTRA_TIME_WITH_PENALTIES | ... */
  format: z.string().optional(),
  sequenceNumber: z.string().optional(),
  name: z.string().optional(),
  longName: z.string().optional(),
});

export const LegSchema = z.object({
  number: z.number().int().min(1),
});

/**
 * One match from `match.uefa.com/v5/matches`.
 * Only the fields the oracle consumes; everything else is tolerated + dropped.
 */
export const UefaMatchSchema = z.object({
  id: z.string().min(1),
  seasonYear: z.string().optional(),
  kickOffTime: KickOffTimeSchema,
  status: MatchStatusSchema,
  type: MatchTypeSchema,
  homeTeam: TeamSchema,
  awayTeam: TeamSchema,
  score: ScoreSchema.optional(),
  winner: WinnerSchema.optional(),
  round: RoundSchema,
  matchday: MatchdaySchema,
  leg: LegSchema.optional().nullable(),
  /** Undocumented but present in the live feed: QUALIFYING | TOURNAMENT */
  competitionPhase: z.string().optional(),
});
export type UefaMatch = z.infer<typeof UefaMatchSchema>;

export const UefaMatchArraySchema = z.array(UefaMatchSchema);

/**
 * One entry from `match.uefa.com/v5/livescore` — a reduced Match plus a
 * `hash` of all exposed properties (the relayer's cheap change detector,
 * PRD §7.1/§8).
 */
export const LivescoreItemSchema = z.object({
  id: z.string().min(1),
  status: MatchStatusSchema,
  score: ScoreSchema.optional(),
  winner: WinnerSchema.optional(),
  hash: z.string().min(1),
});
export type LivescoreItem = z.infer<typeof LivescoreItemSchema>;

export const LivescoreArraySchema = z.array(LivescoreItemSchema);
