# Security findings & resolution log — ChampionzPredictor

> The living security record for ₵h@mpi0nz Pr3dict0r (slice 16, PRD §16). This
> file is the regression checklist for every future upgrade: nothing here may
> silently regress. It supersedes no ADR; it records what was tested and why.

## Method

- **Cross-model adversarial pentest loop** (PRD §16.1): the contract was designed
  and implemented by the primary model, then handed — frozen, with no design
  rationale — to a **different model (Opus) in an attacker persona** whose only job
  was to break it. Findings were fed back to the designer, fixed, and the red team
  re-attacked the diff. Loop until clean.
- **Static analysis:** Slither 0.11.4, full run.
- **Regression:** every predecessor `Audit.MD` finding (H-01…L-06) re-checked (below).

## Round 1 — red-team findings & resolution

| # | Severity | Finding | Verdict | Resolution |
|---|---|---|---|---|
| C-1a | Critical (claimed) | Cross-pool insolvency: one balance backs both pools; a void+lock mix drains funds | **False positive** — traced 19-void-league / 20-lock-knockout: a full-season entry deposits the full 1,100 across both stages' counters, so `balance == Σ(pools+escrows)` holds to zero. No double-spend. | No change needed; solvency invariant documented + tested (`freezes … pool drains to zero`). |
| C-1b | Critical | No `setFeeRecipient` + no `emergencyWithdraw` (both promised in PRD §10.1/§16.3) → an unreceivable fee recipient can brick `lockStage` with no recovery | **Confirmed** | Added `setFeeRecipient` (owner, non-zero) and `emergencyWithdraw(to)` (owner + `whenPaused` + 180-day `emergencyWithdrawUnlock`, armed in `initialize`). Tests: C-1 pair. |
| H-1 | High | `forceCorrectResult` could rewrite a **frozen** stage's inputs → public `pointsOf`/`winnersOf` contradict the paid ranking | **Confirmed** | `forceCorrectResult` now reverts `StageIsFrozen`. Test: H-1. |
| H-2a | High | A stage with **zero completed matches** (all voided / none added) freezes with all-zero scores → owner sweeps the pool to any 20 wallets via the entry/address tie-break | **Confirmed** | `_requireStageFinalized` now reverts `NoCompletedMatches`. Test: H-2(a). |
| H-2b | High | `freezeStage` verifies the ranked array is internally ordered + members + no dups, but **not global maximality** (an omitted true-rank-20 wallet + a lower crony still validates) | **Accepted trust assumption** | Same model the predecessor shipped (verify order, not maximality). Owner is a single trusted key (ADR-0005) and **all scores are public on-chain** (`pointsOf`/`exactCountOf`), so any bad freeze is off-chain-detectable before claims drain. The PRD's "trustless without a merkle ceremony" wording is **overstated and corrected** to "owner-submitted, on-chain-verified ordering + publicly auditable membership". A future slice may add a challenge window. |
| M-1 | Medium | `batchUpdateKickoffs` (oracle/owner) could move kickoff **later** to reopen an already-locked prediction window | **Confirmed** | Reverts `WouldReopenMatch` if the match is locked and the new kickoff would push the lock into the future. Test: M-1. |
| M-2 | Medium | `correctResult` re-arms the 24h window each call → a rogue oracle blocks `freezeStage` forever | **Confirmed** | Added owner `forceFinalize(matchId)` — clears the window bits without changing the score. (Oracle is also rotatable.) Test: M-2. |
| M-3 | Medium | `setStageWindow` didn't re-check cross-stage ordering (D4: league closes when KO opens) | **Confirmed** | Enforces `league.closeAt ≤ knockout.openAt` both directions. Test: M-3. |
| L-1 | Low | `unchecked { ++entryCount }` on uint32 | **Accepted** | 4.29B entries at 550 CHZ is unreachable; gratuitous but harmless. |
| L-2 | Low | No `nonReentrant` modifier | **No issue** | Red team confirmed checks-effects-interactions is correct on all three `.call` sites (state written before transfer). ReentrancyGuardUpgradeable is absent from the OZ 5.0.2 install; CEI ordering is the mitigation, verified by Slither (no `reentrancy-eth`). |
| L-4 | Low | Trophy `tokenURI` builds unescaped JSON | **Accepted** | Owner-only mint, season string is owner-controlled ("2026/27"); self-inflicted only. |

## Round 2 — the fixes were themselves attacked (and two opened new holes)

