# 08 — Prediction UX: slate, batch submit, first-class editing

Status: ready-for-agent
PRD: ../../PRD.md §6

## What to build

The daily loop users live in. A matchday slate showing every open fixture with the
scoreboard-stepper input pattern; batch submission packing a whole matchday (up to 18
matches) into one transaction; and editing as an advertised feature, not a loophole:
every submitted, still-open match card shows an "Edit prediction" button with a live
lock countdown, the edit flow pre-fills the current pick, shows an old → new diff
before signing, and confirms with a toast that says editing stays open until T-60.
Locked cards show the padlock and the final pick. Gas honesty in the copy: a full
matchday batch costs about $0.05, and edits simply re-pay it. Smart-contract-wallet
confirmation is done by polling chain state for the new prediction, never by awaiting
a relayed receipt. Countdown timers mount client-side after hydration (SSR-safety
rule: no Date.now in render).

## Acceptance criteria

- [ ] One transaction submits predictions for a full 18-match matchday
- [ ] Submit → edit → on-chain overwrite verified → lock at T-60, all through the UI from a Socios.com Wallet on Spicy
- [ ] Edit flow shows pre-filled current pick and an old → new diff before signature
- [ ] Countdown is accurate and hydration-safe; locked matches show state without a wallet call storm
- [ ] Batch edit groups multiple changed matches into one transaction
- [ ] Gas copy shows the real estimated cost next to the confirm button

## Blocked by

- 03-two-stage-economics.md
