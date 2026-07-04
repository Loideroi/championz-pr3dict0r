/**
 * The 90-minute rule (PRD §5.1) against REAL archive matches — acceptance
 * criterion: "A real AET match from the archive shows regular ≠ total and
 * parses into 90′ score + ET/pens/advancer flags correctly".
 */
import { describe, expect, it } from 'vitest';
import { UefaMatchArraySchema, type UefaMatch } from '../src/schema.js';
import { toMatchResult } from '../src/source.js';
import { AET_BATCH, KNOWN, loadFixture } from './helpers.js';

const archive = UefaMatchArraySchema.parse(loadFixture(AET_BATCH));
const byId = new Map(archive.map((m) => [m.id, m]));
const get = (id: string): UefaMatch => {
  const m = byId.get(id);
  if (!m) throw new Error(`match ${id} missing from recorded archive`);
  return m;
};

describe('real AET second leg (Sporting CP 3-0 / 5-0 aet v Bodø/Glimt)', () => {
  const result = toMatchResult(get(KNOWN.aetSecondLeg))!;

  it('regular ≠ total in the raw feed', () => {
    const m = get(KNOWN.aetSecondLeg);
    expect(m.score!.regular).not.toEqual(m.score!.total);
  });

  it('scoreline is the 90′ score (score.regular), never the AET total', () => {
    expect([result.scoreA90, result.scoreB90]).toEqual([3, 0]);
    expect([result.totalA, result.totalB]).toEqual([5, 0]);
  });

  it('extraTime flag set, penalties not', () => {
    expect(result.extraTime).toBe(true);
    expect(result.penalties).toBe(false);
    expect(result.penaltyA).toBeNull();
  });

  it('advancer comes from winner.aggregate.team even though winner.match.reason is WIN_REGULAR', () => {
    expect(result.winnerReason).toBe('WIN_REGULAR'); // the leg itself was won in 90′
    expect(result.aggregateWinnerReason).toBe('WIN_ON_EXTRA_TIME'); // the TIE went to ET
    expect(result.advancerTeamId).toBe(KNOWN.sportingTeamId);
    expect([result.aggregateA, result.aggregateB]).toEqual([5, 3]);
  });
});

describe('real AET tie where the leg winner does NOT advance (Juventus 3-0 Galatasaray, Gala through)', () => {
  const result = toMatchResult(get(KNOWN.aetAdvancerIsNotMatchWinner))!;

  it('Juventus win the leg 3-0 in 90′', () => {
    expect([result.scoreA90, result.scoreB90]).toEqual([3, 0]);
    expect(result.winnerReason).toBe('WIN_REGULAR');
  });

  it('but Galatasaray advance on extra time in the tie', () => {
    expect(result.extraTime).toBe(true);
    expect(result.advancerTeamId).toBe(KNOWN.galatasarayTeamId);
    expect(result.aggregateWinnerReason).toBe('WIN_ON_EXTRA_TIME');
  });
});

describe('the final on penalties (Paris 1-1 Arsenal, 4-3 pens)', () => {
  const result = toMatchResult(get(KNOWN.finalOnPenalties))!;

  it('90′ score stays 1-1; penalties never leak into the scoreline', () => {
    expect([result.scoreA90, result.scoreB90]).toEqual([1, 1]);
    expect([result.totalA, result.totalB]).toEqual([1, 1]); // no ET goals
    expect([result.penaltyA, result.penaltyB]).toEqual([4, 3]);
  });

  it('penalties implies extra time was played (UCL EXTRA_TIME_WITH_PENALTIES format)', () => {
    expect(result.penalties).toBe(true);
    expect(result.extraTime).toBe(true);
  });

  it('advancer (trophy) from winner.match on a SINGLE match', () => {
    expect(result.winnerReason).toBe('WIN_ON_PENALTIES');
    expect(result.advancerTeamId).toBe(KNOWN.parisTeamId);
  });
});

describe('regular matches across the archive', () => {
  it('a 90′-decided match has no flags and no advancer confusion', () => {
    const plain = archive.find(
      (m) => m.type === 'GROUP_STAGE' && m.winner?.match?.reason === 'WIN_REGULAR',
    )!;
    const r = toMatchResult(plain)!;
    expect([r.scoreA90, r.scoreB90]).toEqual([r.totalA, r.totalB]);
    expect(r.extraTime).toBe(false);
    expect(r.penalties).toBe(false);
    expect(r.advancerTeamId).toBe(plain.winner!.match!.team!.id);
  });

  it('a league-phase DRAW yields no advancer', () => {
    const draw = archive.find(
      (m) => m.type === 'GROUP_STAGE' && m.winner?.match?.reason === 'DRAW',
    );
    if (!draw) return; // archive slice has no league draw — covered by live seasons
    const r = toMatchResult(draw)!;
    expect(r.advancerTeamId).toBeNull();
    expect(r.winnerReason).toBe('DRAW');
  });

  it('a match without a score (e.g. upcoming) maps to null', () => {
    const m = structuredClone(archive[0]!);
    delete (m as { score?: unknown }).score;
    expect(toMatchResult(m)).toBeNull();
  });

  it('every finished archive match decodes with a numeric 90′ score', () => {
    for (const m of archive) {
      const r = toMatchResult(m);
      expect(r, m.id).not.toBeNull();
      expect(Number.isInteger(r!.scoreA90)).toBe(true);
      expect(Number.isInteger(r!.scoreB90)).toBe(true);
    }
  });
});
