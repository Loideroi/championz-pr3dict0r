import { describe, expect, it } from 'vitest';
import {
  composeBalanceLine,
  composeLowBalanceAlert,
  DEFAULT_MIN_BALANCE_CHZ,
  readBalance,
} from '../src/balance.js';

const CHZ = 10n ** 18n;

describe('readBalance', () => {
  it('flags a balance below the floor', () => {
    const r = readBalance(19n * CHZ, 20);
    expect(r).toEqual({ balanceChz: 19, low: true, thresholdChz: 20 });
  });

  it('does not flag a balance at or above the floor', () => {
    expect(readBalance(20n * CHZ, 20).low).toBe(false);
    expect(readBalance(100n * CHZ, 20).low).toBe(false);
  });

  it('keeps milli-CHZ precision without float drift', () => {
    // 19.999 CHZ < 20 — a wei-level rounding-up bug would miss this.
    const r = readBalance(19_999n * (CHZ / 1000n), 20);
    expect(r.balanceChz).toBe(19.999);
    expect(r.low).toBe(true);
  });

  it('handles a fully drained key', () => {
    const r = readBalance(0n, DEFAULT_MIN_BALANCE_CHZ);
    expect(r.balanceChz).toBe(0);
    expect(r.low).toBe(true);
  });
});

describe('compose', () => {
  const reading = readBalance(12n * CHZ, 20);

  it('low-balance alert names the chain, oracle, floor and top-up source', () => {
    const msg = composeLowBalanceAlert({
      reading,
      chainId: 88888,
      oracleAddress: '0xB57Cb421E3B707d0970Ec758D40a4366DB317B15',
      ownerAddress: '0x47103b0FC04c91Ac388eaE3c4f91D038CBfD9CF8',
    });
    expect(msg).toContain('ORACLE_LOW_BALANCE');
    expect(msg).toContain('Chiliz mainnet');
    expect(msg).toContain('12 CHZ');
    expect(msg).toContain('20 CHZ floor');
    expect(msg).toContain('0xB57Cb421E3B707d0970Ec758D40a4366DB317B15');
    expect(msg).toContain('0x47103b0FC04c91Ac388eaE3c4f91D038CBfD9CF8');
  });

  it('heartbeat line switches icon on the floor', () => {
    expect(composeBalanceLine(readBalance(100n * CHZ, 20))).toContain('🔋 oracle gas: 100 CHZ');
    expect(composeBalanceLine(reading)).toContain('🪫 oracle gas: 12 CHZ (below 20 CHZ floor!)');
  });
});
