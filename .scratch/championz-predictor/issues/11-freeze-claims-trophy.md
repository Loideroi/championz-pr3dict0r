# 11 — Freeze, claims & the Ultimate ₵h@mpi0n trophy

Status: ready-for-agent
PRD: ../../PRD.md §4, §10 · Decisions: D2, D3, D8

## What to build

How money leaves the contract. Per-stage freeze: the owner submits only the top-20
addresses; the contract recomputes those 20 wallets' points on-chain (bounded loop) and
verifies descending order before recording claimable rewards on the proven split
(25 / 15 / 10 / 30÷7 / 20÷10, dust to first). Stage 1 freezes as soon as the last MD8
result clears its provisional window and pays immediately (D3); Stage 2 freezes after
the final. Winners call claim per stage — one transfer, claim-guarded. The stage-void
refund path from D2 is exercised here as the freeze-time alternative. The season ends
with the Ultimate ₵h@mpi0n: a minimal ERC-721 trophy minted to the best combined
Stage 1 + Stage 2 score (zero funds attached), a profile crown, and a permanent
hall-of-fame page.

## Acceptance criteria

- [ ] Freeze with a wrong ranking order or wrong member set reverts; correct top-20 freezes and assigns the exact split
- [ ] Freeze gas is bounded and measured (20 recomputations over a full-season prediction set) on Spicy
- [ ] A winner claims once; second claim reverts; non-winner claim reverts
- [ ] Full mini-season on Spicy: MD replay → Stage 1 freeze + claims → knockout replay → Stage 2 freeze + claims → trophy NFT minted to the right wallet
- [ ] Rounding dust lands on rank 1; pool balance is exactly zero after all claims
- [ ] Hall-of-fame page renders the trophy holder from chain data

## Blocked by

- 07-scoring-engine-leaderboards.md
