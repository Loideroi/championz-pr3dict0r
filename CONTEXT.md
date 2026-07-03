# Domain glossary — ₵h@mpi0nz Pr3dict0r

Use this vocabulary in code, issues, tests and docs. Source of truth: PRD.md.

- **Stage 1 / League Phase** — the 36-team single-table phase, 144 matches, MD1–MD8
  (Sep 2026 – 27 Jan 2027). Full Season wallets only.
- **Stage 2 / Knockout** — play-offs, R16, QF, SF, final: 45 matches (Feb – 5 Jun 2027).
  Everyone; all points start at 0.
- **Full Season pass** — 1,100 CHZ entry (500 → League Pool, 500 → Knockout Pool,
  100 → fee); on sale until the first MD1 kickoff, hard close (D1).
- **Knockout pass** — 550 CHZ entry (500 → Knockout Pool, 50 → fee); on sale from MD1
  kickoff to T-60 of the last play-off first-leg (D4). "The shop is never closed."
- **League Pool / Knockout Pool** — per-stage prize pools; no points or funds cross a
  pool boundary. Paid to the stage's top-20 (25/15/10/30÷7/20÷10, dust to first).
- **Stage floor** — fewer than 20 entrants at stage lock → stage void, full refund
  including fee (D2).
- **90-minute rule** — all scoreline points use `score.regular` (the 90′ score), never
  the after-extra-time total (PRD §5.1).
- **Tie / decider** — knockout rounds before the final are two-legged; the second leg
  is the *decider* and carries the three +1 bonuses (ET, penalties, advancing team).
  Leg 1 scores base-only. `tieId` + `legNumber` link the legs.
- **Lockout** — predictions for a match lock 60 minutes before its kickoff; editing
  (resubmitting, re-paying gas) is a first-class feature until then.
- **Oracle / relayer** — the GitHub-Actions job holding `RESULT_ORACLE_ROLE` that
  pushes results from the UEFA feed. Never the owner key.
- **Provisional window** — 24h after `pushResult` during which a result can be
  corrected freely; leaderboards move immediately with a ◌ badge (D9); auto-finalizes.
- **Mirror-UEFA** — whatever the feed records is the result, forfeits included (D6);
  `voidMatch` exists only for our own fixture mistakes.
- **Source adapter / `ResultSource`** — the interface all feed access goes through;
  swap `UefaApiSource` ↔ `FootballDataSource` without touching contract or UI.
- **Season View** — cosmetic combined Stage 1 + Stage 2 table; knockout-only wallets
  show "—" in the league column.
- **Ultimate ₵h@mpi0n** — best combined season score; wins the zero-fund ERC-721
  trophy NFT + hall-of-fame page (D8).
- **`clp_` tables** — all Supabase tables for this project, in the existing shared
  free project, each commented `'ChampionsLeague predictor'`.
- **BigMac Bobby** — design credit for the "European nights" style guide; the footer
  credit is mandatory on every page.
