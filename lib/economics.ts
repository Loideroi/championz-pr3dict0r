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
