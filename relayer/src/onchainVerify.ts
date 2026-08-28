import { assertContiguous, selectMatches, type MatchesDoc } from './fixtureMap.js';

/**
 * On-chain fixture verification (PRD §7.4 — "bundled + on-chain data").
 * verify-fixtures.mjs proves matches.json ↔ UEFA feed; this proves
 * matches.json ↔ the proxy's `matches(id)` rows, field by field, plus the
 * absence of stray extra matches. Pure — scripts/verify-onchain.mjs does I/O.
 */
export const STAGE_LEAGUE = 0;
export const STAGE_KNOCKOUT = 1;

/** matches.json phase → contract stage (league = 0, every knockout round = 1). */
export const stageOfPhase = (phase: number): number => (phase === 0 ? STAGE_LEAGUE : STAGE_KNOCKOUT);

export interface ChainMatchRow {
  matchId: number;
  /** unix seconds; 0 = no such match */
  kickoff: number;
  /** MatchStatus: 0 SCHEDULED · 1 COMPLETED · 2 VOIDED */
  status: number;
  /** decoded bytes3 codes */
  teamA: string;
  teamB: string;
  stage: number;
}

export type DiscrepancyField = 'missing' | 'extra' | 'kickoff' | 'teamA' | 'teamB' | 'stage';

export interface OnchainDiscrepancy {
  matchId: number;
  field: DiscrepancyField;
  expected: string;
  actual: string;
}

export interface OnchainReport {
  /** matches.json entries compared */
  checked: number;
  discrepancies: OnchainDiscrepancy[];
}

export function diffOnchain(
  doc: MatchesDoc,
  rows: ChainMatchRow[],
  opts: { phase?: number | null; idOffset?: number } = {},
): OnchainReport {
  const offset = opts.idOffset ?? 0;
  const expected = selectMatches(doc, opts.phase ?? null);
  assertContiguous(expected);
  const byId = new Map(rows.map((r) => [r.matchId, r]));
  const discrepancies: OnchainDiscrepancy[] = [];

  for (const m of expected) {
    const id = m.matchId + offset;
    const r = byId.get(id);
    const label = `${m.teamA} v ${m.teamB}`;
    if (!r || r.kickoff === 0) {
      discrepancies.push({ matchId: id, field: 'missing', expected: label, actual: 'no such match on-chain' });
      continue;
    }
    if (m.kickoffTime === null || r.kickoff !== m.kickoffTime) {
      discrepancies.push({
        matchId: id,
        field: 'kickoff',
        expected: m.kickoffTime === null ? 'null (unscheduled)' : new Date(m.kickoffTime * 1000).toISOString(),
        actual: new Date(r.kickoff * 1000).toISOString(),
      });
    }
    if (r.teamA !== m.teamA) discrepancies.push({ matchId: id, field: 'teamA', expected: m.teamA, actual: r.teamA });
    if (r.teamB !== m.teamB) discrepancies.push({ matchId: id, field: 'teamB', expected: m.teamB, actual: r.teamB });
    const stage = stageOfPhase(m.phase);
    if (r.stage !== stage) discrepancies.push({ matchId: id, field: 'stage', expected: String(stage), actual: String(r.stage) });
  }

  const expectedIds = new Set(expected.map((m) => m.matchId + offset));
  for (const r of rows) {
    if (r.matchId > offset && r.kickoff !== 0 && !expectedIds.has(r.matchId)) {
      discrepancies.push({
        matchId: r.matchId,
        field: 'extra',
        expected: 'not in matches.json',
        actual: `${r.teamA} v ${r.teamB} @ ${new Date(r.kickoff * 1000).toISOString()}`,
      });
    }
  }

  return { checked: expected.length, discrepancies };
}

export function formatOnchainReport(report: OnchainReport, where: string): string {
  const lines = [`# On-chain fixture verification — ${where}`, `# ${report.checked} matches.json entries compared`, ''];
  if (report.discrepancies.length === 0) {
    lines.push('  OK — every entry matches its on-chain row (kickoff, teams, stage); no stray matches');
  } else {
    for (const d of report.discrepancies) {
      lines.push(`  match ${d.matchId}: ${d.field} — expected ${d.expected}, on-chain ${d.actual}`);
    }
  }
  lines.push('', `# Summary: ${report.discrepancies.length} discrepanc${report.discrepancies.length === 1 ? 'y' : 'ies'}`);
  return lines.join('\n');
}
