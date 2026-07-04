# 05 — Oracle relayer end-to-end

Status: ready-for-human
PRD: ../../PRD.md §8.1 · Decisions: D6, D9

## What to build

The automation that removes the admin from match days. A relayer script driven by
GitHub Actions cron (every 5 minutes inside matchday windows, hourly otherwise;
concurrency-grouped so runs never overlap; cron-job.org documented as the backup
trigger since Vercel Hobby crons are daily-only) that reads the source adapter,
detects finished matches, and pushes the 90-minute score plus ET/pens/advancer flags
on-chain with a dedicated low-value `RESULT_ORACLE_ROLE` key. Results land PROVISIONAL
and auto-finalize after 24 hours; the relayer self-corrects a provisional result if
UEFA amends the feed. Mirror-UEFA policy (D6): whatever the feed records is pushed,
forfeits included — no filtering logic. Idempotency guard before every submission
(check on-chain result status first). Kickoff-time changes in the feed flow through a
batch kickoff update. Demoed by replaying an archived matchday against the Spicy
contract with zero human actions.

## Acceptance criteria

- [ ] A replayed archive matchday settles end-to-end hands-off: results pushed, provisional badge shown, auto-finalized after the window, leaderboard cache updated
- [ ] Re-running the relayer against already-pushed results submits nothing (idempotent)
- [ ] An AET archive match lands with the 90′ score on-chain and correct flags
- [ ] A feed amendment inside the window produces an automatic correction with old + new evented
- [ ] The oracle key holds only gas and cannot call owner functions; owner can rotate it
- [ ] A rescheduled kickoff in the feed updates the on-chain kickoff without admin action
- [ ] Workflow uses concurrency grouping; secrets only via GitHub Actions secrets

## Blocked by

- 02-walking-skeleton-spicy.md
- 04-uefa-source-adapter-fixtures.md

## Comments

**2026-07-04 — built; live self-demo scheduled by the calendar itself.**
- **Contract v2 via a REAL UUPS upgrade on Spicy** (validate-then-upgrade, layout
  checked): impl `0x295d…7873 → 0x9b9fA164E4De29B8002626eDD32255ae258b561A` on proxy
  `0xAE32…83D6`. New: `pushResult(matchId, packed)` (90′ scores + ET/pens/advancer
  flags) landing PROVISIONAL with a 24h window packed into the result word (bits
  24–63 — v1-layout compatible); `correctResult` (oracle, in-window only, re-arms the
  window); time-based finalization (no finalize tx); `batchUpdateKickoffs`;
  `setProvisionalWindow`. 18/18 contract tests incl. the full provisional lifecycle
  (D9: points count immediately; correction re-scores with zero unwind).
- **Dedicated oracle key (D5):** `0xB57Cb421E3B707d0970Ec758D40a4366DB317B15` —
  generated, funded 100 CHZ (gas only), rotated on-chain via `setOracle`, private key
  piped straight into the `ORACLE_PRIVATE_KEY` GitHub Actions secret and the local
  file deleted; never displayed anywhere.
- **Relayer:** `relayer/src/relay.ts` (chain-agnostic orchestration) +
  `chain.ts` (viem writer, 2,510 gwei) + `scripts/relay.mjs` CLI + 53 relayer tests.
  Replayed-matchday test proves: push-all-finished, idempotent re-run, in-window
  correction on feed amendment, never-touch-finalized, mirror-UEFA forfeit relay (D6),
  one poisoned match can't break the run.
- **Live dry-run against Spicy caught a real bug:** relayer tried pushing before
  kickoff (would revert `MatchNotStarted` + false-alarm every 5 min) — fixed with
  kickoff-aware skips; re-run: `pushed=[] corrected=[] skipped=4 errors=0` ✓. The
  packed value in the attempted push decoded to exactly the archived Juve–Gala AET
  result (3-0 90′, ET flag, away advancer) — end-to-end packing proven against real data.
- **GitHub Actions cron live** (`oracle-bot.yml`): every 5 min 16–23h UTC, hourly
  otherwise, concurrency-grouped. Staging map wires the 4 Spicy matches to archived
  AET/pens classics — **on 7–8 Jul the cron will settle them hands-off on its own**;
  that IS the "zero human actions" demo, in real time.
- Remaining (human/later): watch the 7–8 Jul self-settlement (or `workflow_dispatch`
  after kickoff passes); Telegram alerting + staleness watchdog is slice 06 as planned.
