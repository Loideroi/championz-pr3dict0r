# ADR-0006 ⚡ — Mirror UEFA verbatim, forfeits included (D6)

Status: accepted · 2026-07-04 · PRD §8.2, §21-D6 · user decision

## Context

The UEFA feed can record non-football outcomes: `ABANDONED`, `CANCELED`, and
`winner.match.reason = WIN_BY_FORFEIT` (awarded 3-0s from sanctions, ineligible
players, withdrawals). Someone who predicted 3-0 on a forfeited match would bank 5
points off a committee decision. The alternative was voiding non-football results.

## Decision

Whatever the feed records in `score.regular` is the result — forfeits and green-table
outcomes included. No filtering logic in the oracle. `voidMatch` is scoped exclusively
to **our own** fixture mistakes, never to UEFA's decisions.

## Consequences

"The feed is truth" is absolute; the oracle stays perfectly dumb; zero special-case
code. The lucky-forfeit-predictor dispute is pre-answered in the T&Cs ("If UEFA awards
it 3-0 at a green table, that's the score. Take it up with Nyon."). Abandoned-then-
replayed fixtures score whatever UEFA ultimately records for them.
