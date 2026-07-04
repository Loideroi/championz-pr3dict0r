/**
 * Zod schemas vs the RECORDED LIVE payloads (captured 2026-07-04 from
 * match.uefa.com/v5, archived 2025/26 UCL season) — acceptance criteria:
 * "One recorded live payload checked into test fixtures; zod schemas match it
 * field-for-field" and "a deliberately malformed payload fails zod validation
 * with a typed error (no silent undefined)".
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  ScoreSchema,
  UefaMatchArraySchema,
  UefaMatchSchema,
} from '../src/schema.js';
import { AET_BATCH, FIRST20, KNOWN, loadFixture } from './helpers.js';

describe('recorded live payloads parse', () => {
  it('first-20 capture (limit=20&offset=0) parses field-for-field', () => {
    const raw = loadFixture<unknown[]>(FIRST20);
    expect(raw).toHaveLength(20);
    const parsed = UefaMatchArraySchema.parse(raw);
    expect(parsed).toHaveLength(20);
    // every consumed field is populated, never silently undefined
    for (const m of parsed) {
      expect(m.id).toMatch(/^\d+$/);
      expect(m.kickOffTime.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(m.homeTeam.internationalName.length).toBeGreaterThan(0);
      expect(m.awayTeam.id.length).toBeGreaterThan(0);
      expect(typeof m.homeTeam.isPlaceHolder).toBe('boolean');
      expect(m.round.metaData.name.length).toBeGreaterThan(0);
    }
  });

  it('knockout batch (contains real AET + penalties matches) parses', () => {
    const parsed = UefaMatchArraySchema.parse(loadFixture(AET_BATCH));
    expect(parsed).toHaveLength(50);
    const ids = parsed.map((m) => m.id);
    expect(ids).toContain(KNOWN.aetSecondLeg);
    expect(ids).toContain(KNOWN.aetAdvancerIsNotMatchWinner);
    expect(ids).toContain(KNOWN.finalOnPenalties);
  });

  it('archive covers all four match types and finished statuses', () => {
    const parsed = UefaMatchArraySchema.parse(loadFixture(AET_BATCH));
    const types = new Set(parsed.map((m) => m.type));
    expect(types).toEqual(new Set(['GROUP_STAGE', 'SINGLE', 'FIRST_LEG', 'SECOND_LEG']));
    expect(new Set(parsed.map((m) => m.status))).toEqual(new Set(['FINISHED']));
  });

  it('season feed carries the undocumented competitionPhase field', () => {
    const parsed = UefaMatchArraySchema.parse(loadFixture(AET_BATCH));
    for (const m of parsed) expect(m.competitionPhase).toBe('TOURNAMENT');
  });
});

describe('malformed payloads fail loudly (typed ZodError)', () => {
  const validMatch = () =>
    structuredClone(loadFixture<Record<string, unknown>[]>(AET_BATCH)[0]!);

  it('missing score.regular is a typed error, not a silent undefined', () => {
    const m = validMatch();
    delete (m.score as Record<string, unknown>).regular;
    const res = UefaMatchSchema.safeParse(m);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBeInstanceOf(z.ZodError);
      expect(res.error.issues.some((i) => i.path.join('.') === 'score.regular')).toBe(true);
    }
  });

  it('a renamed status enum value (schema drift) is rejected', () => {
    const m = validMatch();
    m.status = 'FULL_TIME'; // plausible drift
    const res = UefaMatchSchema.safeParse(m);
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0]?.path).toEqual(['status']);
  });

  it('a string where a goal count should be is rejected', () => {
    const res = ScoreSchema.safeParse({ regular: { home: '3', away: 0 }, total: { home: 3, away: 0 } });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.error.issues[0]?.path).toEqual(['regular', 'home']);
  });

  it('missing homeTeam.id is rejected with its exact path', () => {
    const m = validMatch();
    delete (m.homeTeam as Record<string, unknown>).id;
    const res = UefaMatchSchema.safeParse(m);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.map((i) => i.path.join('.'))).toContain('homeTeam.id');
    }
  });

  it('unknown EXTRA fields are tolerated (UEFA may add fields freely)', () => {
    const m = validMatch();
    m.someBrandNewUefaField = { nested: true };
    expect(UefaMatchSchema.safeParse(m).success).toBe(true);
  });
});
