import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { MatchesDoc } from '../src/fixtureMap.js';
import { diffOnchain, formatOnchainReport, stageOfPhase, type ChainMatchRow } from '../src/onchainVerify.js';
import { relayerRoot } from './helpers.js';

const sample = JSON.parse(
  readFileSync(resolve(relayerRoot, 'test/output/matches-sample.json'), 'utf8'),
) as MatchesDoc;

/** A faithful on-chain projection of the sample, optionally offset. */
const chainRows = (doc: MatchesDoc, offset = 0, phase: number | null = null): ChainMatchRow[] =>
  doc.matches
    .filter((m) => phase === null || m.phase === phase)
    .map((m) => ({
      matchId: m.matchId + offset,
      kickoff: m.kickoffTime ?? 0,
      status: 0,
      teamA: m.teamA,
      teamB: m.teamB,
      stage: stageOfPhase(m.phase),
    }));

describe('onchainVerify', () => {
  it('maps phase 0 to the league stage and every knockout round to stage 1', () => {
    expect(stageOfPhase(0)).toBe(0);
    for (const p of [1, 2, 3, 4, 5]) expect(stageOfPhase(p)).toBe(1);
  });

  it('passes on a faithful projection', () => {
    const report = diffOnchain(sample, chainRows(sample));
    expect(report.checked).toBe(sample.matches.length);
    expect(report.discrepancies).toEqual([]);
    expect(formatOnchainReport(report, 'test')).toContain('0 discrepancies');
  });

  it('honours the id offset (staging proxy already holding 4 matches)', () => {
    const staging: ChainMatchRow[] = [1, 2, 3, 4].map((id) => ({
      matchId: id,
      kickoff: 1_700_000_000,
      status: 1,
      teamA: 'AAA',
      teamB: 'BBB',
      stage: 0,
    }));
    const report = diffOnchain(sample, [...staging, ...chainRows(sample, 4)], { idOffset: 4 });
    expect(report.discrepancies).toEqual([]);
  });

  it('flags a wrong kickoff, a swapped orientation, a wrong stage and a missing row', () => {
    const rows = chainRows(sample);
    rows[0]!.kickoff += 60 * 60;
    [rows[1]!.teamA, rows[1]!.teamB] = [rows[1]!.teamB, rows[1]!.teamA];
    rows[2]!.stage = 1 - rows[2]!.stage;
    rows.pop();
    const report = diffOnchain(sample, rows);
    const fields = report.discrepancies.map((d) => `${d.matchId}:${d.field}`);
    expect(fields).toContain('1:kickoff');
    expect(fields).toContain('2:teamA');
    expect(fields).toContain('2:teamB');
    expect(fields).toContain('3:stage');
    expect(fields).toContain(`${sample.matches.length}:missing`);
    expect(formatOnchainReport(report, 'test')).toMatch(/match 1: kickoff/);
  });

  it('flags stray matches on-chain that matches.json does not know', () => {
    const rows = chainRows(sample);
    rows.push({ matchId: rows.length + 1, kickoff: 1_800_000_000, status: 0, teamA: 'XXX', teamB: 'YYY', stage: 0 });
    const report = diffOnchain(sample, rows);
    expect(report.discrepancies).toEqual([
      expect.objectContaining({ matchId: rows.length, field: 'extra' }),
    ]);
  });

  it('a league-only selection ignores knockout rows beyond it only if they are absent', () => {
    // pushing phase 0 only: the chain should hold exactly the league rows
    const leagueRows = chainRows(sample, 0, 0);
    expect(diffOnchain(sample, leagueRows, { phase: 0 }).discrepancies).toEqual([]);
  });
});
