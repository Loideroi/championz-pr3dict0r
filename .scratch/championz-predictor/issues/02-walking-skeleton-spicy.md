# 02 — Walking skeleton: one match end-to-end on Spicy

Status: ready-for-agent
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
