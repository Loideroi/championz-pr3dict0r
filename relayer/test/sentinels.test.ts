import { describe, expect, it } from 'vitest';
import {
  checkDeadlines,
  checkGovernance,
  checkSolvency,
  checkUnfrozenStage,
  checkUptime,
  composeSentinelAlert,
  DRAW_DAY_UTC,
} from '../src/sentinels.js';

const OWNER = '0x47103b0FC04c91Ac388eaE3c4f91D038CBfD9CF8';
const ORACLE = '0xB57Cb421E3B707d0970Ec758D40a4366DB317B15';
const IMPL = '0xD8d86bbfF76ce138eFC91C768dC6c350AF2728Af';
const EXPECTED = { owner: OWNER, oracle: ORACLE, implementation: IMPL };
const CHZ = 10n ** 18n;

describe('checkGovernance', () => {
  it('is quiet when everything matches (case-insensitively) and unpaused', () => {
    const issues = checkGovernance(
      { owner: OWNER.toLowerCase(), oracle: ORACLE, implementation: IMPL.toLowerCase(), paused: false },
      EXPECTED,
    );
    expect(issues).toEqual([]);
  });

  it('flags any drifted address with both actual and expected values', () => {
    const rogue = '0x000000000000000000000000000000000000dEaD';
    const issues = checkGovernance(
      { owner: rogue, oracle: ORACLE, implementation: rogue, paused: false },
      EXPECTED,
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe('governance_drift');
    expect(issues[0]!.detail).toContain('owner: ' + rogue);
    expect(issues[0]!.detail).toContain('implementation: ' + rogue);
    expect(issues[0]!.detail).not.toContain('oracle:');
  });

  it('flags a paused contract as its own issue type', () => {
    const issues = checkGovernance(
      { owner: OWNER, oracle: ORACLE, implementation: IMPL, paused: true },
      EXPECTED,
    );
    expect(issues.map((i) => i.type)).toEqual(['contract_paused']);
  });
});

describe('checkSolvency', () => {
  it('is quiet when balance covers unfrozen pools + fee escrow', () => {
    expect(
      checkSolvency(1100n * CHZ, [
        { pool: 500n * CHZ, feeEscrow: 50n * CHZ, frozen: false },
        { pool: 500n * CHZ, feeEscrow: 50n * CHZ, frozen: false },
      ]),
    ).toBeNull();
  });

  it('excludes frozen stages from the owed sum', () => {
    expect(
      checkSolvency(550n * CHZ, [
        { pool: 500n * CHZ, feeEscrow: 50n * CHZ, frozen: false },
        { pool: 10_000n * CHZ, feeEscrow: 0n, frozen: true },
      ]),
    ).toBeNull();
  });

  it('fires on a shortfall of even 1 wei', () => {
    const issue = checkSolvency(1100n * CHZ - 1n, [
      { pool: 1000n * CHZ, feeEscrow: 100n * CHZ, frozen: false },
    ]);
    expect(issue?.type).toBe('insolvency');
    expect(issue?.detail).toContain('pause()');
  });
});

describe('checkDeadlines', () => {
  const close = 1_800_000_000;

  it('warns on a floor shortfall inside the 14-day window only', () => {
    const base = { leagueCloseAt: close, stageFloor: 20, matchCount: 5 };
    // 20 days out: quiet even though short.
    expect(checkDeadlines({ ...base, nowSec: close - 20 * 86400, leagueEntrants: 3 })).toEqual([]);
    // 10 days out + short: warn.
    const issues = checkDeadlines({ ...base, nowSec: close - 10 * 86400, leagueEntrants: 3 });
    expect(issues.map((i) => i.type)).toEqual(['floor_risk']);
    expect(issues[0]!.headline).toContain('3/20');
    // 10 days out but floor met: quiet.
    expect(checkDeadlines({ ...base, nowSec: close - 10 * 86400, leagueEntrants: 20 })).toEqual([]);
    // after close: quiet (die is cast — void/refund handles it).
    expect(checkDeadlines({ ...base, nowSec: close + 3600, leagueEntrants: 3 })).toEqual([]);
  });

  it('nags for fixtures from draw day until matches exist', () => {
    const base = { leagueCloseAt: close, leagueEntrants: 50, stageFloor: 20 };
    expect(
      checkDeadlines({ ...base, nowSec: DRAW_DAY_UTC - 3600, matchCount: 0 }),
    ).toEqual([]);
    const issues = checkDeadlines({ ...base, nowSec: DRAW_DAY_UTC + 3600, matchCount: 0 });
    expect(issues.map((i) => i.type)).toEqual(['fixtures_missing']);
    expect(issues[0]!.detail).toContain('TELEGRAM_CHANNEL_ID');
    expect(
      checkDeadlines({ ...base, nowSec: DRAW_DAY_UTC + 3600, matchCount: 144 }),
    ).toEqual([]);
  });
});

describe('checkUnfrozenStage', () => {
  it('fires only when a stage with matches is fully played and unfrozen', () => {
    const issues = checkUnfrozenStage([
      { label: 'league', frozen: false, totalMatches: 144, completedMatches: 144 },
      { label: 'knockout', frozen: false, totalMatches: 45, completedMatches: 44 },
    ]);
    expect(issues.map((i) => i.type)).toEqual(['stage_unfrozen_league']);
  });

  it('is quiet for frozen or empty stages', () => {
    expect(
      checkUnfrozenStage([
        { label: 'league', frozen: true, totalMatches: 144, completedMatches: 144 },
        { label: 'knockout', frozen: false, totalMatches: 0, completedMatches: 0 },
      ]),
    ).toEqual([]);
  });
});

describe('checkUptime', () => {
  it('maps failures to per-target issue types', () => {
    const issues = checkUptime([
      { label: 'homepage', url: 'https://pr3dict0r.com', ok: true },
      { label: 'profile-api', url: 'https://pr3dict0r.com/api/profile', ok: false, status: 503 },
    ]);
    expect(issues.map((i) => i.type)).toEqual(['site_down_profile-api']);
    expect(issues[0]!.detail).toContain('HTTP 503');
  });
});

describe('composeSentinelAlert', () => {
  it('names the network and escapes HTML', () => {
    const msg = composeSentinelAlert(
      { type: 'x', headline: 'headline <b>', detail: 'detail & more' },
      88888,
    );
    expect(msg).toContain('Chiliz mainnet');
    expect(msg).toContain('headline &lt;b&gt;');
    expect(msg).toContain('detail &amp; more');
  });
});
