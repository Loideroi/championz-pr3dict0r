/**
 * Packed prediction/result codec — MUST mirror ChampionzPredictor.sol
 * (bits 0-7 scoreA · 8-15 scoreB · 16 extraTime · 17 penalties ·
 * 18-19 advancer · bit 20 submitted).
 */
export const FLAG_SUBMITTED = 1n << 20n;
export const MAX_GOALS = 15;

export function packPrediction(scoreA: number, scoreB: number): bigint {
  if (
    !Number.isInteger(scoreA) ||
    !Number.isInteger(scoreB) ||
    scoreA < 0 ||
    scoreB < 0 ||
    scoreA > MAX_GOALS ||
    scoreB > MAX_GOALS
  ) {
    throw new RangeError(`scores must be integers 0..${MAX_GOALS}`);
  }
  return BigInt(scoreA) | (BigInt(scoreB) << 8n) | FLAG_SUBMITTED;
}

export function unpackPrediction(packed: bigint): {
  scoreA: number;
  scoreB: number;
  submitted: boolean;
} {
  return {
    scoreA: Number(packed & 0xffn),
    scoreB: Number((packed >> 8n) & 0xffn),
    submitted: (packed & FLAG_SUBMITTED) !== 0n,
  };
}
