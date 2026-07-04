# 07 — Scoring engine + leaderboards

Status: ready-for-human
PRD: ../../PRD.md §5 · Decisions: D9, tie-breaks §5.3

## What to build

Complete lazy scoring across the real tournament structure, and the surfaces that show
it. Scoring: 5/3/1 on the 90-minute score for every match; the three +1 bonuses
(extra time, penalties, advancing team) apply only to knockout deciders and the final —
which requires the two-legged tie model (tie id + decider flag) the World Cup
predecessor never had: leg 1 scores base-only, leg 2 carries the tie bonuses judged on
the tie outcome. Tie-breaks: points → most exact scores → earliest entry → lowest
wallet address. Surfaces: the Stage 1 leaderboard (Full Season wallets, league matches),
the Stage 2 leaderboard (everyone, knockout matches, all starting at zero), and the
combined Season View with knockout-only wallets showing "—" for the league column.
Provisional results move all of them immediately with a ◌ badge that clears at
finalization (D9). Country flags render next to usernames.

## Acceptance criteria

- [ ] Property/unit tests cover the full rubric incl. leg-1-no-bonus, leg-2 tie bonuses, and final
- [ ] An archived knockout tie (with an AET decider) scores correctly end-to-end from feed to UI
- [ ] Tie-break chain verified with constructed equal-points fixtures, including the wallet-address tail
- [ ] Stage 2 leaderboard shows early birds and latecomers interleaved, all from zero
- [ ] Provisional badge appears within minutes of a result push and clears on finalization
- [ ] On-chain lazy points view and the UI leaderboard agree for every wallet in a replayed matchday

## Blocked by

- 03-two-stage-economics.md
- 05-oracle-relayer.md

## Comments

**2026-07-04 — built + upgraded on Spicy; live-data proof lands with the 7–8 Jul cron.**
- **Contract v3 via UUPS upgrade** (validated, impl → `0x02e6315049fE75612010a9c348eB00438c5c71c1`):
  tie metadata in appended storage (`tieInfo`, no Game-struct change — upgrade-safe),
  `setTies` owner wiring from the generated matches.json, decider-only bonuses in lazy
  scoring (+1 each: ET / pens / advancer, judged bitwise vs the pushed flags),
  `exactCountOf` + `enteredAt` for the §5.3 tie-break chain. 23/23 tests incl. the
  archived Juve–Gala decider shape (exact + all flags = 8 pts), leg-1-no-bonus, and
  wrong-flag partials. Staging matches 3/4 marked deciders on-chain.
- **Leaderboards**: `/standings` with the three views — Stage 1 (Full Season wallets),
  Stage 2 (everyone from zero), Season View (combined, 👑 on rank 1, league column
  "—" for KO-pass wallets, closing the slice-03 carry-over criterion). Tie-break
  comparator (points → exacts → earliest entry → lowest address, canon preserved) is
  pure + unit-tested in `lib/predictor/standings.ts`. Provisional badge (D9) shows
  whenever any completed result is still in its window. Flags/usernames come from
  `/api/profile` and degrade gracefully until Supabase is configured.
- Entrants enumerate from `Entered` events + per-wallet reads — fine at staging scale;
  the `clp_leaderboard` cache takes over in slice 06's sync (noted there).
- **Remaining (human):** after the 7–8 Jul cron self-settlement, eyeball /standings:
  match 3 (decider) should show bonus-inflated scores and the ◌ badge for 24h.
