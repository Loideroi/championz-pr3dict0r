# 11 — Freeze, claims & the Ultimate ₵h@mpi0n trophy

Status: ready-for-human
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

## Comments

**2026-07-04 — built + upgraded on Spicy (v4, impl `0x956C8E7323cb604016afFAd7F7Bd2A7569e8012d`);
trophy at `0xFe6112BFBA2Ec16ddA0E4b079865d7A7d0892F02`.**
- `freezeStage(stage, top20)`: owner submits addresses only; the contract recomputes
  points + exact counts in ONE pass per wallet and verifies the full §5.3 comparator
  (points → exacts → earliest entry → lowest address) plus entered-membership and
  duplicates on-chain. Requires every stage match COMPLETED **and past its provisional
  window** — the D3 freeze timing is enforced by code, not procedure. Split
  25/15/10/30÷7/20÷10, dust to rank 1. Limitation (documented): membership in the
  global top-20 is not provable on-chain — order and eligibility are; anyone can
  recompute off-chain and shame a bad ranked set before claims drain (predecessor
  H-04 parity, improved by recomputation).
- `claim(stage)`: single transfer, zeroed before send; mini-season e2e test drains the
  pool to exactly 0 across 20 claims. 29/29 contract tests.
- **Freeze gas measured**: 1.27M for 20 wallets × 2 matches; projected ≈14M for a
  144-match mainnet Stage 1 — one tx, ~35 CHZ, once per season. Well under block limits.
- Trophy: `ChampionzTrophy` ERC-721 (OZ 5.0.2 — 5.6 uses Cancun `mcopy`, above the
  Shanghai ceiling; pinned), owner-mint with season string, inline data-URI metadata,
  zero funds. `/hall-of-fame` renders champions (empty-plinth state until Madrid).
- Standings gains the claim banner: connected top-20 wallets see per-stage claimable
  CHZ + a Claim button with SCW poll-for-effect confirmation.
- **Remaining (human):** the real Stage 1 staging freeze can only run after the
  staging league locks (6 Jul) + results finalize — one `freezeStage` from the owner
  wallet then; claims + trophy mint exercisable on Spicy afterwards.
