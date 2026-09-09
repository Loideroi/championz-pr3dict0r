/**
 * Entry economics — PRD §4.3, decisions D1–D4 (docs/adr/0001–0004).
 * All amounts in whole CHZ. The contract enforces these exactly (msg.value ==
 * gross); keep this file and the contract constants in lockstep.
 */
export const ENTRY = {
  fullSeason: {
    /** 500 → League Pool + 500 → Knockout Pool */
    pool: 1000,
    fee: 100,
    gross: 1100,
  },
  knockout: {
    /** 500 → Knockout Pool */
    pool: 500,
    fee: 50,
    gross: 550,
  },
} as const;

/** Stage locks with fewer entrants than this → stage void, full refund (D2). */
export const STAGE_FLOOR = 20;

/** Predictions lock this many seconds before kickoff (PRD §6). */
export const PREDICTION_LOCKOUT_SECONDS = 3600;

/** Pin locale — SSR safety, never unpinned toLocale* in render (PRD §17). */
export function formatChz(amount: number): string {
  return amount.toLocaleString("en-US");
}

/** Whole CHZ from wei, floored, same pinned grouping as {@link formatChz}. */
export function formatChzWei(wei: bigint): string {
  return formatChz(Number(wei / 10n ** 18n));
}

// ---- payout split (PRD §4.1 / §13 of the terms) ----------------------------
//
// Mirrors ChampionzPredictor._shareFor / _applyRanking exactly, in bigint wei
// with the contract's integer-division order. The percentages below and the
// contract's are one fact in two places: change both or neither.

/** Each stage pays its own pool to this many ranks (payCount = min(entryCount, 20)). */
export const PAYOUT_TOP_N = 20;

/** Display percentages of the split — interpolated into copy, never hand-typed per locale. */
export const PAYOUT_SPLIT = {
  first: 25,
  second: 15,
  third: 10,
  /** shared equally by places 4–10 */
  ranks4to10: 30,
  /** shared equally by places 11–20 */
  ranks11to20: 20,
} as const;

/** claim() reverts until this long after freezeStage (contract CLAIM_CHALLENGE_WINDOW). */
export const CLAIM_CHALLENGE_SECONDS = 24 * 3600;

/** Contract `_shareFor(rankIndex, pool)`: rankIndex 0 = 1st place. Truncating division, as on-chain. */
export function shareForWei(rankIndex: number, poolWei: bigint): bigint {
  if (rankIndex === 0) return (poolWei * 25n) / 100n;
  if (rankIndex === 1) return (poolWei * 15n) / 100n;
  if (rankIndex === 2) return (poolWei * 10n) / 100n;
  if (rankIndex < 10) return (poolWei * 30n) / 100n / 7n; // ranks 4-10
  return (poolWei * 20n) / 100n / 10n; // ranks 11-20
}

/**
 * What each rank would be credited if freezeStage ran on this pool right now.
 * Index 0 = 1st place. Mirrors `_applyRanking`: pay min(entryCount, 20) shares,
 * then everything undistributed goes to rank 1 — rounding dust and, below 20
 * entrants, the unpaid ranks' shares (the contract does not renormalise; a
 * LOCKED stage always has ≥ STAGE_FLOOR entrants, so that branch is defensive).
 * The result always sums to `poolWei` exactly.
 */
export function projectedPayouts(poolWei: bigint, entryCount: number): bigint[] {
  const payCount = Math.min(Math.max(0, Math.floor(entryCount)), PAYOUT_TOP_N);
  if (payCount === 0) return [];
  const out = Array.from({ length: payCount }, (_, i) => shareForWei(i, poolWei));
  const distributed = out.reduce((sum, share) => sum + share, 0n);
  out[0] = out[0]! + (poolWei - distributed);
  return out;
}
