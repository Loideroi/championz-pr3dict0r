# 03 — Two-stage economics: passes, pools, windows, floor

Status: ready-for-agent
PRD: ../../PRD.md §4 · Decisions: D1, D2, D3, D4

## What to build

The full entry model on top of the skeleton. Two stages as first-class contract state
with separate pools: the Full Season pass (1,100 CHZ, one transaction: 500 → League
Pool, 500 → Knockout Pool, 100 → fee) on sale until the first MD1 kickoff and not a
second longer (D1); the Knockout pass (550 CHZ: 500 → Knockout Pool, 50 → fee) on sale
from the moment the season pass closes until 60 minutes before the last play-off
first-leg kickoff (D4) — the shop is never closed. One entry per wallet per stage;
entries non-refundable from purchase. The participation floor (D2): a stage locking
with fewer than 20 entrants is void and every entrant reclaims their full gross entry,
fee included. UI: entry screens for both passes, and during the play-off first-leg
window the knockout purchase screen must list exactly which matches are already locked
(and therefore score zero for this buyer) before payment can proceed.

## Acceptance criteria

- [ ] Both entries enforce exact `msg.value`; pools and fees split as specced on-chain
- [ ] Season pass purchase reverts after the first MD1 kickoff; knockout purchase reverts before it and after T-60 of the last play-off first-leg
- [ ] A wallet cannot enter the same stage twice; a Full Season wallet is automatically in Stage 2 with no second transaction
- [ ] Stage locked with 19 entrants → every wallet reclaims its full 550/1,100 (fee included), demonstrated on Spicy
- [ ] Stage locked with 20 entrants → refund path is closed, payout path is open
- [ ] Knockout purchase UI in the final window shows the locked-matches disclosure before the pay button enables
- [ ] Season View shows knockout-only wallets with a "—" league column

## Blocked by

- 02-walking-skeleton-spicy.md
