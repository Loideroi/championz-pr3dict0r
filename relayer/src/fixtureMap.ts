import type { MapEntry } from './relay.js';

/**
 * The generate-matches.mjs document (PRD §7.3) as the relayer and the
 * contract tooling consume it. Our `matchId` is our OWN 1..N numbering,
 * kickoff-ascending; `addMatches` assigns on-chain ids sequentially, so a
 * push of matches 1..N onto a proxy holding `idOffset` matches yields
 * on-chain ids idOffset+1 .. idOffset+N. Everything here leans on that.
 */
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
  /** 3-letter code (key into `teams`) — or a placeholder label pre-draw */
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

/** Matches of one phase (null = every phase), matchId-ascending. */
export function selectMatches(doc: MatchesDoc, phase: number | null = null): GeneratedMatch[] {
  return doc.matches
    .filter((m) => phase === null || m.phase === phase)
    .sort((a, b) => a.matchId - b.matchId);
}

/**
 * The selected matches must be exactly 1..N: on-chain ids are assigned by
 * push order, so a gap or a reorder would silently mis-wire results to the
 * wrong fixture. Loud failure instead.
 */
export function assertContiguous(matches: GeneratedMatch[]): void {
  matches.forEach((m, i) => {
    if (m.matchId !== i + 1) {
      throw new Error(
        `matchIds must be contiguous from 1 (found ${m.matchId} at position ${i + 1}) — ` +
          'on-chain ids are assigned sequentially by addMatches, so the selection cannot have gaps',
      );
    }
  });
}

/**
 * Relayer map (config/*-map.json): on-chain id ↔ UEFA match id + the home /
 * away UEFA team ids the advancer bit is resolved against (relay.ts
 * packResult). Placeholder fixtures cannot be mapped — the map is generated
 * from a post-draw matches.json only.
 */
export function mapFromMatches(
  doc: MatchesDoc,
  opts: { phase?: number | null; idOffset?: number } = {},
): MapEntry[] {
  const offset = opts.idOffset ?? 0;
  const selected = selectMatches(doc, opts.phase ?? null);
  assertContiguous(selected);
  return selected.map((m) => {
    const home = doc.teams[m.teamA];
    const away = doc.teams[m.teamB];
    if (!home || !away) {
      throw new Error(
        `match ${m.matchId} (${m.teamA} v ${m.teamB}) has a placeholder team — the relayer map needs real UEFA team ids`,
      );
    }
    return {
      matchId: m.matchId + offset,
      uefaMatchId: m.uefaMatchId,
      homeTeamId: home.uefaId,
      awayTeamId: away.uefaId,
      label: `${m.teamA}–${m.teamB}`,
    };
  });
}
