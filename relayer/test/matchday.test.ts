import { describe, expect, it } from 'vitest';
import {
  COVERAGE_TAIL_AFTER_KICKOFF_SECONDS,
  coverageEnd,
  matchdayKickoffs,
  matchdaySpan,
} from '../src/matchday.js';

const at = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const iso = (s: number) => new Date(s * 1000).toISOString();

// The real MD1 shape: two kickoffs at 16:45 and four at 19:00 UTC, repeated
// on 8, 9 and 10 September 2026.
const slot = (d: string) => [
  at(`2026-09-${d}T16:45:00Z`),
  at(`2026-09-${d}T16:45:00Z`),
  at(`2026-09-${d}T19:00:00Z`),
  at(`2026-09-${d}T19:00:00Z`),
];
const MD1 = [...slot('08'), ...slot('09'), ...slot('10')];

describe('matchday coverage span', () => {
  it('takes only the kickoffs of the current matchday', () => {
    const k = matchdayKickoffs(MD1, at('2026-09-09T07:00:00Z'));
    expect(k).toHaveLength(4);
    expect(iso(k[0] as number)).toBe('2026-09-09T16:45:00.000Z');
    expect(iso(k[3] as number)).toBe('2026-09-09T19:00:00.000Z');
  });

  it('opens 4h before the first lock and closes 150 min after the last kickoff', () => {
    const span = matchdaySpan(MD1, at('2026-09-09T07:00:00Z')) as { start: number; end: number };
    expect(iso(span.start)).toBe('2026-09-09T11:45:00.000Z'); // 16:45 KO, 15:45 lock, -4h
    expect(iso(span.end)).toBe('2026-09-09T21:30:00.000Z'); // 19:00 KO + 2h30
  });

  it('holds no runner before the window opens', () => {
    expect(coverageEnd(MD1, at('2026-09-09T07:00:00Z'))).toBe(0);
    expect(coverageEnd(MD1, at('2026-09-09T11:44:00Z'))).toBe(0);
  });

  // These are the timestamps GitHub actually delivered. Each one has to be
  // able to bootstrap a watcher, because any of them may be the only run of
  // the afternoon: on 7 Sep the runs were 13:27 and then nothing until 18:44.
  it.each([
    ['2026-09-08T12:05:00Z', '2026-09-08T21:30:00.000Z'],
    ['2026-09-08T14:35:00Z', '2026-09-08T21:30:00.000Z'],
    ['2026-09-08T18:23:00Z', '2026-09-08T21:30:00.000Z'],
    ['2026-09-09T13:27:00Z', '2026-09-09T21:30:00.000Z'],
  ])('a run at %s bootstraps coverage to %s', (now, end) => {
    expect(iso(coverageEnd(MD1, at(now)))).toBe(end);
  });

  it('spans more than one job can hold, which is why the workflow hands off', () => {
    const span = matchdaySpan(MD1, at('2026-09-09T07:00:00Z')) as { start: number; end: number };
    // 9h45 against a 6h job ceiling: a watcher that spends its budget exits
    // and the next oracle-bot completion starts its successor.
    expect((span.end - span.start) / 3600).toBeGreaterThan(6);
  });

  it('rolls to the next matchday once the tail has passed', () => {
    const justAfter = at('2026-09-08T19:00:00Z') + COVERAGE_TAIL_AFTER_KICKOFF_SECONDS + 60;
    expect(coverageEnd(MD1, justAfter)).toBe(0); // 9 Sep has not opened yet
    const next = matchdaySpan(MD1, justAfter) as { start: number; end: number };
    expect(iso(next.end)).toBe('2026-09-09T21:30:00.000Z');
  });

  it('returns nothing once the season is done', () => {
    expect(matchdaySpan(MD1, at('2026-09-11T00:00:00Z'))).toBeNull();
    expect(coverageEnd(MD1, at('2026-09-11T00:00:00Z'))).toBe(0);
  });
});
