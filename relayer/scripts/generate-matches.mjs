#!/usr/bin/env node
/**
 * Generate matches.json from the UEFA feed (PRD §7.3) — never hand-authored.
 *
 * Keeps the predecessor's shape (single file: `teams` map keyed by 3-letter
 * code, `matches[]` with our own numeric matchId 1..N, phases, unix kickoffs)
 * and extends every match with `uefaMatchId`, `tieId` and `legNumber`.
 *
 * Only the tournament proper is included (competitionPhase === "TOURNAMENT"):
 * league phase (144) + knockout. Qualifying rounds are not part of the game.
 *
 * Input is either recorded fixture files (raw match.uefa.com/v5 arrays) or the
 * live feed:
 *   node scripts/generate-matches.mjs --from test/fixtures/a.json [b.json ...] --out out.json
 *   node scripts/generate-matches.mjs --season 2026 --out out.json
 *
 * NOTE: the tieId / kickoff / leg mapping here MUST stay in sync with
 * `src/source.ts` (toFixture / tieIdOf) — test/generate.test.ts cross-checks
 * the two against the same recorded payload.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const API = 'https://match.uefa.com/v5/matches';
const COMPETITION_ID = '1';
const PAGE = 50;

/** Round name -> our phase number (0 = league phase; knockout ascends to the final). */
const PHASES = [
  { match: /league phase|group/i, phase: 0, knockout: false, label: 'League Phase' },
  { match: /play-?off/i, phase: 1, knockout: true, label: 'Knock-out Play-off' },
  { match: /round of 16/i, phase: 2, knockout: true, label: 'Round of 16' },
  { match: /quarter/i, phase: 3, knockout: true, label: 'Quarter-finals' },
  { match: /semi/i, phase: 4, knockout: true, label: 'Semi-finals' },
  { match: /^final$/i, phase: 5, knockout: true, label: 'Final' },
];

const fail = (msg) => {
  console.error(`generate-matches: ${msg}`);
  process.exit(1);
};

const phaseOf = (roundName) => {
  const hit = PHASES.find((p) => p.match.test(roundName));
  if (!hit) fail(`unknown round name "${roundName}" — extend PHASES before generating`);
  return hit;
};

const kickoffUnix = (m) => {
  const iso = m.kickOffTime?.dateTime;
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
};

/** Must mirror tieIdOf() in src/source.ts. */
const tieIdOf = (m) => {
  if (m.type !== 'FIRST_LEG' && m.type !== 'SECOND_LEG') return null;
  const [a, b] = [m.homeTeam.id, m.awayTeam.id].sort();
  return `${m.round.id}:${a}-${b}`;
};

const legNumberOf = (m) =>
  m.leg?.number ?? (m.type === 'FIRST_LEG' ? 1 : m.type === 'SECOND_LEG' ? 2 : null);

async function fetchSeason(seasonYear) {
  const all = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = `${API}?competitionId=${COMPETITION_ID}&seasonYear=${seasonYear}&order=ASC&limit=${PAGE}&offset=${offset}`;
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) fail(`UEFA API HTTP ${res.status} for ${url}`);
    const page = await res.json();
    if (!Array.isArray(page)) fail(`non-array payload for ${url}`);
    all.push(...page);
    if (page.length < PAGE) break;
  }
  return all;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
const argMulti = (name) => {
  const i = argv.indexOf(name);
  if (i === -1) return [];
  const values = [];
  for (let k = i + 1; k < argv.length && !argv[k].startsWith('--'); k++) values.push(argv[k]);
  return values;
};

const fromFiles = argMulti('--from');
const season = arg('--season');
const outPath = arg('--out');
if (!outPath || (fromFiles.length === 0 && !season)) {
  fail('usage: generate-matches.mjs (--from <fixture.json>... | --season <year>) --out <matches.json>');
}

// ---------------------------------------------------------------------------
// Load + filter + dedupe
// ---------------------------------------------------------------------------
let raw = [];
if (fromFiles.length > 0) {
  for (const f of fromFiles) {
    const doc = JSON.parse(readFileSync(resolve(f), 'utf8'));
    if (!Array.isArray(doc)) fail(`${f} is not a raw match array`);
    raw.push(...doc);
  }
  console.log(`loaded ${raw.length} raw matches from ${fromFiles.length} fixture file(s)`);
} else {
  raw = await fetchSeason(season);
  console.log(`fetched ${raw.length} raw matches for seasonYear=${season}`);
}

