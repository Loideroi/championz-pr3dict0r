#!/usr/bin/env node
/**
 * Verify the proxy's on-chain matches against a generated matches.json
 * (PRD §7.4, the "bundled + on-chain" half; verify-fixtures.mjs is the
 * feed half). Read-only. Non-zero exit on any discrepancy.
 *
 * Run `npm run build` first (imports the compiled src).
 *
 *   RPC_URL=https://rpc.ankr.com/chiliz PREDICTOR_ADDRESS=0x… \
 *   node scripts/verify-onchain.mjs --matches matches.json [--phase 0] [--id-offset 0]
 *
 * Also prints the stage windows next to the first league kickoff — the D1
 * hard close must equal the first MD1 kickoff (setStageWindow otherwise).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPublicClient, hexToString, http } from 'viem';
import { diffOnchain, formatOnchainReport, selectMatches } from '../dist/src/index.js';

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? null : argv[i + 1];
};
const matchesPath = arg('--matches');
if (!matchesPath) {
  console.error('usage: verify-onchain.mjs --matches <matches.json> [--phase N] [--id-offset N]');
  process.exit(2);
}
const phaseArg = arg('--phase');
const phase = phaseArg === null ? null : Number(phaseArg);
const idOffset = Number(arg('--id-offset') ?? 0);

const { RPC_URL, PREDICTOR_ADDRESS } = process.env;
if (!RPC_URL || !PREDICTOR_ADDRESS) {
  console.error('RPC_URL and PREDICTOR_ADDRESS are required');
  process.exit(2);
}

const ABI = [
  { type: 'function', name: 'matchCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  {
    type: 'function',
    name: 'matches',
    stateMutability: 'view',
    inputs: [{ type: 'uint16' }],
    outputs: [{ type: 'uint40' }, { type: 'uint8' }, { type: 'bytes3' }, { type: 'bytes3' }, { type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'stages',
    stateMutability: 'view',
    inputs: [{ type: 'uint256' }],
    outputs: [{ type: 'uint40' }, { type: 'uint40' }, { type: 'uint8' }, { type: 'uint32' }, { type: 'uint256' }, { type: 'uint256' }],
  },
];

const client = createPublicClient({ transport: http(RPC_URL) });
const read = (functionName, args = []) =>
  client.readContract({ address: PREDICTOR_ADDRESS, abi: ABI, functionName, args });

const doc = JSON.parse(readFileSync(resolve(matchesPath), 'utf8'));
const matchCount = Number(await read('matchCount'));
console.log(`proxy ${PREDICTOR_ADDRESS}: matchCount=${matchCount}`);

// read every on-chain row (small concurrency — Spicy has no multicall3)
const rows = [];
const BATCH = 12;
for (let start = 1; start <= matchCount; start += BATCH) {
  const ids = Array.from({ length: Math.min(BATCH, matchCount - start + 1) }, (_, i) => start + i);
  const got = await Promise.all(ids.map((id) => read('matches', [id])));
  got.forEach((g, i) => {
    rows.push({
      matchId: ids[i],
      kickoff: Number(g[0]),
      status: Number(g[1]),
      teamA: hexToString(g[2], { size: 3 }),
      teamB: hexToString(g[3], { size: 3 }),
      stage: Number(g[4]),
    });
  });
}

const report = diffOnchain(doc, rows, { phase, idOffset });
console.log(formatOnchainReport(report, `${PREDICTOR_ADDRESS} vs ${matchesPath} (phase ${phase ?? 'all'}, offset ${idOffset})`));

// D1: league sales must hard-close at the FIRST MD1 kickoff
const league = selectMatches(doc, 0).filter((m) => m.kickoffTime !== null);
if (league.length > 0) {
  const first = Math.min(...league.map((m) => m.kickoffTime));
  const [openAt, closeAt] = await read('stages', [0n]);
  const [koOpenAt, koCloseAt] = await read('stages', [1n]);
  const iso = (s) => new Date(Number(s) * 1000).toISOString();
  console.log(`\n# Stage windows: league ${iso(openAt)} → ${iso(closeAt)} · knockout ${iso(koOpenAt)} → ${iso(koCloseAt)}`);
  console.log(`# First league kickoff in matches.json: ${iso(first)}`);
  if (Number(closeAt) !== first) {
    console.log(
      `# WARNING: league closeAt ≠ first MD1 kickoff (Δ ${Math.round((first - Number(closeAt)) / 60)} min) — D1 says hard close AT first kickoff:`,
    );
    console.log(`#   LEAGUE_CLOSE=${first} KO_OPEN=${first} npx hardhat run scripts/set-stage-windows.ts --network <chiliz|spicy>`);
  } else {
    console.log('# OK — league sales close exactly at the first MD1 kickoff (D1)');
  }
}

process.exit(report.discrepancies.length > 0 ? 1 : 0);
