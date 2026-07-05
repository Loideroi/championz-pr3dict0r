#!/usr/bin/env node
/**
 * Staging bot poller (slice 10) — until the app is deployed with a public
 * webhook (issue 16), this long-polls getUpdates and forwards each update to
 * the app's webhook route (default: local dev server). Run alongside
 * `npm run dev`:
 *
 *   TELEGRAM_BOT_TOKEN=… node scripts/bot-poll.mjs [--target http://localhost:3000]
 *
 * NOTE: do not run while a production webhook is registered — Telegram
 * delivers each update to exactly one of the two mechanisms.
 */
const args = process.argv.slice(2);
const targetIdx = args.indexOf('--target');
const target = targetIdx !== -1 ? args[targetIdx + 1] : 'http://localhost:3000';
const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

let offset = 0;
console.log(`bot-poll: forwarding updates → ${target}/api/telegram/webhook (ctrl-c to stop)`);
for (;;) {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/getUpdates?timeout=50&offset=${offset}`,
      { signal: AbortSignal.timeout(60_000) },
    );
    const json = await res.json();
    for (const update of json.result ?? []) {
      offset = update.update_id + 1;
      const fwd = await fetch(`${target}/api/telegram/webhook`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(process.env.TELEGRAM_WEBHOOK_SECRET
            ? { 'x-telegram-bot-api-secret-token': process.env.TELEGRAM_WEBHOOK_SECRET }
            : {}),
        },
        body: JSON.stringify(update),
      });
      console.log(`update ${update.update_id} → HTTP ${fwd.status}`);
    }
  } catch (err) {
    console.error(`poll error (retrying in 5s): ${err.message ?? err}`);
    await new Promise((r) => setTimeout(r, 5_000));
  }
}
