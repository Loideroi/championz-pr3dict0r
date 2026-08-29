#!/usr/bin/env node
/**
 * Ops sentinel — governance drift, solvency, seasonal deadlines, site uptime.
 *
 *   RPC_URL=… CHAIN_ID=… PREDICTOR_ADDRESS=0x… \
 *   EXPECTED_OWNER=0x… EXPECTED_ORACLE=0x… EXPECTED_IMPL=0x… \
 *   node scripts/sentinel.mjs [--uptime] [--deep]
 *
 * --uptime  also probe pr3dict0r.com + the profile API (run on one chain only)
 * --deep    also iterate matches for the unfrozen-stage check (daily tick)
 *
 * Every issue dedupes via clp_oracle_log to ≤1 Telegram warning per type per
 * chain per 24h. Exits 0 — sentinels alert, they don't fail CI.
 */
import { createPublicClient, http } from 'viem';
import {
  checkDeadlines,
  checkGovernance,
  checkSolvency,
  checkUnfrozenStage,
  checkUptime,
  composeSentinelAlert,
} from '../dist/src/sentinels.js';
import { telegramTransport } from '../dist/src/alerts.js';
import { CHILIZ_MULTICALL3, withRetry } from '../dist/src/chain.js';
import { supabaseLogger } from '../dist/src/oracleLog.js';

const {
  RPC_URL,
  CHAIN_ID,
  PREDICTOR_ADDRESS,
  EXPECTED_OWNER,
  EXPECTED_ORACLE,
  EXPECTED_IMPL,
  STAGE_FLOOR,
  SITE_URL,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_OPS_CHAT_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!RPC_URL || !CHAIN_ID || !PREDICTOR_ADDRESS || !EXPECTED_OWNER || !EXPECTED_ORACLE || !EXPECTED_IMPL) {
  console.error('sentinel.mjs: RPC_URL, CHAIN_ID, PREDICTOR_ADDRESS and EXPECTED_{OWNER,ORACLE,IMPL} are required');
  process.exit(2);
}

const args = process.argv.slice(2);
const chainId = Number(CHAIN_ID);
const floor = Number(STAGE_FLOOR ?? 20);
const siteUrl = SITE_URL ?? 'https://pr3dict0r.com';

const ABI = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'oracle', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'paused', stateMutability: 'view', inputs: [], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'matchCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint16' }] },
  {
    type: 'function', name: 'stages', stateMutability: 'view', inputs: [{ type: 'uint256' }],
    outputs: [
      { type: 'uint40' }, { type: 'uint40' }, { type: 'uint8' },
      { type: 'uint32' }, { type: 'uint256' }, { type: 'uint256' },
    ],
  },
  { type: 'function', name: 'stageFrozen', stateMutability: 'view', inputs: [{ type: 'uint8' }], outputs: [{ type: 'bool' }] },
  {
    type: 'function', name: 'matches', stateMutability: 'view', inputs: [{ type: 'uint16' }],
    outputs: [
      { type: 'uint40' }, { type: 'uint8' }, { type: 'bytes3' }, { type: 'bytes3' }, { type: 'uint8' },
    ],
  },
  { type: 'function', name: 'resultOf', stateMutability: 'view', inputs: [{ type: 'uint16' }],
    outputs: [
      { type: 'uint8' }, { type: 'uint8' }, { type: 'bool' }, { type: 'bool' },
      { type: 'uint8' }, { type: 'bool' }, { type: 'bool' },
    ],
  },
];

// EIP-1967 implementation slot
const IMPL_SLOT = '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc';

const client = createPublicClient({ transport: http(RPC_URL) });
const read = (functionName, cArgs = []) =>
  withRetry(() => client.readContract({ address: PREDICTOR_ADDRESS, abi: ABI, functionName, args: cArgs }));
/** (matches, resultOf) for many ids — one multicall per 48 matches on mainnet, sequential elsewhere. */
async function readGames(ids) {
  const rows = [];
  if (chainId !== 88888) {
    for (const id of ids) rows.push(await Promise.all([read('matches', [id]), read('resultOf', [id])]));
    return rows;
  }
  for (let i = 0; i < ids.length; i += 48) {
    const slice = ids.slice(i, i + 48);
    const contracts = slice.flatMap((id) => [
      { address: PREDICTOR_ADDRESS, abi: ABI, functionName: 'matches', args: [id] },
      { address: PREDICTOR_ADDRESS, abi: ABI, functionName: 'resultOf', args: [id] },
    ]);
    const res = await withRetry(() => client.multicall({ contracts, multicallAddress: CHILIZ_MULTICALL3, allowFailure: false }));
    slice.forEach((_, k) => rows.push([res[2 * k], res[2 * k + 1]]));
  }
  return rows;
}

