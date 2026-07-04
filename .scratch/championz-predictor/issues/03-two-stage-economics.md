# 03 — Two-stage economics: passes, pools, windows, floor

Status: ready-for-human
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

## Comments

**2026-07-04 — built + deployed to Spicy; human staging pass remaining.**
- Contract v1 (fresh proxy, not an upgrade — v0 was throwaway staging):
  `0xAE32d62B71DD1f6Eb4f27fC65Facc69AcFEe83D6` on Spicy, compressed staging windows
  (league sales close +2d, knockout +30d), 4 staging matches (2 league, 2 knockout —
  one KO match locks early to demo the D4 disclosure).
- 15/15 Hardhat tests, one per acceptance criterion: exact 1,100/550 with pool/fee
  splits; hard close at league `closeAt` (D1); knockout opens the same second league
  sales close and shuts at its own close (D4); no double entry; full-season auto-in
  both stages with no second tx; **19 entrants → VOID + full 550 refund fee-included /
  20 → LOCKED + fees forwarded** (D2); permissionless `lockStage`; stage-gated
  predictions; batch matchday submit; per-stage lazy scoring.
- **Design note (small deviation from v0):** the 50-CHZ fee is now ESCROWED per stage
  and forwarded to `feeRecipient` at stage lock, not instantly at entry — this is what
  makes the D2 "refund includes the fee" promise solvent. PRD §4.3 wording still says
  fees flow at entry; consider a PRD patch line.
- UI: `/enter` with both pass cards (live windows, entrant counts, floor copy), the D4
  locked-matches disclosure with acknowledge-checkbox gating the pay button; `/play`
  re-pointed at the multi-match contract. Typecheck/tests/lint/build green.
- **Remaining (human):** on Spicy — buy a season pass from a real wallet before the
  +2d close; after it, buy a knockout pass and (from +3d12h-1h) see the ARS–INT
  disclosure; optionally play out the 19-vs-20 floor with test wallets. Season View
  "—" column lands with the leaderboard surfaces (slice 07 — noted there).
