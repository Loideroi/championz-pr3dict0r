# 12 — Corrections & the admin console

Status: ready-for-agent
PRD: ../../PRD.md §8.2, §9 · Decisions: D5, D6

## What to build

The exceptions surface — everything that remains of the old admin panel. Correction
actions: overwrite a provisional result; after finalization, corrections require pause
plus a force-correct that reverts unless paused (deliberate friction, loudly evented);
void a match (scoped to our own fixture mistakes only, per the mirror-UEFA decision);
fix wrong teams pre-kickoff with predictions preserved; adjust kickoffs. Lifecycle and
emergency controls: open/close entry windows, trigger stage freezes, pause/unpause,
rotate the oracle key, update the on-chain result-source reference, and the UUPS
validate-then-upgrade path. A monitoring dashboard reads the oracle log: last poll,
last result, alert history, per-match pipeline state. Everything owner-gated to the
single hardware key (D5); a pre-payout correction must visibly re-score the leaderboard
with no unwind ceremony.

## Acceptance criteria

- [ ] Provisional result corrected from the console; leaderboard self-heals; event carries old + new
- [ ] Post-finalization correction is impossible unpaused and possible paused, with distinct events
- [ ] voidMatch removes a fixture from scoring everywhere (points, leaderboards, UI)
- [ ] setMatchTeams pre-kickoff preserves existing predictions and users can revise until lockout
- [ ] Oracle rotation: old key's push reverts, new key's succeeds
- [ ] Dashboard shows oracle health and per-match pipeline state from the oracle log
- [ ] Non-owner wallets are rejected from every console action

## Blocked by

- 05-oracle-relayer.md
- 06-breakage-detection-ops-alerts.md
