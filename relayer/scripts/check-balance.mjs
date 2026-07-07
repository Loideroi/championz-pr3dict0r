#!/usr/bin/env node
/**
 * Oracle gas-balance watch — warns the admin on Telegram when the oracle key
 * drops below the CHZ floor (an empty key fails SILENTLY: pushes just stop).
 *
 *   RPC_URL=… CHAIN_ID=… ORACLE_ADDRESS=0x… node scripts/check-balance.mjs
 *
 * Optional env: ORACLE_MIN_CHZ (floor, default 20), OWNER_ADDRESS (shown in
 * the alert as the top-up source), TELEGRAM_BOT_TOKEN, TELEGRAM_OPS_CHAT_ID,
 * SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (24h alert dedupe).
 *
 * Runs on every oracle-bot cron tick; the Supabase dedupe keeps it to at most
 * one warning per chain per 24h. Exits 0 either way — a low balance is an
 * alert, not a CI failure (the failure e-mail wire stays for real breakage).
 */
import { createPublicClient, http } from 'viem';
import {
  composeLowBalanceAlert,
  DEFAULT_MIN_BALANCE_CHZ,
  readBalance,
} from '../dist/src/balance.js';
import { telegramTransport } from '../dist/src/alerts.js';
import { supabaseLogger } from '../dist/src/oracleLog.js';

const {
  RPC_URL,
  CHAIN_ID,
  ORACLE_ADDRESS,
  ORACLE_MIN_CHZ,
  OWNER_ADDRESS,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_OPS_CHAT_ID,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!RPC_URL || !CHAIN_ID || !ORACLE_ADDRESS) {
  console.error('usage: RPC_URL=… CHAIN_ID=… ORACLE_ADDRESS=0x… node scripts/check-balance.mjs');
  process.exit(2);
}

const chainId = Number(CHAIN_ID);
const threshold = Number(ORACLE_MIN_CHZ ?? DEFAULT_MIN_BALANCE_CHZ);

const client = createPublicClient({ transport: http(RPC_URL) });
const wei = await client.getBalance({ address: ORACLE_ADDRESS });
const reading = readBalance(wei, threshold);
console.log(
  `oracle ${ORACLE_ADDRESS} on chain ${chainId}: ${reading.balanceChz} CHZ (floor ${threshold})${reading.low ? ' — LOW' : ''}`,
);

if (reading.low) {
  const logger = supabaseLogger({ url: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_ROLE_KEY });
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const alreadyWarned = await logger.hasRecentAlert('low_balance', chainId, dayAgo);
  if (alreadyWarned) {
    console.log('low-balance warning already sent in the last 24h — skipping');
  } else {
    const telegram = telegramTransport(TELEGRAM_BOT_TOKEN, TELEGRAM_OPS_CHAT_ID);
    await telegram.send(
      composeLowBalanceAlert({
        reading,
        chainId,
        oracleAddress: ORACLE_ADDRESS,
        ownerAddress: OWNER_ADDRESS,
      }),
    );
    await logger.insert([
      {
        kind: 'alert',
        chain_id: chainId,
        detail: { type: 'low_balance', balanceChz: reading.balanceChz, thresholdChz: threshold },
      },
    ]);
  }
}

process.exit(0);
