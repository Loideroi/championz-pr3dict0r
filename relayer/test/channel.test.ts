import { describe, expect, it } from 'vitest';
import {
  composeReminder,
  composeResultsDigest,
  matchesNeedingReminder,
  minutesToLock,
} from '../src/channel.js';
import type { ChainState, MapEntry } from '../src/relay.js';

const entry = (matchId: number, label: string): MapEntry => ({
  matchId,
  uefaMatchId: `u${matchId}`,
  homeTeamId: 'H',
  awayTeamId: 'A',
  label,
});

describe('results digest (slice 10)', () => {
  it('one message per run: FT + corrections + provisional labels', () => {
    const digest = composeResultsDigest(
      [
        { matchId: 1, label: 'RMA–MCI', scoreA: 2, scoreB: 1, provisional: true },
        { matchId: 3, label: 'ARS–INT', scoreA: 3, scoreB: 0, extraTime: true, provisional: true },
      ],
      [{ matchId: 2, label: 'LIV–BAY', scoreA: 1, scoreB: 1, penalties: true }],
    );
    expect(digest).toContain('FULL TIME');
    expect(digest).toContain('RMA–MCI</b> 2–1 (90′)');
    expect(digest).toContain('went to extra time');
    expect(digest).toContain('CORRECTED');
    expect(digest).toContain('decided on penalties');
    expect(digest).toContain('◌ provisional');
    expect(digest).toContain('/standings');
  });

  it('returns null when nothing changed (no empty spam)', () => {
    expect(composeResultsDigest([], [])).toBeNull();
  });
});

describe('last-call reminders (pre-lock window → lock at T-60)', () => {
  const kickoff = 1_000_000; // lock at 996_400
  const state = (over: Partial<ChainState>): ChainState => ({
    completed: false,
    provisional: false,
    packed: null,
    kickoff,
    ...over,
  });

  it('fires only inside the pre-lock window', () => {
    const map = [entry(1, 'RMA–MCI')];
    const lockAt = kickoff - 3600;
    const states = new Map([[1, state({})]]);
    expect(matchesNeedingReminder(map, states, lockAt - 31 * 60)).toEqual([]); // too early
    expect(matchesNeedingReminder(map, states, lockAt - 29 * 60)).toEqual([1]); // in window
    expect(matchesNeedingReminder(map, states, lockAt - 14 * 60)).toEqual([1]); // still in window
    expect(matchesNeedingReminder(map, states, lockAt)).toEqual([]); // locked — too late
  });

  it('skips completed matches and unknown kickoffs', () => {
    const map = [entry(1, 'a'), entry(2, 'b')];
    const states = new Map([
      [1, state({ completed: true })],
      [2, state({ kickoff: 0 })],
    ]);
    expect(matchesNeedingReminder(map, states, kickoff - 3600 - 5 * 60)).toEqual([]);
  });

  it('composes the last-call copy with the play link', () => {
    const text = composeReminder([{ matchId: 1, label: 'RMA–MCI' }], 15);
    expect(text).toContain('Last call');
    expect(text).toContain('RMA–MCI');
    expect(text).toContain('/play');
  });
});

describe('MD1 reality check — the earliest UEFA slot', () => {
  // 2026-09-08 16:45 UTC, the first kickoff of the season. Its T-60 lock is
  // 15:45, so the reminder window opens at 15:15. The matchday cron used to
  // start at 16:00 and missed it entirely; oracle-bot.yml now starts at 15:00.
  const kickoff = Math.floor(Date.parse('2026-09-08T16:45:00Z') / 1000);
  const map = [entry(1, 'BRU–AVL')];
  const states = new Map<number, ChainState>([
    [1, { completed: false, provisional: false, packed: null, kickoff }],
  ]);
  const at = (hhmm: string) => Math.floor(Date.parse(`2026-09-08T${hhmm}:00Z`) / 1000);

  it('is reachable by a cron tick once the window starts at 15:00', () => {
    expect(matchesNeedingReminder(map, states, at('15:10'))).toEqual([]); // before the window
    for (const tick of ['15:15', '15:20', '15:30', '15:40']) {
      expect(matchesNeedingReminder(map, states, at(tick)), tick).toEqual([1]);
    }
    expect(matchesNeedingReminder(map, states, at('15:45'))).toEqual([]); // locked
    expect(matchesNeedingReminder(map, states, at('16:00'))).toEqual([]); // the old first tick
  });

  it('quotes the real countdown, not a constant', () => {
    expect(minutesToLock(kickoff, at('15:15'))).toBe(30);
    expect(minutesToLock(kickoff, at('15:40'))).toBe(5);
    expect(minutesToLock(kickoff, at('15:45'))).toBe(1); // floored, never 0 or negative
    expect(composeReminder([{ matchId: 1, label: 'BRU–AVL' }], 30)).toContain('~30 minutes');
  });
});
