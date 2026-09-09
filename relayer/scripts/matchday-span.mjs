#!/usr/bin/env node
/**
 * Prints the epoch second at which today's matchday watch may stop, or 0 when
 * there is nothing to watch right now.
 *
 *   node scripts/matchday-span.mjs ../lib/fixtures/matches.json
 *
 * Consumed by .github/workflows/matchday-watch.yml to decide whether to hold
 * a runner at all.
 */
import { readFileSync } from 'node:fs';
import { coverageEnd } from '../dist/src/matchday.js';

const path = process.argv[2];
if (!path) {
  console.error('usage: matchday-span.mjs <matches.json>');
  process.exit(1);
}
const doc = JSON.parse(readFileSync(path, 'utf8'));
const kickoffs = (doc.matches ?? [])
  .map((m) => Number(m.kickoffTime))
  .filter((n) => Number.isFinite(n) && n > 0);
console.log(coverageEnd(kickoffs, Math.floor(Date.now() / 1000)));
