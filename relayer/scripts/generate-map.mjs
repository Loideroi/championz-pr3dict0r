#!/usr/bin/env node
/**
 * Relayer map from a generated matches.json (PRD §8.1): on-chain matchId ↔
 * uefaMatchId + home/away UEFA team ids (the advancer bit resolves against
 * them) + a display label for channel posts. Never hand-authored.
 *
 * Run `npm run build` first (imports the compiled src).
 *
 *   node scripts/generate-map.mjs --matches matches.json --out config/mainnet-map.json [--phase 0] [--id-offset 0]
 *
 * --phase      only that phase (0 = league); default all phases
 * --id-offset  matchCount the proxy held BEFORE the push (staging rehearsals)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { mapFromMatches } from '../dist/src/index.js';

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
const matchesPath = arg('--matches');
const outPath = arg('--out');
if (!matchesPath || !outPath) {
  console.error('usage: generate-map.mjs --matches <matches.json> --out <map.json> [--phase N] [--id-offset N]');
  process.exit(2);
}
const phaseArg = arg('--phase');
const phase = phaseArg === null ? null : Number(phaseArg);
const idOffset = Number(arg('--id-offset') ?? 0);

const doc = JSON.parse(readFileSync(resolve(matchesPath), 'utf8'));
const map = mapFromMatches(doc, { phase, idOffset });
mkdirSync(dirname(resolve(outPath)), { recursive: true });
writeFileSync(resolve(outPath), JSON.stringify(map, null, 2) + '\n');
console.log(
  `wrote ${outPath}: ${map.length} entries (phase ${phase ?? 'all'}, on-chain ids ${map[0]?.matchId ?? '-'}..${map.at(-1)?.matchId ?? '-'})`,
);