const issues = [];

// 1. Governance ------------------------------------------------------------
const [owner, oracle, paused, implRaw] = await Promise.all([
  read('owner'),
  read('oracle'),
  read('paused'),
  client.getStorageAt({ address: PREDICTOR_ADDRESS, slot: IMPL_SLOT }),
]);
const implementation = `0x${(implRaw ?? '0x').slice(-40)}`;
issues.push(
  ...checkGovernance(
    { owner, oracle, implementation, paused },
    { owner: EXPECTED_OWNER, oracle: EXPECTED_ORACLE, implementation: EXPECTED_IMPL },
  ),
);

// 2. Solvency ---------------------------------------------------------------
const [balance, stage0, stage1, frozen0, frozen1] = await Promise.all([
  client.getBalance({ address: PREDICTOR_ADDRESS }),
  read('stages', [0n]),
  read('stages', [1n]),
  read('stageFrozen', [0]),
  read('stageFrozen', [1]),
]);
const stageFunds = [
  { pool: stage0[4], feeEscrow: stage0[5], frozen: frozen0 },
  { pool: stage1[4], feeEscrow: stage1[5], frozen: frozen1 },
];
const solvency = checkSolvency(balance, stageFunds);
if (solvency) issues.push(solvency);

// 3. Seasonal deadlines ------------------------------------------------------
const matchCount = Number(await read('matchCount'));
issues.push(
  ...checkDeadlines({
    nowSec: Math.floor(Date.now() / 1000),
    leagueCloseAt: Number(stage0[1]),
    leagueEntrants: Number(stage0[3]),
    stageFloor: floor,
    matchCount,
  }),
);

// 3b. Unfrozen fully-played stage (--deep: iterates matches; daily tick only)
if (args.includes('--deep') && matchCount > 0 && matchCount <= 250) {
  const perStage = [
    { label: 'league', frozen: frozen0, totalMatches: 0, completedMatches: 0 },
    { label: 'knockout', frozen: frozen1, totalMatches: 0, completedMatches: 0 },
  ];
  const games = await readGames(Array.from({ length: matchCount }, (_, i) => i + 1));
  for (const [game, result] of games) {
    const s = perStage[Number(game[4])] ?? perStage[0];
    s.totalMatches += 1;
    if (result[5]) s.completedMatches += 1; // completed flag
  }
  issues.push(...checkUnfrozenStage(perStage));
}

// 4. Uptime (--uptime: one chain only, so the alert isn't doubled) -----------
if (args.includes('--uptime')) {
  const probe = async (label, url, validate) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: 'follow' });
        const body = await res.text();
        if (validate(res.status, body)) return { label, url, ok: true };
        if (attempt === 1) return { label, url, ok: false, status: res.status };
      } catch (err) {
        if (attempt === 1) return { label, url, ok: false, error: String(err?.message ?? err) };
      }
      await new Promise((r) => setTimeout(r, 3000)); // one retry — skip blips
    }
    return { label, url, ok: false, error: 'unreachable' };
  };
  const results = await Promise.all([
    probe('homepage', siteUrl, (status, body) => status === 200 && body.includes('Pr3dict0r')),
    // 404-with-JSON is the healthy "no profile" answer; 5xx = API/Supabase down.
    probe(
      'profile-api',
      `${siteUrl}/api/profile?address=0x0000000000000000000000000000000000000001&chainId=${chainId}`,
      (status) => status < 500,
    ),
  ]);
  issues.push(...checkUptime(results));
}

// Deliver (24h dedupe per type per chain) ------------------------------------
console.log(`sentinel chain ${chainId}: ${issues.length} issue(s)${issues.length ? ' — ' + issues.map((i) => i.type).join(', ') : ''}`);
if (issues.length > 0) {
  const telegram = telegramTransport(TELEGRAM_BOT_TOKEN, TELEGRAM_OPS_CHAT_ID);
  const logger = supabaseLogger({ url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_ROLE_KEY });
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  for (const issue of issues) {
    if (await logger.hasRecentAlert(issue.type, chainId, dayAgo)) {
      console.log(`  ${issue.type}: already warned in the last 24h — skipping`);
      continue;
    }
    await telegram.send(composeSentinelAlert(issue, chainId));
    await logger.insert([{ kind: 'alert', chain_id: chainId, detail: { type: issue.type, headline: issue.headline } }]);
  }
}

process.exit(0);
