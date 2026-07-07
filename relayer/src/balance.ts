/**
 * Oracle gas-balance watch (ops hardening): the oracle key pays gas for every
 * result push, and an empty key fails SILENTLY — the cron just stops landing
 * transactions. This module turns that silence into a Telegram warning.
 *
 * Checked on every bot run (5-min cadence in matchday windows) against a
 * configurable floor; alerts dedupe via clp_oracle_log so the admin gets one
 * warning per chain per day, not one per cron tick. All I/O is injected.
 */
import { escapeHtml } from './alerts.js';

/** Default floor: ~80 pushes of headroom at the 2,510 gwei Chiliz gas price. */
export const DEFAULT_MIN_BALANCE_CHZ = 20;

export interface BalanceReading {
  balanceChz: number;
  low: boolean;
  thresholdChz: number;
}

/** Pure threshold check on a wei balance. */
export function readBalance(balanceWei: bigint, thresholdChz: number): BalanceReading {
  // Integer CHZ precision is plenty for a gas floor; avoids float drift.
  const balanceChz = Number(balanceWei / 10n ** 15n) / 1000;
  return { balanceChz, low: balanceChz < thresholdChz, thresholdChz };
}

export function composeLowBalanceAlert(opts: {
  reading: BalanceReading;
  chainId: number;
  oracleAddress: string;
  ownerAddress?: string | undefined;
}): string {
  const { reading, chainId, oracleAddress, ownerAddress } = opts;
  const net = chainId === 88888 ? 'Chiliz mainnet' : `chain ${chainId}`;
  return [
    `🪫 <b>ORACLE_LOW_BALANCE</b> (${escapeHtml(net)})`,
    `Oracle <code>${escapeHtml(oracleAddress)}</code> holds <b>${reading.balanceChz} CHZ</b> — below the ${reading.thresholdChz} CHZ floor.`,
    `Result pushes will start failing when gas runs out. Top up from the owner key${
      ownerAddress ? ` <code>${escapeHtml(ownerAddress)}</code>` : ''
    }.`,
  ].join('\n');
}

/** One-line balance status for the daily heartbeat. */
export function composeBalanceLine(reading: BalanceReading): string {
  return reading.low
    ? `🪫 oracle gas: ${reading.balanceChz} CHZ (below ${reading.thresholdChz} CHZ floor!)`
    : `🔋 oracle gas: ${reading.balanceChz} CHZ`;
}
