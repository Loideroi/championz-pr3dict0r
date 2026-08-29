/**
 * Bundled fixtures (PRD §7.3): the generate-matches.mjs document that was
 * pushed on-chain, shipped with the app so the slate can show club names,
 * matchday headers and the `uefaMatchId` that lights up Match Insights.
 *
 * Chain is truth. The bundle is cosmetic and DEFENSIVE: an entry is only used
 * for an on-chain match when both team codes agree, so a stale or wrong bundle
 * degrades to the 3-letter codes instead of relabelling a fixture. Static
 * import → deterministic on the server (SSR-safe, no fetch, no Date.now()).
 */
import raw from "./matches.json";
import type { SlateMatch } from "@/lib/predictor/slate";

export type BundledTeam = {
  name: string;
  code: string;
  uefaId: string;
  country?: string;
  /** UEFA's own code when it differs from ours (LASK → LAS, bytes3) */
  uefaCode?: string;
  /** Official crest URL from the feed (img.uefa.com …/240x240/<uefaId>.png) */
  crest?: string;
};

export type BundledMatch = {
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
};

export type FixturesDoc = {
  generatedFrom?: unknown;
  generatedAt?: string | null;
  source?: string | null;
  teams: Record<string, BundledTeam>;
  matches: BundledMatch[];
};

export type FixtureLookup = {
  doc: FixturesDoc;
  /** Club name for a 3-letter code; the code itself when unknown. */
  teamName: (code: string) => string;
  /** Crest URL for a code (feed value, else the documented img.uefa.com pattern); null when unknown. */
  teamCrest: (code: string) => string | null;
  /** The bundled entry for an on-chain match — only if it agrees on both codes. */
  bundledMatch: (matchId: number, teamA: string, teamB: string) => BundledMatch | null;
  /** Decorate an on-chain slate row with names / matchday / uefaMatchId. */
  enrichSlate: (match: SlateMatch) => SlateMatch;
};

export function makeFixtureLookup(doc: FixturesDoc): FixtureLookup {
  const byId = new Map<number, BundledMatch>(doc.matches.map((m) => [m.matchId, m]));
  const teamName = (code: string) => doc.teams[code]?.name ?? code;
  const teamCrest = (code: string): string | null => {
    const team = doc.teams[code];
    if (!team) return null;
    return team.crest ?? `https://img.uefa.com/imgml/TP/teams/logos/240x240/${team.uefaId}.png`;
  };
  const bundledMatch = (matchId: number, teamA: string, teamB: string) => {
    const m = byId.get(matchId);
    return m && m.teamA === teamA && m.teamB === teamB ? m : null;
  };
  const enrichSlate = (match: SlateMatch): SlateMatch => {
    const b = bundledMatch(match.id, match.teamA, match.teamB);
    return {
      ...match,
      nameA: teamName(match.teamA),
      nameB: teamName(match.teamB),
      crestA: teamCrest(match.teamA),
      crestB: teamCrest(match.teamB),
      matchday: b?.matchday ?? null,
      uefaMatchId: b?.uefaMatchId ?? null,
    };
  };
  return { doc, teamName, teamCrest, bundledMatch, enrichSlate };
}

export const FIXTURES: FixturesDoc = raw as unknown as FixturesDoc;

const lookup = makeFixtureLookup(FIXTURES);
export const teamName = lookup.teamName;
export const teamCrest = lookup.teamCrest;
export const bundledMatch = lookup.bundledMatch;
export const enrichSlate = lookup.enrichSlate;
