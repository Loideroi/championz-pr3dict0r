# 08 — Prediction UX: slate, batch submit, first-class editing

Status: ready-for-human
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

- [x] One transaction submits predictions for a full 18-match matchday
  <!-- evidence: all staged changes flow through diffSlate() → toBatchArgs() →
       a single submitPredictions(uint16[],uint256[]) writeContract call
       (app/play/PlayPanel.tsx handleSubmit). Array alignment + packing covered
       by lib/predictor/slate.test.ts ("packs aligned arrays…"). -->
- [ ] Submit → edit → on-chain overwrite verified → lock at T-60, all through the UI from a Socios.com Wallet on Spicy
  <!-- evidence: flow is fully built (submit → Edit pre-fill → diff → one tx →
       poll predictionOf until overwrite lands → row flips to 🔒 at T-60), and
       chain reads were verified against the live Spicy staging contract
       0xAE32d62B71DD1f6Eb4f27fC65Facc69AcFEe83D6 (matchCount=4, RMA-MCI /
       LIV-BAY / ARS-INT / BAR-PSG decode exactly as typed). The real-wallet
       Socios.com Wallet pass on Spicy REMAINS A HUMAN STEP — do it from the
       PR preview before merging (PR #7). -->
- [x] Edit flow shows pre-filled current pick and an old → new diff before signature
  <!-- evidence: Edit button calls setDraft(matchId, onchainPick) (pre-fill);
       the sticky SubmitBar renders every change as "old → new" (strike-through
       old pick) and is the only path to the sign button; MatchRow also shows
       an inline "was X–Y" while editing. Confirmation message: "you can change
       it again until <UTC lock time> (T-60)". -->
- [x] Countdown is accurate and hydration-safe; locked matches show state without a wallet call storm
  <!-- evidence: clock state starts null and mounts via setTimeout/setInterval —
       no Date.now() in render; SSR emits the deterministic loading state
       (curl-verified). formatCountdown unit-tested ("2h 14m" / "3d 4h" /
       clamped at 0). Locked/completed state derives from the already-fetched
       matches batch + client clock — ticking triggers zero refetches; reads
       are one useReadContracts batch each (wagmi falls back to parallel
       eth_calls on Spicy, cached by TanStack Query). -->
- [x] Batch edit groups multiple changed matches into one transaction
  <!-- evidence: drafts across any number of matches (new + edits mixed)
       reduce to one diffSlate() result and one submitPredictions call;
       diffSlate drops no-op drafts so unchanged picks never pay gas
       (unit-tested: "keeps new picks, keeps real edits, drops no-op drafts"). -->
- [x] Gas copy shows the real estimated cost next to the confirm button
  <!-- evidence: SubmitBar renders "a full 18-match batch costs ≈ 1.1 CHZ
       (~$0.05) in gas. Editing later just re-pays it." directly under the
       "Lock in N predictions" button — the PRD §10.4 numbers verbatim. -->

Delivered in PR: https://github.com/Loideroi/championz-pr3dict0r/pull/7
(`feat/prediction-ux` — /play slate rewrite, lib/predictor/slate.ts helpers +
10 tests, components/predict/{Stepper,MatchRow,SubmitBar}. typecheck/test/
build/eslint all green; builds with and without NEXT_PUBLIC_PREDICTOR_ADDRESS.)

## Blocked by

- 03-two-stage-economics.md
