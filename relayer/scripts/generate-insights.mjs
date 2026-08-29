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
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { UefaApiSource } from '../dist/src/source.js';
import { toFixture, toMatchResult } from '../dist/src/source.js';
import { buildFacts, INSIGHT_LOCALES, renderInsight } from '../dist/src/insights.js';

const args = process.argv.slice(2);
const argVal = (f) => {
  const i = args.indexOf(f);
  return i !== -1 ? args[i + 1] : undefined;
};
const outDir = argVal('--out');
if (!outDir) {
  console.error('usage: generate-insights.mjs (--season YYYY | --fixtures file.json) --out dir');
  process.exit(1);
}

let raw;
if (argVal('--fixtures')) {
  raw = JSON.parse(readFileSync(argVal('--fixtures'), 'utf8'));
} else {
  const source = new UefaApiSource();
  raw = await source.rawSeason(argVal('--season') ?? '2027');
}

// tournament proper only; skip placeholder fixtures (draw not held yet)
const matches = raw.filter((m) => (m.competitionPhase ?? 'TOURNAMENT') === 'TOURNAMENT');
const fixtures = matches.map(toFixture).filter((f) => !f.home.isPlaceHolder && !f.away.isPlaceHolder);
const played = matches
  .map((m) => ({ fixture: toFixture(m), result: toMatchResult(m) }))
  .filter((x) => x.result !== null && x.fixture.status === 'FINISHED');

const perLocale = Object.fromEntries(INSIGHT_LOCALES.map((l) => [l, {}]));
for (const fixture of fixtures) {
  const decider = fixture.type === 'SECOND_LEG' || (fixture.type === 'SINGLE' && /final/i.test(fixture.roundName ?? ''));
  const facts = buildFacts(fixture, played, decider, fixtures); // schedule context for form-less matchdays
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
