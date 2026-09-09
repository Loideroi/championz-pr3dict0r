import { describe, expect, it } from 'vitest';
import {
  HEADS_UP_WINDOW_SECONDS,
  LAST_CALL_WINDOW_SECONDS,
  composeReminder,
  composeResultsDigest,
  formatLead,
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
    expect(matchesNeedingReminder(map, states, lockAt - 91 * 60)).toEqual([]); // too early
    expect(matchesNeedingReminder(map, states, lockAt - 89 * 60)).toEqual([1]); // in window
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

describe('MD1 reality check — the runs GitHub actually delivered on 8 Sep 2026', () => {
  // The 5-minute matchday cron asked for ~108 runs that day and got 8. Around
  // the first kickoff of the season (16:45 UTC, so a 15:45 lock) the only runs
  // were 12:05, 14:35 and 18:23: the 30-minute window was never sampled and no
  // reminder went out at all. Both tiers are sized against those timestamps.
  const kickoff = Math.floor(Date.parse('2026-09-08T16:45:00Z') / 1000);
  const map = [entry(1, 'BRU–AVL')];
  const states = new Map<number, ChainState>([
    [1, { completed: false, provisional: false, packed: null, kickoff }],
  ]);
  const at = (hhmm: string) => Math.floor(Date.parse(`2026-09-08T${hhmm}:00Z`) / 1000);

  it('the old 30-minute window missed every run that day', () => {
    for (const tick of ['12:05', '14:35', '18:23']) {
      expect(matchesNeedingReminder(map, states, at(tick), 30 * 60), tick).toEqual([]);
    }
  });

  it('last call reaches the 14:35 run', () => {
    expect(matchesNeedingReminder(map, states, at('14:35'), LAST_CALL_WINDOW_SECONDS)).toEqual([1]);
  });

  it('heads-up catches 12:05, which is too early to be a last call', () => {
    expect(matchesNeedingReminder(map, states, at('12:05'), LAST_CALL_WINDOW_SECONDS)).toEqual([]);
    expect(matchesNeedingReminder(map, states, at('12:05'), HEADS_UP_WINDOW_SECONDS)).toEqual([1]);
  });

  it('neither tier fires once the match has locked', () => {
    expect(matchesNeedingReminder(map, states, at('18:23'), HEADS_UP_WINDOW_SECONDS)).toEqual([]);
  });

  it('quotes the real countdown, not a constant', () => {
    expect(minutesToLock(kickoff, at('14:35'))).toBe(70);
    expect(minutesToLock(kickoff, at('15:40'))).toBe(5);
    expect(minutesToLock(kickoff, at('15:45'))).toBe(1); // floored, never 0 or negative
  });

  it('says "Last call" only when it is one', () => {
    const near = composeReminder([{ matchId: 1, label: 'BRU–AVL' }], 70);
    expect(near).toContain('Last call');
    expect(near).toContain('~1h 10m');
    const far = composeReminder([{ matchId: 1, label: 'BRU–AVL' }], 220);
    expect(far).not.toContain('Last call');
    expect(far).toContain('~3h 40m');
  });

  it('formats lead times at both tiers', () => {
    expect(formatLead(5)).toBe('~5 minutes');
    expect(formatLead(59)).toBe('~59 minutes');
    expect(formatLead(120)).toBe('~2h');
    expect(formatLead(205)).toBe('~3h 25m');
  });
});
