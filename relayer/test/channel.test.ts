import { describe, expect, it } from 'vitest';
import { composeReminder, composeResultsDigest, matchesNeedingReminder } from '../src/channel.js';
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

describe('last-call reminders (T-75 → lock at T-60)', () => {
  const kickoff = 1_000_000; // lock at 996_400
  const state = (over: Partial<ChainState>): ChainState => ({
    completed: false,
    provisional: false,
    packed: null,
    kickoff,
    ...over,
  });

  it('fires only inside the 15-minute pre-lock window', () => {
    const map = [entry(1, 'RMA–MCI')];
    const lockAt = kickoff - 3600;
    const states = new Map([[1, state({})]]);
    expect(matchesNeedingReminder(map, states, lockAt - 16 * 60)).toEqual([]); // too early
    expect(matchesNeedingReminder(map, states, lockAt - 14 * 60)).toEqual([1]); // in window
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
