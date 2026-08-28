import { readFileSync } from "node:fs";

/**
 * Fixture-push planning (PRD §7.3/§7.4) — pure helpers shared by
 * scripts/add-fixtures.ts and test/AddFixtures.test.ts.
 *
 * Input is the relayer's generate-matches.mjs document (never hand-authored).
 * Our matchId is our own 1..N numbering, kickoff-ascending; `addMatches`
 * assigns on-chain ids sequentially, so a push of matches 1..N onto a proxy
 * already holding `idOffset` matches yields on-chain ids idOffset+1..idOffset+N.
 */
export const STAGE_LEAGUE = 0;
export const STAGE_KNOCKOUT = 1;
export const PREDICTION_LOCKOUT = 3600;
/** One matchday per transaction (18 league fixtures). */
export const DEFAULT_CHUNK = 18;
/** bytes3 on-chain: exactly 3 ASCII uppercase letters/digits. */
export const TEAM_CODE = /^[A-Z0-9]{3}$/;

export interface GeneratedTeam {
  name: string;
  code: string;
  uefaId: string;
  country?: string;
}

export interface GeneratedMatch {
  matchId: number;
  /** 0 = league phase; 1..5 = play-off, R16, QF, SF, final */
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

export interface MatchesDoc {
  generatedFrom?: unknown;
  source?: string;
  teams: Record<string, GeneratedTeam>;
  matches: GeneratedMatch[];
}

export function loadMatches(path: string): MatchesDoc {
  const doc = JSON.parse(readFileSync(path, "utf8")) as MatchesDoc;
  if (!doc || typeof doc !== "object" || !Array.isArray(doc.matches) || typeof doc.teams !== "object") {
    throw new Error(`${path}: not a generate-matches.mjs document (expected { teams, matches[] })`);
  }
  return doc;
}

/** matches.json phase → contract stage (league = 0, every knockout round = 1). */
export const stageOfPhase = (phase: number): number => (phase === 0 ? STAGE_LEAGUE : STAGE_KNOCKOUT);

/** "RMA" → 0x524d41 (bytes3). Anything but 3 ASCII chars is refused. */
export function encodeTeam(code: string): string {
  if (!TEAM_CODE.test(code)) {
    throw new Error(`team code "${code}" is not 3 ASCII uppercase chars/digits (bytes3 on-chain)`);
  }
  return "0x" + Buffer.from(code, "ascii").toString("hex");
}

export function decodeTeam(hex: string): string {
  return Buffer.from(hex.replace(/^0x/, ""), "hex").toString("ascii").replace(/\0+$/, "");
}

/**
 * Matches of one phase (null = every phase), matchId-ascending — and they
 * must be exactly 1..N (gaps or reorders would mis-wire results silently).
 */
export function selectMatches(doc: MatchesDoc, phase: number | null): GeneratedMatch[] {
  const selected = doc.matches
    .filter((m) => phase === null || m.phase === phase)
    .sort((a, b) => a.matchId - b.matchId);
  selected.forEach((m, i) => {
    if (m.matchId !== i + 1) {
      throw new Error(
        `matchIds must be contiguous from 1 (found ${m.matchId} at position ${i + 1}) — on-chain ids are assigned sequentially by addMatches`,
      );
    }
  });
  return selected;
}

export interface PlannedMatch {
  matchId: number;
  /** on-chain id = matchId + idOffset */
  chainId: number;
  kickoff: number;
  teamA: string;
  teamB: string;
  stage: number;
  uefaMatchId: string;
  matchday: number | null;
}

export interface Chunk {
  index: number;
  matches: PlannedMatch[];
  kickoffs: bigint[];
  teamsA: string[];
  teamsB: string[];
  stageIds: number[];
}

export interface Plan {
  matches: PlannedMatch[];
  chunks: Chunk[];
  warnings: string[];
  firstKickoff: number;
  lastKickoff: number;
  idOffset: number;
}

export function planFixtures(
  doc: MatchesDoc,
  opts: { phase: number | null; idOffset?: number; chunk?: number; now?: number },
): Plan {
  const idOffset = opts.idOffset ?? 0;
  const chunkSize = opts.chunk ?? DEFAULT_CHUNK;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  if (chunkSize < 1) throw new Error("chunk size must be ≥ 1");

  const selected = selectMatches(doc, opts.phase);
  if (selected.length === 0) throw new Error(`no matches for phase ${opts.phase ?? "all"} in matches.json`);

  const warnings: string[] = [];
  const seenUefa = new Set<string>();
  const matches: PlannedMatch[] = selected.map((m) => {
    const label = `match ${m.matchId} (${m.teamA} v ${m.teamB})`;
    if (m.kickoffTime === null) throw new Error(`${label}: no kickoff time yet — UEFA has date-but-not-time; wait for the schedule`);
    if (m.kickoffTime < PREDICTION_LOCKOUT) throw new Error(`${label}: kickoff ${m.kickoffTime} below the lockout floor`);
    if (seenUefa.has(m.uefaMatchId)) throw new Error(`${label}: duplicate uefaMatchId ${m.uefaMatchId}`);
    seenUefa.add(m.uefaMatchId);
    if (m.teamA === m.teamB) throw new Error(`${label}: a team cannot play itself`);
    // encodeTeam throws on placeholders ("Winner of…") and bad codes
    encodeTeam(m.teamA);
    encodeTeam(m.teamB);
    if (!doc.teams[m.teamA] || !doc.teams[m.teamB]) warnings.push(`${label}: a team code is missing from the teams map`);
    if (m.kickoffTime < now + PREDICTION_LOCKOUT) {
      warnings.push(`${label}: kickoff ${new Date(m.kickoffTime * 1000).toISOString()} is already inside the lockout — predictions will be locked from the start`);
    }
    return {
      matchId: m.matchId,
      chainId: m.matchId + idOffset,
      kickoff: m.kickoffTime,
      teamA: m.teamA,
      teamB: m.teamB,
      stage: stageOfPhase(m.phase),
      uefaMatchId: m.uefaMatchId,
      matchday: m.matchday,
    };
  });

  const chunks: Chunk[] = [];
  for (let i = 0; i < matches.length; i += chunkSize) {
    const slice = matches.slice(i, i + chunkSize);
    chunks.push({
      index: chunks.length,
      matches: slice,
      kickoffs: slice.map((m) => BigInt(m.kickoff)),
      teamsA: slice.map((m) => encodeTeam(m.teamA)),
      teamsB: slice.map((m) => encodeTeam(m.teamB)),
      stageIds: slice.map((m) => m.stage),
    });
  }

  return {
    matches,
    chunks,
    warnings,
    firstKickoff: Math.min(...matches.map((m) => m.kickoff)),
    lastKickoff: Math.max(...matches.map((m) => m.kickoff)),
    idOffset,
  };
}

const iso = (unix: number) => new Date(unix * 1000).toISOString().replace(".000Z", "Z");

export function chunkLabel(c: Chunk): string {
  const first = c.matches[0];
  const last = c.matches[c.matches.length - 1];
  const md = first.matchday !== null ? ` · MD${first.matchday}${last.matchday !== first.matchday ? `–${last.matchday}` : ""}` : "";
  return `#${c.index + 1}: on-chain ids ${first.chainId}–${last.chainId} · ${c.matches.length} matches${md} · ${iso(first.kickoff)} → ${iso(last.kickoff)}`;
}

export interface ReadbackRow {
  chainId: number;
  kickoff: number;
  teamA: string;
  teamB: string;
  stage: number;
}

/** Field-by-field comparison of what we planned vs what the proxy now holds. */
export function diffReadback(plan: Plan, rows: ReadbackRow[]): string[] {
  const byId = new Map(rows.map((r) => [r.chainId, r]));
  const problems: string[] = [];
  for (const m of plan.matches) {
    const r = byId.get(m.chainId);
    const label = `on-chain ${m.chainId} (${m.teamA} v ${m.teamB})`;
    if (!r || r.kickoff === 0) {
      problems.push(`${label}: MISSING on-chain`);
      continue;
    }
    if (r.kickoff !== m.kickoff) problems.push(`${label}: kickoff ${iso(r.kickoff)} ≠ planned ${iso(m.kickoff)}`);
    if (r.teamA !== m.teamA) problems.push(`${label}: teamA ${r.teamA} ≠ planned ${m.teamA}`);
    if (r.teamB !== m.teamB) problems.push(`${label}: teamB ${r.teamB} ≠ planned ${m.teamB}`);
    if (r.stage !== m.stage) problems.push(`${label}: stage ${r.stage} ≠ planned ${m.stage}`);
  }
  return problems;
}
