# 06 — Breakage detection & ops alerting

Status: ready-for-human
PRD: ../../PRD.md §8.3

## What to build

The assumption is that the unofficial UEFA API breaks at the worst possible moment;
this slice makes that loud instead of silent. Schema drift raises a
SOURCE_SCHEMA_CHANGED alert; a match that should have finished more than two hours ago
with no result, or an empty fixtures response on a known matchday, raises SOURCE_STALE.
Alerts go to the admin as a Telegram DM and to a private ops channel, with the failing
endpoint, a payload sample and a runbook link; GitHub Actions failure e-mail is the
second wire. A daily "oracle healthy" heartbeat DM makes silence itself detectable.
On source failure the app shows a degraded-mode banner ("results delayed — leaderboard
will catch up") and the admin console's manual result entry keeps working as the
emergency fallback. Relayer activity persists to an oracle log table so the console
and heartbeat read from history, not memory.

## Acceptance criteria

- [ ] A deliberately corrupted feed response produces a Telegram admin DM within one poll cycle
- [ ] A simulated silent feed (finished match, no result, 2h+) produces a SOURCE_STALE alert
- [ ] Heartbeat DM arrives daily with matches-tracked and next-window summary
- [ ] Degraded-mode banner appears while the source health check fails and clears on recovery
- [ ] Manual result entry from the admin console still settles a match while the feed is down
- [ ] All relayer runs, alerts and pushes are queryable from the oracle log table

## Blocked by

- 05-oracle-relayer.md

## Comments

**2026-07-04 — built and PROVEN LIVE.**
- **Alerting stack** (relayer): `alerts.ts` (Telegram transport, HTML-escaped composer
  with runbook link; missing env degrades to console — Actions e-mail stays wire #2),
  `watchdog.ts` (SOURCE_SCHEMA_CHANGED from source.health() drift ·
  SOURCE_STALE when a match kicked off >2h ago with no result on chain OR feed ·
  RELAY_ERRORS from the run summary), `oracleLog.ts` (clp_oracle_log writer —
  run/result_push/correction/alert/heartbeat rows; logging failures never break
  relaying). 61 relayer tests.
- **Live proof executed:** a real `--heartbeat` run against Spicy + the live UEFA feed
  sent the "✅ oracle healthy — 4 matches tracked" DM to the admin chat (2055709055,
  captured from the bot's /start) and wrote real `run` + `heartbeat` rows to
  clp_oracle_log (verified by reading them back). Owner's chat id discovered via
  getUpdates exactly as designed.
- **Workflow**: daily 07:07 UTC heartbeat schedule added; secrets TELEGRAM_BOT_TOKEN +
  SUPABASE_SERVICE_ROLE_KEY and variables TELEGRAM_OPS_CHAT_ID + SUPABASE_URL set on
  the repo (piped, never displayed). **Degraded-mode manual fallback**: the
  workflow_dispatch `manual_results` input feeds `relay.mjs --manual` — operator
  results ride the exact same oracle path with the same idempotency rules (no
  owner-key ceremony; the slice-12 console gets a UI over this).
- **App**: `HealthBanner` reads the latest run row (anon, public SELECT) and banners
  "results delayed — leaderboard will catch up" when the last run (<6h old) carried
  alerts/errors; renders nothing without env or rows.
- **Remaining (human):** watch the 07:07 UTC heartbeat arrive tomorrow; the corrupted-
  feed alert fires from the same detectIssues path proven by tests + the live wire.
