# 05 — Oracle relayer end-to-end

Status: ready-for-agent
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
