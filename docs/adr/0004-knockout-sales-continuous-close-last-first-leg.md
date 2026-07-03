# ADR-0004 ⚡ — Knockout sales run continuously from MD1; close at the last play-off first-leg (D4)

Status: accepted · 2026-07-04 · PRD §4.1, §21-D4 · user-driven design

## Context

The original draft opened knockout sales only after the league phase. The user
proposed: open the moment the season pass closes, and close after the play-off first
round. The first half is strictly better (never turn away a willing customer); the
literal second half (entry after first legs *finish*) breaks the equal-matches
fairness invariant.

## Decision

Knockout pass on sale from the first MD1 kickoff (the shop is never closed) until
**T-60 minutes before the last play-off first-leg kickoff** (~17 Feb 2027). Buyers in
the final window who have already missed locked matches see exactly which ones —
listed on the purchase screen — before they can pay. Entries are non-refundable from
purchase, not from February.

## Consequences

Continuous conversion funnel from September. Bounded, disclosed unfairness: worst case
~7 missed matches out of 45, and no contract machinery needed (no prediction = 0
points naturally). September buyers accept a 5-month capital lockup; they get Telegram
+ Season View engagement in the meantime. Alternatives rejected: close at first
kickoff (loses the "it started, let me in" surge), entry after first legs complete
(40 unearnable points, permanent complaint thread).
