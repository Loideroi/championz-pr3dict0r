# 02 — Walking skeleton: one match end-to-end on Spicy

Status: ready-for-human
PRD: ../../PRD.md §10–11

## What to build

The tracer bullet: the thinnest complete path through every risky integration. A
minimal v0 of the ChampionzPredictor contract deployed to Spicy (88882) holding one
hardcoded match; a user can pay an exact 550 CHZ entry, submit a bit-packed prediction,
an oracle key can push a packed result, and a view function returns the user's lazily
computed points (no settlement transactions anywhere). One barebones page: connect a
wallet via Reown AppKit — including the Socios.com Wallet's ERC-1271 smart-contract
path with poll-for-effect write confirmation instead of awaiting receipts — enter,
predict, and see points appear after the result lands.

Prediction encoding decision from the predecessor (keep, extend later with a
tie-advancer field):

```
uint256 packed: bits 0-7 scoreA · 8-15 scoreB · 16 extraTime · 17 penalties
                · 18-19 advancer · 20 submitted
```

## Acceptance criteria

- [ ] Entry reverts unless `msg.value` is exactly 550 CHZ; fee lands at `feeRecipient`
- [ ] Prediction submit → overwrite → lock at kickoff−60min all verified on-chain from the UI
- [ ] Result pushed by a separate oracle key (not owner); points view returns correct 5/3/1 values
- [ ] Full flow works from a Socios.com Wallet on Spicy (ERC-1271 verified, no receipt-await)
- [ ] `window.ethereum` is never overwritten; provider picked from `providers`
- [ ] Contract verified on Chiliscan via the keyless Routescan API
- [ ] Unit tests cover entry, packing round-trip, lockout, and lazy scoring

## Blocked by

- 01-repo-bootstrap-ways-of-working.md

## Comments

**2026-07-04 — built, deployed, one human check remaining.**
- Spicy deployment: proxy `0xfB030Fc43C60093cfCd8696f9796Adf56b1b5990`, implementation
  `0x485e2421bCD60bb218214B04C01C3f26C4c62492` — **verified on Chiliscan** (Routescan,
  ContractName ChampionzPredictor). Skeleton match RMA–MCI, kickoff 2026-07-11 07:14 UTC.
  Owner/oracle/feeRecipient = deployer `0x4710…9CF8` (note: same wallet as the planned
  mainnet owner — issue 16 should deploy mainnet from a distinct ceremony).
- Contract: 12/12 Hardhat tests green (exact-550 entry + 500/50 split, packed
  round-trip, T-60 lockout boundary, edit-overwrite, oracle-only push once after
  kickoff, lazy 5/3/1 scoring with zero settlement writes, UUPS owner-only upgrade,
  plain-transfer rejection). Compiled 0.8.24 / Shanghai.
- Frontend: /play page (AppKit connect → enter → stepper → submit/edit with countdown
  → points), SCW poll-for-effect confirmation (no receipt awaits), packed codec
  mirrored in lib/predictor/packed.ts with tests. Root typecheck/test/lint/build green;
  /play verified serving against the live proxy address.
- Ops note: two deploy runs hung in Routescan verification polling (killed after 36
  min); deploy itself had succeeded — verification completed on a separate
  `hardhat verify` run. Future deploys: keep verify as its own step.
- **Remaining (human):** run the flow once from a real Socios.com Wallet on Spicy
  (connect → enter 550 → predict → edit) — the ERC-1271/WalletConnect path can't be
  exercised without the physical wallet app. Everything else is done.
