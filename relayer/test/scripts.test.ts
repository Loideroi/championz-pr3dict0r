/**
 * generate-matches.mjs + verify-fixtures.mjs against the recorded feed —
 * acceptance criteria: "generate-matches.mjs produces a valid matches.json
 * … including two-legged tie wiring" and "verification scripts pass against
 * the archive and fail loudly when a feeder is deliberately scrambled".
 * Tests exercise the real CLI contract (argv + exit codes) via child_process.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { toFixture } from '../src/source.js';
import { UefaMatchArraySchema } from '../src/schema.js';
import { AET_BATCH, FIRST20, fixturePath, loadFixture, relayerRoot } from './helpers.js';

const GENERATE = resolve(relayerRoot, 'scripts/generate-matches.mjs');
const VERIFY = resolve(relayerRoot, 'scripts/verify-fixtures.mjs');
const FEED_ARGS = [fixturePath(FIRST20), fixturePath(AET_BATCH)];

interface GeneratedMatch {
  matchId: number;
  phase: number;
  teamA: string;
  teamB: string;
  kickoffTime: number | null;
  group: string | null;
  matchday: number | null;
  knockout: boolean;
  uefaMatchId: string;
  tieId: string | null;
  legNumber: number | null;
}
interface GeneratedDoc {
  teams: Record<string, { name: string; code: string; uefaId: string; uefaCode?: string }>;
  matches: GeneratedMatch[];
}

const run = (script: string, args: string[]) => {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], { encoding: 'utf8' });
    return { status: 0, stdout };
  } catch (err) {
    const e = err as { status: number | null; stdout?: string; stderr?: string };
    return { status: e.status ?? -1, stdout: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
};

let tmp: string;
let outPath: string;
let doc: GeneratedDoc;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'relayer-scripts-'));
  outPath = join(tmp, 'matches.json');
  const res = run(GENERATE, ['--from', ...FEED_ARGS, '--out', outPath]);
  expect(res.status, res.stdout).toBe(0);
  doc = JSON.parse(readFileSync(outPath, 'utf8')) as GeneratedDoc;
});

describe('generate-matches.mjs', () => {
  it('produces the predecessor shape + the three new fields', () => {
    expect(Object.keys(doc.teams).length).toBeGreaterThan(0);
    expect(doc.matches.length).toBe(50); // recorded fixtures dedupe to 50 tournament matches
    doc.matches.forEach((m, i) => {
      expect(m.matchId).toBe(i + 1); // our own numbering 1..N
      expect(m.phase).toBeGreaterThanOrEqual(0);
      expect(m.phase).toBeLessThanOrEqual(5);
      expect(typeof m.knockout).toBe('boolean');
      expect(m.uefaMatchId).toMatch(/^\d+$/);
      expect(Number.isInteger(m.kickoffTime)).toBe(true);
      // teamA/teamB resolve through the teams map (3-letter codes)
      expect(doc.teams[m.teamA], m.teamA).toBeDefined();
      expect(doc.teams[m.teamB], m.teamB).toBeDefined();
      expect(m.teamA).toMatch(/^[A-Z0-9]{3}$/);
    });
  });

  it('orders matches by kickoff (matchId is kickoff-ascending)', () => {
    const kicks = doc.matches.map((m) => m.kickoffTime!);
    expect([...kicks].sort((a, b) => a - b)).toEqual(kicks);
  });

  it('wires two-legged ties: every tieId has exactly legs 1 and 2', () => {
    const ties = new Map<string, number[]>();
    for (const m of doc.matches) {
      if (m.tieId) ties.set(m.tieId, [...(ties.get(m.tieId) ?? []), m.legNumber!]);
    }
    expect(ties.size).toBe(22); // 8 play-off + 8 R16 + 4 QF + 2 SF ties in the archive
    for (const legs of ties.values()) expect(legs.sort()).toEqual([1, 2]);
    // the final is a SINGLE: knockout but no tie
    const final = doc.matches.find((m) => m.phase === 5)!;
    expect(final.knockout).toBe(true);
    expect(final.tieId).toBeNull();
    expect(final.legNumber).toBeNull();
  });

  it('tieId format matches the TypeScript adapter (toFixture) exactly', () => {
    const parsed = UefaMatchArraySchema.parse(loadFixture(AET_BATCH));
    const fromTs = new Map(parsed.map((m) => [m.id, toFixture(m)]));
    for (const m of doc.matches) {
      const f = fromTs.get(m.uefaMatchId);
      if (!f) continue; // first20-only match
      expect(m.tieId).toBe(f.tieId);
      expect(m.legNumber).toBe(f.legNumber);
      expect(m.kickoffTime).toBe(f.kickoffUnix);
    }
  });

  it('excludes qualifying-phase matches from the game', () => {
    const raw = loadFixture<{ competitionPhase?: string }[]>(AET_BATCH);
    expect(raw.every((m) => m.competitionPhase === 'TOURNAMENT')).toBe(true);
    // inject a qualifying match; it must not appear in the output
    const qual = structuredClone(raw[0]!) as Record<string, unknown>;
    qual.id = '1';
    qual.competitionPhase = 'QUALIFYING';
    const feedWithQual = join(tmp, 'feed-with-qualifying.json');
    writeFileSync(feedWithQual, JSON.stringify([...raw, qual]));
    const out2 = join(tmp, 'matches-qual.json');
    expect(run(GENERATE, ['--from', feedWithQual, '--out', out2]).status).toBe(0);
    const doc2 = JSON.parse(readFileSync(out2, 'utf8')) as GeneratedDoc;
    expect(doc2.matches.some((m) => m.uefaMatchId === '1')).toBe(false);
  });

  it('fails loudly on an unknown round name instead of guessing a phase', () => {
    const raw = loadFixture<Record<string, unknown>[]>(AET_BATCH);
    const weird = structuredClone(raw[0]!) as { round: { metaData: { name: string } } };
    weird.round.metaData.name = 'Grand Championship Shootout';
    const feedWeird = join(tmp, 'feed-weird-round.json');
    writeFileSync(feedWeird, JSON.stringify([weird]));
    const res = run(GENERATE, ['--from', feedWeird, '--out', join(tmp, 'x.json')]);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('unknown round name');
  });
});

describe('verify-fixtures.mjs', () => {
  it('PASSES (exit 0) against the untouched archive', () => {
    const res = run(VERIFY, ['--matches', outPath, '--feed', ...FEED_ARGS]);
    expect(res.status, res.stdout).toBe(0);
    expect(res.stdout).toContain('0 discrepancies');
  });

  const scramble = (mutate: (d: GeneratedDoc) => void, name: string) => {
    const copy = JSON.parse(readFileSync(outPath, 'utf8')) as GeneratedDoc;
    mutate(copy);
    const p = join(tmp, name);
    writeFileSync(p, JSON.stringify(copy));
    return run(VERIFY, ['--matches', p, '--feed', ...FEED_ARGS]);
  };

  it('FAILS loudly (exit 1 + diff) on a deliberately scrambled feeder', () => {
    const res = scramble((d) => {
      const ko = d.matches.filter((m) => m.knockout);
      // wire the wrong team into two knockout matches — the classic feeder bug
      const [a, b] = [ko[0]!, ko[5]!];
      [a.teamA, b.teamA] = [b.teamA, a.teamA];
    }, 'scrambled-feeder.json');
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/NO such fixture|ORIENTATION SWAPPED/);
    expect(res.stdout).not.toContain('0 discrepancies');
  });

  it('FAILS on a home/away swap (scores are directional)', () => {
    const res = scramble((d) => {
      const m = d.matches.find((x) => x.knockout)!;
      [m.teamA, m.teamB] = [m.teamB, m.teamA];
    }, 'scrambled-orientation.json');
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('ORIENTATION SWAPPED');
  });

  it('FAILS on a scrambled kickoff time', () => {
    const res = scramble((d) => {
      d.matches[10]!.kickoffTime! += 90 * 60; // same date, moved 90 minutes
    }, 'scrambled-kickoff.json');
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/kickoff .* vs feed/i);
  });

  it('FAILS on a wrong uefaMatchId', () => {
    const res = scramble((d) => {
      d.matches[3]!.uefaMatchId = '424242';
    }, 'scrambled-id.json');
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('uefaMatchId 424242');
  });

  it('FAILS on a feed match missing from matches.json (completeness)', () => {
    const res = scramble((d) => {
      d.matches.pop();
    }, 'scrambled-missing.json');
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('not in');
  });
});

describe('generate-matches.mjs — bytes3 team codes', () => {
  /** Replace one real team's code across the recorded feed (both legs, both sides). */
  const withTeamCode = (uefaTeamId: string, teamCode: string) => {
    const raw = loadFixture<Array<{ homeTeam: { id: string; teamCode?: string }; awayTeam: { id: string; teamCode?: string } }>>(AET_BATCH);
    for (const m of raw) {
      if (m.homeTeam.id === uefaTeamId) m.homeTeam.teamCode = teamCode;
      if (m.awayTeam.id === uefaTeamId) m.awayTeam.teamCode = teamCode;
    }
    const p = join(tmp, `feed-code-${uefaTeamId}-${teamCode}.json`);
    writeFileSync(p, JSON.stringify(raw));
    return p;
  };
  const GALATASARAY = '50067';

  it('truncates a 4-letter UEFA code (the LASK case) to 3 chars with a warning', () => {
    const out = join(tmp, 'matches-lask.json');
    const res = run(GENERATE, ['--from', withTeamCode(GALATASARAY, 'GALA'), '--out', out]);
    expect(res.status, res.stdout).toBe(0);
    const d = JSON.parse(readFileSync(out, 'utf8')) as GeneratedDoc;
    expect(d.teams.GAL).toBeDefined();
    expect(d.teams.GAL!.uefaId).toBe(GALATASARAY);
    expect(d.teams.GAL!.uefaCode).toBe('GALA'); // UEFA's own code kept for transparency
    expect(Object.keys(d.teams).every((c) => /^[A-Z0-9]{3}$/.test(c))).toBe(true);
  });

  it('honours an explicit --code override by UEFA team id', () => {
    const out = join(tmp, 'matches-override.json');
    const res = run(GENERATE, ['--from', withTeamCode(GALATASARAY, 'GALA'), '--out', out, '--code', `${GALATASARAY}=GSK`]);
    expect(res.status, res.stdout).toBe(0);
    const d = JSON.parse(readFileSync(out, 'utf8')) as GeneratedDoc;
    expect(d.teams.GSK!.uefaId).toBe(GALATASARAY);
    expect(d.teams.GAL).toBeUndefined();
    expect(d.matches.some((m) => m.teamA === 'GSK' || m.teamB === 'GSK')).toBe(true);
  });

  it('fails loudly when a truncated code collides with another team', () => {
    // Galatasaray as "PSGX" truncates to PSG — Paris already owns it
    const res = run(GENERATE, ['--from', withTeamCode(GALATASARAY, 'PSGX'), '--out', join(tmp, 'x.json')]);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('team code collision');
  });

  it('rejects an override that is not 3 ASCII chars (bytes3 on-chain)', () => {
    const res = run(GENERATE, ['--from', ...FEED_ARGS, '--out', join(tmp, 'x.json'), '--code', `${GALATASARAY}=GALA`]);
    expect(res.status).toBe(1);
    expect(res.stdout).toContain('3 ASCII');
  });
});
