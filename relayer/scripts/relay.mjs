#!/usr/bin/env node
/**
 * Oracle relayer CLI (slices 05+06) — run by GitHub Actions cron (PRD §8).
 *
 *   ORACLE_PRIVATE_KEY=… PREDICTOR_ADDRESS=0x… [RPC_URL=…]
 *   [TELEGRAM_BOT_TOKEN=… TELEGRAM_OPS_CHAT_ID=…]
 *   [SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=…]
 *   node scripts/relay.mjs --map config/staging-map.json
 *     [--heartbeat]                 send the daily "oracle healthy" DM
 *     [--manual results.json]      degraded-mode fallback: push operator-
 *                                  supplied results instead of the feed
 *                                  (same oracle key, same idempotency rules)
 *
 * Exit 0 on a clean run; exit 1 when any match errored (Actions e-mail is the
 * second alert wire — Telegram is the first).
 */
import { readFileSync } from 'node:fs';
import { UefaApiSource } from '../dist/src/source.js';
import { relayOnce } from '../dist/src/relay.js';
import { viemWriter } from '../dist/src/chain.js';
import { composeAlert, composeHeartbeat, telegramTransport } from '../dist/src/alerts.js';
import { detectIssues } from '../dist/src/watchdog.js';
import { supabaseLogger } from '../dist/src/oracleLog.js';

const args = process.argv.slice(2);
const argVal = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
};
const mapPath = argVal('--map');
if (!mapPath) {
  console.error('usage: relay.mjs --map <map.json> [--heartbeat] [--manual results.json]');
  process.exit(1);
}
const map = JSON.parse(readFileSync(mapPath, 'utf8'));

const {
  ORACLE_PRIVATE_KEY,
  PREDICTOR_ADDRESS,
  RPC_URL,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_OPS_CHAT_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  CHAIN_ID,
} = process.env;
if (!ORACLE_PRIVATE_KEY || !PREDICTOR_ADDRESS) {
  console.error('ORACLE_PRIVATE_KEY and PREDICTOR_ADDRESS are required');
  process.exit(1);
}
const key = ORACLE_PRIVATE_KEY.startsWith('0x') ? ORACLE_PRIVATE_KEY : `0x${ORACLE_PRIVATE_KEY}`;
const chainId = Number(CHAIN_ID ?? 88882);

/** Degraded-mode source: operator-supplied results (PRD §8.3 manual fallback). */
function manualSource(path) {
  const rows = JSON.parse(readFileSync(path, 'utf8')); // [{uefaMatchId, scoreA90, scoreB90, extraTime?, penalties?, advancerTeamId?}]
  const byId = Object.fromEntries(
    rows.map((r) => [
      r.uefaMatchId,
      {
        uefaMatchId: r.uefaMatchId,
        status: 'FINISHED',
        scoreA90: r.scoreA90,
        scoreB90: r.scoreB90,
        totalA: r.scoreA90,
        totalB: r.scoreB90,
        penaltyA: null,
        penaltyB: null,
        aggregateA: null,
        aggregateB: null,
        extraTime: Boolean(r.extraTime),
        penalties: Boolean(r.penalties),
        advancerTeamId: r.advancerTeamId ?? null,
        winnerReason: null,
        aggregateWinnerReason: null,
      },
    ]),
  );
  return {
    id: 'manual-operator-entry',
    fixtures: async () => [],
    livescore: async () => [],
    health: async () => ({ ok: true, sourceId: 'manual', checkedAt: '', latencyMs: 0, issue: null, detail: null }),
    result: async (ref) => byId[ref] ?? null,
  };
}

const manualPath = argVal('--manual');
const source = manualPath ? manualSource(manualPath) : new UefaApiSource();
const writer = viemWriter({
  rpcUrl: RPC_URL ?? 'https://spicy-rpc.chiliz.com',
  contract: PREDICTOR_ADDRESS,
  oracleKey: key,
});
const telegram = telegramTransport(TELEGRAM_BOT_TOKEN, TELEGRAM_OPS_CHAT_ID);
const logger = supabaseLogger({ url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_ROLE_KEY });

const summary = await relayOnce(source, writer, map);
console.log(
  `relay: source=${source.id} pushed=[${summary.pushed}] corrected=[${summary.corrected}] skipped=${summary.skipped.length} errors=${summary.errors.length}`,
);
for (const e of summary.errors) console.error(`  match ${e.matchId}: ${e.error}`);

// breakage detection — schema drift, staleness, per-match errors (PRD §8.3)
const alerts = await detectIssues({
  source,
  map,
  chainStates: summary.states,
  summary,
  nowSeconds: Math.floor(Date.now() / 1000),
});
for (const alert of alerts) {
  await telegram.send(composeAlert(alert));
}

// read-model: one 'run' row + one row per push/correction/alert
const rows = [
  {
    kind: 'run',
    chain_id: chainId,
    detail: {
      source: source.id,
      pushed: summary.pushed,
      corrected: summary.corrected,
      skipped: summary.skipped.length,
      errors: summary.errors,
      alerts: alerts.map((a) => a.kind),
    },
  },
  ...summary.pushed.map((id) => ({ kind: 'result_push', chain_id: chainId, match_id: id })),
  ...summary.corrected.map((id) => ({ kind: 'correction', chain_id: chainId, match_id: id })),
  ...alerts.map((a) => ({ kind: 'alert', chain_id: chainId, detail: { kind: a.kind, summary: a.summary } })),
];
await logger.insert(rows);

if (args.includes('--heartbeat')) {
  const beat = composeHeartbeat({
    pushed: summary.pushed,
    corrected: summary.corrected,
    skippedCount: summary.skipped.length,
    errorCount: summary.errors.length,
    trackedMatches: map.length,
    sourceId: source.id,
  });
  await telegram.send(beat);
  await logger.insert([{ kind: 'heartbeat', chain_id: chainId, detail: { trackedMatches: map.length } }]);
}

process.exit(summary.errors.length > 0 ? 1 : 0);