const byId = new Map();
for (const m of raw) {
  if (!m?.id || !m.homeTeam || !m.awayTeam || !m.round || !m.kickOffTime) {
    fail(`raw match missing consumed fields: ${JSON.stringify(m).slice(0, 120)}`);
  }
  if (m.competitionPhase !== 'TOURNAMENT') continue; // qualifying is out of scope
  byId.set(m.id, m); // last occurrence wins (fixture files may overlap)
}
const tournament = [...byId.values()].sort((a, b) => {
  const ka = kickoffUnix(a) ?? Date.parse(a.kickOffTime.date) / 1000;
  const kb = kickoffUnix(b) ?? Date.parse(b.kickOffTime.date) / 1000;
  return ka - kb || a.id.localeCompare(b.id);
});
if (tournament.length === 0) fail('no TOURNAMENT-phase matches in input');

// ---------------------------------------------------------------------------
// Teams map (3-letter codes)
// ---------------------------------------------------------------------------
const teams = {}; // code -> { name, code, uefaId, country }
const codeByUefaId = new Map();

const registerTeam = (t) => {
  if (t.isPlaceHolder) return null;
  const existing = codeByUefaId.get(t.id);
  if (existing) return existing;
  let code = (t.teamCode || t.internationalName.slice(0, 3)).toUpperCase();
  if (teams[code] && teams[code].uefaId !== t.id) {
    fail(`team code collision: ${code} used by ${teams[code].name} (${teams[code].uefaId}) and ${t.internationalName} (${t.id})`);
  }
  teams[code] = {
    name: t.internationalName,
    code,
    uefaId: t.id,
    ...(t.countryCode ? { country: t.countryCode } : {}),
  };
  codeByUefaId.set(t.id, code);
  return code;
};

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------
const matches = tournament.map((m, i) => {
  const p = phaseOf(m.round.metaData.name);
  const teamA = registerTeam(m.homeTeam);
  const teamB = registerTeam(m.awayTeam);
  return {
    matchId: i + 1,
    phase: p.phase,
    teamA: teamA ?? m.homeTeam.internationalName, // placeholder label until the draw resolves it
    teamB: teamB ?? m.awayTeam.internationalName,
    kickoffTime: kickoffUnix(m),
    group: p.phase === 0 ? (m.group?.metaData?.groupShortName ?? 'League') : null,
    matchday: p.phase === 0 && m.matchday?.sequenceNumber ? Number(m.matchday.sequenceNumber) : null,
    knockout: p.knockout,
    uefaMatchId: m.id,
    tieId: tieIdOf(m),
    legNumber: legNumberOf(m),
  };
});

// Two-legged tie sanity: every tieId must appear exactly twice (leg 1 + leg 2),
// except in partial inputs where a lone SECOND_LEG is tolerated with a warning.
const tieLegs = new Map();
for (const m of matches) {
  if (m.tieId) tieLegs.set(m.tieId, [...(tieLegs.get(m.tieId) ?? []), m.legNumber]);
}
let loneLegs = 0;
for (const [tieId, legs] of tieLegs) {
  if (legs.length === 2 && legs.includes(1) && legs.includes(2)) continue;
  loneLegs++;
  console.warn(`  warn: tie ${tieId} has legs [${legs.join(',')}] in this input`);
}
if (loneLegs > 0) console.warn(`  ${loneLegs} incomplete tie(s) — expected only for partial fixture inputs`);

const out = {
  generatedFrom: fromFiles.length > 0 ? fromFiles.map((f) => f.replace(/^.*\/(test\/fixtures\/)/, '$1')) : `live:seasonYear=${season}`,
  source: 'uefa-api@1.0.2 (match.uefa.com/v5/matches, competitionId=1)',
  teams,
  matches,
};

mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(resolve(outPath), JSON.stringify(out, null, 2) + '\n');

const phases = matches.reduce((acc, m) => ((acc[m.phase] = (acc[m.phase] ?? 0) + 1), acc), {});
console.log(`wrote ${outPath}: ${Object.keys(teams).length} teams, ${matches.length} matches, phases ${JSON.stringify(phases)}, ${tieLegs.size} two-legged tie(s)`);