The red team re-audited the patched contract and found the round-1 patch **introduced
two new High findings** plus left two partial. All now resolved in round 2b:

| # | Round-2 finding | Resolution (round 2b) |
|---|---|---|
| N-1 | High | `emergencyWithdraw`'s 180-day lock counted from **deploy**, so it lapsed ~Feb 2027 mid-season while the knockout pool was full → a live unconditional balance sweep | **Redesigned**: removed deploy-time arming; the lock now counts from `pausedAt` (set in `pause()`, cleared in `unpause()`). Recovering funds requires halting the product for **180 visible days** first — never a fast quiet rug. `armEmergencyWithdraw` removed. Test: C-1/N-1. |
| N-2 | High | `forceFinalize` was unguarded → owner could skip the 24h dispute buffer instantly, chaining with H-2b | **Fixed**: now `whenPaused` + reverts `StageIsFrozen`. Skipping the buffer is now loud + deliberate. Test: M-2/N-2. |
| M-1 | partial | round-1 only closed the *unlock* direction; *premature-lock* griefing + `kickoff<3600` underflow still open | **Fixed**: floor `kickoffs[i] ≥ PREDICTION_LOCKOUT` (no underflow); an open match's new kickoff must keep it open (`≥ now + LOCKOUT`), a locked one can't reopen. Test: M-1 (both directions). |
| H-2b | accepted → mitigated | "verify off-chain" had no teeth without a delay | **Added** `stageFrozenAt` + a **24h `CLAIM_CHALLENGE_WINDOW`**: `claim` reverts `ChallengeWindowOpen` until 24h after freeze, giving verifiers a real window and the owner time to `pause()`. NatSpec corrected (no longer claims "trustless"). |
| N-3 | Low | no reinitializer armed the hatch on upgrade | **Dissolved** by the arm-on-pause redesign (no deploy/upgrade arming exists). |
| N-4 | Low | no storage gap | **Added** `uint256[45] __gap`. |
| C-1 structural | disputed | red team maintained cross-pool insolvency | **Disproven with a test**: "mixed void-league + locked-knockout stays solvent to zero" runs the exact 19-void / 20-lock scenario — all 20 knockout claimants pay out and both the pool counter **and** `address(this).balance` hit exactly 0. The invariant `balance == Σ(pools+escrows)` holds by construction (every enroll/refund/claim/fee-forward moves a counter and the balance by the same amount; `emergencyWithdraw` is the only intended exception). |

## Round 3 — verification of the round-2b fixes

