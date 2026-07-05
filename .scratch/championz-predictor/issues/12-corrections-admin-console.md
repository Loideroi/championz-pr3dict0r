# 12 — Corrections & the admin console

Status: ready-for-human
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

## Comments

**2026-07-05 — built; v5 live on Spicy (impl `0xd3A95783Aa64b1Ae3640296237166d3C9525F45A`).**
- **Contract v5** (5th UUPS upgrade, layout validated — Pausable lands via OZ 5's
  namespaced storage, append-safe): `pause`/`unpause` gating every money path;
  `forceCorrectResult` (owner, **reverts unless paused** — the deliberate friction;
  result stays final, no reopened window, lazy scoring re-scores automatically);
  `voidMatch` (owner, VOIDED matches never score and never block `freezeStage`;
  refused once the stage froze; scoped to OUR mistakes per ADR-0006);
  `setMatchTeams` (SCHEDULED + pre-kickoff, predictions preserved);
  `resultSourceRef` + `setResultSource` (PRD §7.2 transparency — set on Spicy to
  "uefa-api:match.uefa.com/v5"); `batchUpdateKickoffs` now oracle-OR-owner.
  34/34 contract tests.
- **Console** (`/admin`, owner-gated in UI and on-chain): oracle-health dashboard
  (latest clp_oracle_log rows: runs, pushes, alerts, heartbeats), stage cards with
  `lockStage` + **auto-ranked `freezeStage`** (computes the §5.3-ordered top-20 from
  chain state and submits — the contract re-verifies it all anyway), per-match
  corrections (forceCorrect only visible while paused; void with the ADR-0006
  warning; setTeams pre-kickoff), emergencies (pause toggle, oracle rotation,
  source-ref update), and the manual-results degraded-mode recipe (Actions
  workflow_dispatch — same oracle path).
- **Remaining (human):** eyeball /admin with the owner wallet on Spicy; the pause →
  forceCorrect → unpause drill can be rehearsed after the 7–8 Jul cron settles the
  staging matches.
