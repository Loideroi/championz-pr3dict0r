import type { MatchResult, ResultSource } from './source.js';

/**
 * Relay orchestration (slice 05, PRD §8.1) — chain-agnostic so tests replay a
 * whole archived matchday against a mock writer. Rules per mapped match:
 *
 *   feed not FINISHED            → skip (nothing to relay yet)
 *   chain empty                  → pushResult (provisional window starts)
 *   chain provisional + differs  → correctResult (UEFA amended; we follow)
 *   chain provisional + equal    → skip (idempotent)
 *   chain finalized              → skip ALWAYS (post-final corrections are the
 *                                  pause-gated admin path, slice 12 — never ours)
 *
 * Mirror-UEFA verbatim (ADR-0006): no filtering of forfeits — if the feed says
 * FINISHED with WIN_BY_FORFEIT, that packed result goes on-chain.
 */

export interface MapEntry {
  /** on-chain match id (uint16) */
  matchId: number;
  uefaMatchId: string;
  homeTeamId: string;
  awayTeamId: string;
  /** display label for channel posts, e.g. "RMA–MCI" (slice 10) */
  label?: string;
}

export interface ChainState {
  completed: boolean;
  provisional: boolean;
  /** current packed result LOW BITS (scores+flags+submitted), null if none */
  packed: bigint | null;
  /** on-chain kickoff (unix seconds) — pushes before this would revert MatchNotStarted */
  kickoff: number;
}

export interface ChainWriter {
  read(matchId: number): Promise<ChainState>;
  /**
   * Optional bulk read (multicall): one run over 144 matches is 288 eth_calls
   * done one by one — Ankr's free tier rate-limits that burst. relayOnce
   * prefetches through this when available and falls back to read().
   */
  readMany?(ids: number[]): Promise<Map<number, ChainState>>;
  /** Resolves once mined; may return the tx hash so the log can link it. */
  pushResult(matchId: number, packed: bigint): Promise<`0x${string}` | void>;
  correctResult(matchId: number, packed: bigint): Promise<`0x${string}` | void>;
}

export interface RelaySummary {
  pushed: number[];
  corrected: number[];
  skipped: number[];
  errors: { matchId: number; error: string }[];
  /** chain state per mapped match, as read this run (reused by the watchdog) */
  states: Map<number, ChainState>;
  /** tx hash per pushed / corrected match, when the writer reports one */
  txHashes: Map<number, `0x${string}`>;
}

const FLAG_SUBMITTED = 1n << 20n;

/** Mirror of ChampionzPredictor packing: bits 0-7 A · 8-15 B · 16 ET · 17 pens · 18-19 advancer · 20 submitted. */
export function packResult(r: MatchResult, entry: MapEntry): bigint {
  if (r.scoreA90 < 0 || r.scoreA90 > 15 || r.scoreB90 < 0 || r.scoreB90 > 15) {
    throw new RangeError(`90' score out of packable range for ${entry.uefaMatchId}`);
  }
  let packed = BigInt(r.scoreA90) | (BigInt(r.scoreB90) << 8n) | FLAG_SUBMITTED;
  if (r.extraTime) packed |= 1n << 16n;
  if (r.penalties) packed |= 1n << 17n;
  if (r.advancerTeamId !== null) {
    if (r.advancerTeamId === entry.homeTeamId) {
      // advancer bits stay 0 (home)
    } else if (r.advancerTeamId === entry.awayTeamId) {
      packed |= 1n << 18n;
    } else {
      throw new RangeError(
        `advancer ${r.advancerTeamId} is neither home ${entry.homeTeamId} nor away ${entry.awayTeamId} (${entry.uefaMatchId})`,
      );
    }
  }
  return packed;
}

// eslint-disable-next-line complexity -- known debt: complexity 20 vs budget 15 (2026-09-12); expires 2026-10-31; burn-down tracked in docs/REVIEW_TIERS.md
export async function relayOnce(
  source: ResultSource,
  writer: ChainWriter,
  map: MapEntry[],
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<RelaySummary> {
  const summary: RelaySummary = {
    pushed: [],
    corrected: [],
    skipped: [],
    errors: [],
    states: new Map(),
    txHashes: new Map(),
  };
  let prefetched: Map<number, ChainState> | null = null;
  if (writer.readMany && map.length > 0) {
    try {
      prefetched = await writer.readMany(map.map((e) => e.matchId));
    } catch {
      prefetched = null; // per-entry reads below still work, just slower
    }
  }
  for (const entry of map) {
    try {
      const state = prefetched?.get(entry.matchId) ?? (await writer.read(entry.matchId));
      summary.states.set(entry.matchId, state);
      if (state.completed && !state.provisional) {
        summary.skipped.push(entry.matchId); // finalized — never touch (idempotent)
        continue;
      }
      if (!state.completed && nowSeconds < state.kickoff) {
        summary.skipped.push(entry.matchId); // not kicked off — a push would revert
        continue;
      }
      const result = await source.result(entry.uefaMatchId);
      if (!result || result.status !== 'FINISHED') {
        summary.skipped.push(entry.matchId);
        continue;
      }
      const packed = packResult(result, entry);
      if (!state.completed) {
        const hash = await writer.pushResult(entry.matchId, packed);
        if (hash) summary.txHashes.set(entry.matchId, hash);
        summary.pushed.push(entry.matchId);
      } else if (state.packed !== packed) {
        const hash = await writer.correctResult(entry.matchId, packed);
        if (hash) summary.txHashes.set(entry.matchId, hash);
        summary.corrected.push(entry.matchId);
      } else {
        summary.skipped.push(entry.matchId);
      }
    } catch (err) {
      summary.errors.push({ matchId: entry.matchId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return summary;
}
