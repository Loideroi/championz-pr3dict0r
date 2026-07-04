#!/usr/bin/env node
/**
 * Oracle relayer CLI (slice 05) — run by GitHub Actions cron (PRD §8.1).
 *
 *   ORACLE_PRIVATE_KEY=…  PREDICTOR_ADDRESS=0x…  [RPC_URL=…]
 *   node scripts/relay.mjs --map config/staging-map.json
 *
 * Reads the match map (on-chain id ↔ uefaMatchId ↔ team ids), pulls results
 * from the UEFA source, and pushes/corrects on-chain idempotently. Exits 0
 * with a summary line; exits 1 if any match errored (Actions e-mail fires —
 * the Telegram alerting layer lands in slice 06).
 */
import { readFileSync } from 'node:fs';
import { UefaApiSource } from '../dist/src/source.js';
import { relayOnce } from '../dist/src/relay.js';
import { viemWriter } from '../dist/src/chain.js';

const args = process.argv.slice(2);
const mapIdx = args.indexOf('--map');
if (mapIdx === -1 || !args[mapIdx + 1]) {
  console.error('usage: relay.mjs --map <map.json>');
  process.exit(1);
}
const map = JSON.parse(readFileSync(args[mapIdx + 1], 'utf8'));

const { ORACLE_PRIVATE_KEY, PREDICTOR_ADDRESS, RPC_URL } = process.env;
if (!ORACLE_PRIVATE_KEY || !PREDICTOR_ADDRESS) {
  console.error('ORACLE_PRIVATE_KEY and PREDICTOR_ADDRESS are required');
  process.exit(1);
}
const key = ORACLE_PRIVATE_KEY.startsWith('0x') ? ORACLE_PRIVATE_KEY : `0x${ORACLE_PRIVATE_KEY}`;

const source = new UefaApiSource();
const writer = viemWriter({
  rpcUrl: RPC_URL ?? 'https://spicy-rpc.chiliz.com',
  contract: PREDICTOR_ADDRESS,
  oracleKey: key,
});

const summary = await relayOnce(source, writer, map);
console.log(
  `relay: pushed=[${summary.pushed}] corrected=[${summary.corrected}] skipped=${summary.skipped.length} errors=${summary.errors.length}`,
);
for (const e of summary.errors) console.error(`  match ${e.matchId}: ${e.error}`);
process.exit(summary.errors.length > 0 ? 1 : 0);
