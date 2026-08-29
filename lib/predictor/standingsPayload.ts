/**
 * Wire format for /api/standings.
 *
 * The board is derived from chain state, but deriving it needs ~450 eth_calls
 * and one profile lookup per entrant — done from the browser that is tens of
 * seconds of serial round trips per visitor (measured: ~16s of RPC + ~30s of
 * profile fetches at 51 entrants). The route does it once, server-side and
 * batched, and the CDN hands the same JSON to everyone for the next 30s.
 *
 * Chain stays the source of truth: this is a cache of a pure function of chain
 * state, not a second ledger. Nothing is written anywhere.
 *
 * JSON has no bigint, so points/counts travel as decimal strings and are
 * revived here. Both directions live in this file so they can't drift.
 */
import type { StandingRow } from "./standings";

export interface StandingsRowJson {
  address: string;
  username?: string;
  countryCode?: string;
  fullSeason: boolean;
  /** null = not in Stage 1 (renders "—") */
  leaguePoints: string | null;
  knockoutPoints: string;
  exactCount: string;
  enteredAt: string;
}

export interface StandingsPayload {
  chainId: number;
  matchCount: number;
  /** D9: any completed-but-unfinalized result on the board right now. */
  hasProvisional: boolean;
  /** ISO-8601, server clock — never rendered unpinned (SSR hydration rule). */
  updatedAt: string;
  rows: StandingsRowJson[];
}

const isAddress = (v: unknown): v is `0x${string}` =>
  typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);

const isUint = (v: unknown): v is string => typeof v === "string" && /^\d+$/.test(v);

export function toRowJson(row: StandingRow): StandingsRowJson {
  return {
    address: row.address,
    ...(row.username ? { username: row.username } : {}),
    ...(row.countryCode ? { countryCode: row.countryCode } : {}),
    fullSeason: row.fullSeason,
    leaguePoints: row.leaguePoints === null ? null : row.leaguePoints.toString(),
    knockoutPoints: row.knockoutPoints.toString(),
    exactCount: row.exactCount.toString(),
    enteredAt: row.enteredAt.toString(),
  };
}

/**
 * Revive one wire row. Returns null for anything malformed — a single bad row
 * must not blank the board, and the API is public enough to be worth defending
 * against (a truncated response, a stale deploy, a hand-crafted proxy).
 */
export function fromRowJson(raw: unknown): StandingRow | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (!isAddress(r.address)) return null;
  if (typeof r.fullSeason !== "boolean") return null;
  if (!isUint(r.knockoutPoints) || !isUint(r.exactCount) || !isUint(r.enteredAt)) return null;
  if (r.leaguePoints !== null && !isUint(r.leaguePoints)) return null;
  return {
    address: r.address,
    ...(typeof r.username === "string" ? { username: r.username } : {}),
    ...(typeof r.countryCode === "string" ? { countryCode: r.countryCode } : {}),
    fullSeason: r.fullSeason,
    leaguePoints: r.leaguePoints === null ? null : BigInt(r.leaguePoints as string),
    knockoutPoints: BigInt(r.knockoutPoints),
    exactCount: BigInt(r.exactCount),
    enteredAt: BigInt(r.enteredAt),
  };
}

export interface ParsedStandings {
  rows: StandingRow[];
  hasProvisional: boolean;
  matchCount: number;
  updatedAt: string | null;
}

/** Parse a whole /api/standings body; unusable bodies yield an empty board. */
export function parseStandingsPayload(raw: unknown): ParsedStandings {
  const body = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const rows = Array.isArray(body.rows)
    ? body.rows.map(fromRowJson).filter((r): r is StandingRow => r !== null)
    : [];
  return {
    rows,
    hasProvisional: body.hasProvisional === true,
    matchCount: typeof body.matchCount === "number" ? body.matchCount : 0,
    updatedAt: typeof body.updatedAt === "string" ? body.updatedAt : null,
  };
}
