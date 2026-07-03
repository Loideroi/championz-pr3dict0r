# 07 — Scoring engine + leaderboards

Status: ready-for-agent
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
