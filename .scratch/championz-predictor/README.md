# ₵h@mpi0nz Pr3dict0r — issue tracker

> **STATUS: all 16 slices BUILT + merged (PRs #1–#18); contract live on Chiliz
> mainnet.** Every issue below is `ready-for-human` (built, awaiting human sign-off)
> except 01 (`done`). Remaining work is the owner-gated launch cutover — see the
> repo-root [`STATUS.md`](../../STATUS.md) and [`LAUNCH_CHECKLIST.md`](../../LAUNCH_CHECKLIST.md).
> `ready-for-human` here means "implemented + tested + merged; needs a human
> action to fully close" (e.g. a Socios-wallet test, applying a migration, or a
> launch step), NOT "unstarted".


PRD: [`../../PRD.md`](../../PRD.md) (master, v1.1.0, grilled 2026-07-04 — decision log in §21).
Conventions: local-markdown tracker; triage state is the `Status:` line in each file
(`needs-triage` / `needs-info` / `ready-for-agent` / `ready-for-human` / `wontfix`);
comments append under `## Comments`.

## Dependency graph

```
01 bootstrap
├── 02 walking skeleton ── 03 two-stage economics ─┬── 08 prediction UX ── 13 design pass ── 14 i18n+T&Cs ── 15 insights
│                                                  ├── 09 profiles/supabase ──┐
└── 04 uefa adapter ──┬── 05 relayer ─┬── 06 breakage alerts ── 12 admin console
                      │               ├── 07 scoring+leaderboards ── 11 freeze/claims/trophy
                      │               └── 10 telegram bot (also ← 09)
                      └── 15 insights (also ← 14)

16 security + launch cutover ← 03, 07, 11, 12 (and everything transitively)
```

## Slices

| # | File | Blocked by |
|---|---|---|
| 01 | 01-repo-bootstrap-ways-of-working.md | — |
| 02 | 02-walking-skeleton-spicy.md | 01 |
| 03 | 03-two-stage-economics.md | 02 |
| 04 | 04-uefa-source-adapter-fixtures.md | 01 |
| 05 | 05-oracle-relayer.md | 02, 04 |
| 06 | 06-breakage-detection-ops-alerts.md | 05 |
| 07 | 07-scoring-engine-leaderboards.md | 03, 05 |
| 08 | 08-prediction-ux.md | 03 |
| 09 | 09-signup-profiles-supabase.md | 03 |
| 10 | 10-telegram-community-bot.md | 05, 09 |
| 11 | 11-freeze-claims-trophy.md | 07 |
| 12 | 12-corrections-admin-console.md | 05, 06 |
| 13 | 13-bigmac-bobby-design-pass.md | 08 |
| 14 | 14-i18n-six-locales-terms.md | 08, 13 |
| 15 | 15-match-insights-pipeline.md | 04, 14 |
| 16 | 16-security-launch-cutover.md | 03, 07, 11, 12 |

Parallel tracks after 01: **contract track** (02→03→…) and **data track** (04→05→…)
can run simultaneously. The August-crunch content slices (14–15) are the schedule risk
(PRD milestone 4).
