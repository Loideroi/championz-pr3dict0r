#!/usr/bin/env node
/**
 * Match Insights generator (slice 15, ADR-0011) — one command per matchday:
 *
 *   node scripts/generate-insights.mjs --season 2027 --out ../public/insights
 *   node scripts/generate-insights.mjs --fixtures test/fixtures/matches-ucl-2026-aet.json --out test/output/insights-sample
 *
 * Live mode pulls the season from the UEFA source; --fixtures replays a
 * recorded payload (offline, CI-safe). Output: <out>/<locale>.json keyed by
 * uefaMatchId — six files, identical key sets, numerics byte-identical.
 * Rendering is empty-safe downstream: a missing key simply renders nothing,
 * so insights may lag fixtures (knockout rounds appear after each draw).
 *
 * In live mode it also pulls the two published strength signals — UEFA's club
 * coefficients and last season's competition — so a fixture reads as an actual
 * preview before any result exists. They come from different hosts to the
 * match feed; if either is unreachable the run still succeeds and simply falls
 * back to form-only copy (`--no-strength` forces that path).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { UefaApiSource } from '../dist/src/source.js';
import { toFixture, toMatchResult } from '../dist/src/source.js';
import { buildFacts, INSIGHT_LOCALES, renderInsight, tablePositions } from '../dist/src/insights.js';
import {
  buildStrengthIndex,
  fetchClubCoefficients,
  fetchLeaguePhaseRanks,
  runsFromMatches,
} from '../dist/src/strength.js';

const args = process.argv.slice(2);
const argVal = (f) => {
  const i = args.indexOf(f);
  return i !== -1 ? args[i + 1] : undefined;
};
const outDir = argVal('--out');
if (!outDir) {
  console.error('usage: generate-insights.mjs (--season YYYY | --fixtures file.json) --out dir [--no-strength]');
  process.exit(1);
}

const season = argVal('--season') ?? '2027';
const source = new UefaApiSource();

let raw;
if (argVal('--fixtures')) {
  raw = JSON.parse(readFileSync(argVal('--fixtures'), 'utf8'));
} else {
  raw = await source.rawSeason(season);
}

// tournament proper only; skip placeholder fixtures (draw not held yet)
const matches = raw.filter((m) => (m.competitionPhase ?? 'TOURNAMENT') === 'TOURNAMENT');
const fixtures = matches.map(toFixture).filter((f) => !f.home.isPlaceHolder && !f.away.isPlaceHolder);
const played = matches
  .map((m) => ({ fixture: toFixture(m), result: toMatchResult(m) }))
  .filter((x) => x.result !== null && x.fixture.status === 'FINISHED');

/**
 * Published strength for every club in the slate. The coefficient that seeded
 * this season's draw is the one published at the end of the previous season,
 * so both lookups key off `season - 1`.
 */
async function loadStrength() {
  if (args.includes('--no-strength') || argVal('--fixtures')) return null;
  const previous = String(Number(season) - 1);
  const [coefficients, prevLeagueRanks, prevSeason] = await Promise.all([
    fetchClubCoefficients(previous),
    fetchLeaguePhaseRanks(previous),
    source.rawSeason(previous),
  ]);
  const teamIds = new Set(fixtures.flatMap((f) => [f.home.uefaTeamId, f.away.uefaTeamId]));
  const index = buildStrengthIndex({
    teamIds,
    coefficients,
    prevRuns: runsFromMatches(prevSeason),
    prevLeagueRanks,
  });
  const ranked = [...index.values()].filter((s) => s.coefRank !== null).length;
  console.log(
    `strength: ${index.size} clubs · ${ranked} in UEFA's ${previous} coefficient ranking · ` +
      `${[...index.values()].filter((s) => s.prevRun !== 'ABSENT').length} played the ${previous} competition`,
  );
  return index;
}

let strength = null;
try {
  strength = await loadStrength();
} catch (err) {
  // Insights are decoration, not the oracle path — degrade, never fail the run.
  console.warn(`warning: strength data unavailable (${err.message}); falling back to form-only copy`);
}

/**
 * The table line is computed locally (per fixture, as it stood at kickoff).
 * Between matchdays that equals the table UEFA publishes, so in live mode
 * compare the two and say so if they differ — a feed glitch or a tiebreak
 * UEFA applied that we cannot see. Decoration, never a failed run.
 */
async function checkAgainstPublishedTable() {
  if (argVal('--fixtures') || played.length === 0) return;
  const official = await fetchLeaguePhaseRanks(season);
  if (official.size === 0) return;
  const ours = tablePositions(played);
  const names = new Map(fixtures.flatMap((f) => [[f.home.uefaTeamId, f.home.name], [f.away.uefaTeamId, f.away.name]]));
  const diffs = [...official].filter(([id, rank]) => ours.get(id) !== rank);
  if (diffs.length === 0) {
    console.log(`table: ${ours.size} clubs, all positions equal UEFA's published standings`);
    return;
  }
  console.warn(`warning: ${diffs.length} table position(s) differ from UEFA's published standings:`);
  for (const [id, rank] of diffs) console.warn(`  ${names.get(id) ?? id}: ours ${ours.get(id) ?? '-'}, UEFA ${rank}`);
}
try {
  await checkAgainstPublishedTable();
} catch (err) {
  console.warn(`warning: could not compare with UEFA's published standings (${err.message})`);
}

const perLocale = Object.fromEntries(INSIGHT_LOCALES.map((l) => [l, {}]));
for (const fixture of fixtures) {
  const decider = fixture.type === 'SECOND_LEG' || (fixture.type === 'SINGLE' && /final/i.test(fixture.roundName ?? ''));
  const facts = buildFacts(fixture, played, decider, fixtures, strength); // schedule + strength for form-less matchdays
  for (const locale of INSIGHT_LOCALES) {
    perLocale[locale][fixture.uefaMatchId] = renderInsight(facts, locale);
  }
}

mkdirSync(outDir, { recursive: true });
for (const locale of INSIGHT_LOCALES) {
  writeFileSync(join(outDir, `${locale}.json`), JSON.stringify(perLocale[locale], null, 1) + '\n');
}
const count = Object.keys(perLocale.en).length;
console.log(`insights: ${count} matches × ${INSIGHT_LOCALES.length} locales → ${outDir}`);
if (count === 0) console.warn('warning: zero insights generated (all placeholders? wrong phase?)');