The red team re-audited and **conceded C-1** ("I traced the exact disputed sequence…
balance and Σcounters both reach 0… I cannot construct an insolvency sequence, and I
concede the finding") — matching the solvency test. **N-1, N-2, M-1, N-4 confirmed
FIXED.** N-3 dissolved. One blocker remained: **H-2b PARTIALLY-FIXED** — the 24h
challenge window could *detect* a bad ranking but not *cure* it (once frozen,
`claimable` was permanent; the only lever was an indefinite pause). Plus two new Low
findings (R-1: `addMatches` lacked the kickoff floor; N-5: a 180-day emergency halt
also blocks legit claims — inherent to the anti-rug design) and one Informational (R-2).

## Round 4 — the H-2b cure path

| Item | Resolution |
|---|---|
| H-2b (blocker) | **Added `refreezeStage(stage, ranked)`** (owner + `whenPaused`): clears the challenged winners' `claimable` + `delete stageWinners`, re-runs the shared `_applyRanking` (ordering/membership/dup verification + split + dust-to-1) and **restarts** the 24h window. Because claims are window- and pause-gated, no claim can have fired for a stage the owner pauses to re-freeze — nothing is unwound. The challenge window is now **actionable, not just detective**. `freezeStage` and `refreezeStage` share `_applyRanking` so they can't diverge. Test: "refreezeStage cures a challenged ranking". |
| R-1 (Low) | **Fixed** — `addMatches` floors `kickoffs[i] ≥ PREDICTION_LOCKOUT`. Test: R-1. |
| N-5 (Low) | **Accepted + documented** — a genuine emergency requires committing to a 180-day halt (the anti-rug property); routine incident-pauses reset the clock, as intended. |
| R-2 (Info) | **Accepted** — rescheduling an open match to start inside its own lockout is correctly rejected. |

**Round-4 verification** found one new High in the cure path — **F-1**: `refreezeStage`
lacked a "challenge window still open" guard, so a refreeze *after* claims began would
let a gap-claimer keep funds and re-split an already-drained pool. Fixed:

| Item | Resolution |
|---|---|
| F-1 (High) | `refreezeStage` now reverts `ChallengeWindowClosed` once `block.timestamp ≥ stageFrozenAt + CLAIM_CHALLENGE_WINDOW`. Claims open at exactly that instant, so claim (`≥ X`) and refreeze (`< X`) are **exact complements** — disjoint at every timestamp, doubly so via `whenNotPaused`/`whenPaused`. "No claim fired against a challenged ranking" is now true by construction. Test: F-1. |

## Round 5 — clean sign-off

The red team verified F-1 and swept the full contract a final time. Verdict, verbatim:

> **CLEAN. F-1 is fixed and I found nothing further exploitable.** … Under the
> documented single-hardware-key owner trust model (ADR-0005), the ChampionzPredictor
> contract is fund-safe — no path lets a wallet claim more than its share, claim twice,
> or strand/steal another wallet's funds; pools pay out exactly to zero; and the only
> owner powers that remain are pause-gated, time-locked, and publicly evented.

The freeze/refreeze/claim window boundaries were proven mutually exclusive; the solvency
invariant `balance == Σ(pools + escrows)` holds on every path (sole exception: the
pause-gated, 180-day-locked `emergencyWithdraw`); all reentrancy paths remain
CEI-correct; freeze loops are bounded at 20 × matchCount.

**The loop converged over 5 rounds** (each finding fewer/deeper issues) to a clean pass —
satisfying the "two consecutive clean rounds" bar (round 4 clean except F-1; round 5
clean). Final gate: 46 contract tests green; Slither 0.11.4 clean of every high-severity
class on the shipped contract.

## Slither 0.11.4

No high-severity class triggered — specifically **no `reentrancy-eth`,
`uninitialized-state`, `suicidal`, or `arbitrary-send` to user-controlled input**.
Triggered detectors, all reviewed & accepted:

- `arbitrary-send-eth` (lockStage/emergencyWithdraw) — destinations are the
  **owner-set** `feeRecipient` / owner-supplied `to`, not attacker input. Intended.
- `reentrancy-events` — LOW: events emitted after the external call; state is written
  before it (CEI correct). Cosmetic ordering only.
- `timestamp` — block.timestamp gates the windows; Chiliz validators are cooperative
  (predecessor M-06 accepted risk; the 60-min lockout dwarfs any validator drift).
- `costly-loop` — the bounded freeze/score loops (≤20 wallets × matchCount). Measured:
  freeze gas 1.27M for 20×2; ~14M projected for a full 144-match stage — one tx/season.
- `incorrect-equality`, `low-level-calls`, `unindexed-event-address`,
  `uninitialized-local`, `events-maths` — informational; reviewed, no action.

## Predecessor Audit.MD regression (H-01…L-06)

| Predecessor finding | Status in v6 |
|---|---|
| H-01 double-settlement | N/A — no per-user settlement exists (lazy scoring) |
| H-02 unconditional winner bonus | Bonuses gated on decider + exact flag match (`_score`) |
| H-03 arbitrary reward setting | No `setClaimableReward`; shares are `_shareFor(rank, pool)` only |
| H-04 unverified ranking order | `freezeStage` verifies full §5.3 descending order on-chain |
| H-05 no emergency withdrawal | **Added this slice** — `emergencyWithdraw` + 180-day lock |
| M-03 fee tolerance | Exact `msg.value` enforced (`InvalidStakeAmount`) |
| M-05 gas on freeze | Top-20 only; bounded loop |
| M-06 plaintext front-running | Accepted; 60-min lockout + M-1 reopen guard |
| L-04 no receive/fallback | Confirmed absent (rejects stray transfers) |
| L-05 whenNotPaused on claim | `claim`/`claimRefund`/entry/predict all `whenNotPaused` |

## Snyk

`snyk_code_scan` on first-party app code: 0 issues (run each slice). The relayer's
5 Low `javascript/PT` findings are operator-run CLI path args (no untrusted boundary) —
reviewed and accepted in issue 04.

## Open items for launch (issue 16)

- Correct PRD §10.2 / §16.3 wording to match the shipped contract (maximality trust
  assumption; emergencyWithdraw now real).
- Mainnet deploy from a **fresh** owner-key ceremony (the Spicy deployer 0x4710… is
  staging only, per ADR-0005).
