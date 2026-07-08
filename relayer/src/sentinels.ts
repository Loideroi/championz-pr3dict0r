/**
 * Ops sentinels (Telegram tripwires beyond gas balance):
 *
 *  - governance drift: owner()/oracle()/proxy implementation changed vs the
 *    expected values, or the contract is paused — the key-compromise tripwire.
 *  - solvency: contract balance must cover every unfrozen stage's pool +
 *    feeEscrow (fees are held in-contract until stage lock, D2). A shortfall
 *    is the runtime exploit tripwire.
 *  - site uptime: pr3dict0r.com + the profile API answering.
 *  - seasonal deadlines: entrant floor at risk near sales close; fixtures
 *    missing after the draw; a fully-played stage left unfrozen.
 *
 * Pure decision logic + message composers only — all I/O lives in
 * scripts/sentinel.mjs and is deduped via clp_oracle_log (24h per type).
 */
import { escapeHtml } from './alerts.js';

export interface SentinelIssue {
  /** dedupe key, stored as detail.type in clp_oracle_log */
  type: string;
  headline: string;
  detail: string;
}

/* ---------------------------------------------------------------- */
/* Governance                                                        */
/* ---------------------------------------------------------------- */

export interface GovernanceState {
  owner: string;
  oracle: string;
  implementation: string;
  paused: boolean;
}

export function checkGovernance(
  actual: GovernanceState,
  expected: { owner: string; oracle: string; implementation: string },
): SentinelIssue[] {
  const issues: SentinelIssue[] = [];
  const drift: string[] = [];
  const eq = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (!eq(actual.owner, expected.owner)) drift.push(`owner: ${actual.owner} (expected ${expected.owner})`);
  if (!eq(actual.oracle, expected.oracle)) drift.push(`oracle: ${actual.oracle} (expected ${expected.oracle})`);
  if (!eq(actual.implementation, expected.implementation)) {
    drift.push(`implementation: ${actual.implementation} (expected ${expected.implementation})`);
  }
  if (drift.length > 0) {
    issues.push({
      type: 'governance_drift',
      headline: '🚨 GOVERNANCE_DRIFT — contract control changed on-chain',
      detail: `${drift.join('\n')}\nIf this was YOUR upgrade/rotation, update the EXPECTED_* env in oracle-bot.yml. Otherwise treat the owner key as compromised: pause() and investigate NOW.`,
    });
  }
  if (actual.paused) {
    issues.push({
      type: 'contract_paused',
      headline: '⏸️ CONTRACT_PAUSED — entries, predictions and claims are blocked',
      detail: 'paused() is true. If this is not a deliberate incident response, unpause.',
    });
  }
  return issues;
}

/* ---------------------------------------------------------------- */
/* Solvency                                                          */
/* ---------------------------------------------------------------- */

export interface StageFunds {
  pool: bigint;
  feeEscrow: bigint;
  frozen: boolean;
}

/** Balance must cover pool + fee escrow of every stage that has not locked. */
export function checkSolvency(balanceWei: bigint, stages: StageFunds[]): SentinelIssue | null {
  const owed = stages
    .filter((s) => !s.frozen)
    .reduce((acc, s) => acc + s.pool + s.feeEscrow, 0n);
  if (balanceWei >= owed) return null;
  const chz = (wei: bigint) => `${Number(wei / 10n ** 15n) / 1000} CHZ`;
  return {
    type: 'insolvency',
    headline: '🚨 SOLVENCY_BREACH — contract balance below owed pools',
    detail: `balance ${chz(balanceWei)} < owed ${chz(owed)} (unfrozen pools + fee escrow). This should be IMPOSSIBLE — assume an exploit: pause() immediately and investigate.`,
  };
}

/* ---------------------------------------------------------------- */
/* Seasonal deadlines                                                */
/* ---------------------------------------------------------------- */

/** 2026-08-27 00:00 UTC — the league-phase draw (fixtures publish after). */
export const DRAW_DAY_UTC = Date.UTC(2026, 7, 27) / 1000;

export function checkDeadlines(opts: {
  nowSec: number;
  leagueCloseAt: number;
  leagueEntrants: number;
  stageFloor: number;
  matchCount: number;
}): SentinelIssue[] {
  const issues: SentinelIssue[] = [];
  const { nowSec, leagueCloseAt, leagueEntrants, stageFloor, matchCount } = opts;

  const daysToClose = (leagueCloseAt - nowSec) / 86400;
  if (daysToClose > 0 && daysToClose <= 14 && leagueEntrants < stageFloor) {
    issues.push({
      type: 'floor_risk',
      headline: `⏳ FLOOR_RISK — ${leagueEntrants}/${stageFloor} entrants with ${Math.ceil(daysToClose)} day(s) to league close`,
      detail: `Below ${stageFloor} at close the stage voids and everyone is refunded (D2). Time to push the promo.`,
    });
  }

  if (nowSec >= DRAW_DAY_UTC && matchCount === 0) {
    issues.push({
      type: 'fixtures_missing',
      headline: '📅 FIXTURES_MISSING — the draw is done but no matches are on-chain',
      detail: 'Run generate-matches → verify-fixtures → addMatches + setTies on the mainnet proxy, and re-add the TELEGRAM_CHANNEL_ID Actions variable so results reach the public channel.',
    });
  }

  return issues;
}

/** A stage whose every match is completed should be frozen (else claims wait). */
export function checkUnfrozenStage(stages: Array<{
  label: string;
  frozen: boolean;
  totalMatches: number;
  completedMatches: number;
}>): SentinelIssue[] {
  return stages
    .filter((s) => !s.frozen && s.totalMatches > 0 && s.completedMatches === s.totalMatches)
    .map((s) => ({
      type: `stage_unfrozen_${s.label}`,
      headline: `🧊 STAGE_UNFROZEN — ${s.label} is fully played but not frozen`,
      detail: `All ${s.totalMatches} matches are completed. Freeze the stage from /admin so winners can claim.`,
    }));
}

/* ---------------------------------------------------------------- */
/* Uptime                                                            */
/* ---------------------------------------------------------------- */

export function checkUptime(results: Array<{
  label: string;
  url: string;
  ok: boolean;
  status?: number | undefined;
  error?: string | undefined;
}>): SentinelIssue[] {
  return results
    .filter((r) => !r.ok)
    .map((r) => ({
      type: `site_down_${r.label}`,
      headline: `🌐 SITE_DOWN — ${r.label} is not answering`,
      detail: `${r.url} → ${r.status ? `HTTP ${r.status}` : (r.error ?? 'no response')}`,
    }));
}

/* ---------------------------------------------------------------- */
/* Composer                                                          */
/* ---------------------------------------------------------------- */

export function composeSentinelAlert(issue: SentinelIssue, chainId: number): string {
  const net = chainId === 88888 ? 'Chiliz mainnet' : `chain ${chainId}`;
  return [
    `<b>${escapeHtml(issue.headline)}</b> (${escapeHtml(net)})`,
    escapeHtml(issue.detail),
  ].join('\n');
}
