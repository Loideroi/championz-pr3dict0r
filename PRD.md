# ₵h@mpi0nz Pr3dict0r — Product Requirements Document

> **THIS FILE IS THE MASTER.** `PRD.md` is the single source of truth for the product.
> Every scope, rule or economics change lands **here first**, then gets mirrored into
> [`PRD.html`](./PRD.html) (the human-readable rendition). If the two ever disagree, the
> `.md` wins. Bump the version line below on every substantive edit.

- **Version:** 1.1.0 (2026-07-04) · **BUILT + shipped 2026-07-05**
- **Status:** ✅ **Build complete — all 16 slices merged; contract live on Chiliz
  mainnet** (`0x742c6963a81012bc7949F0058Fba07c8d1A80c4d`). Remaining = owner-gated
  launch cutover. **Current state + next steps: see [`STATUS.md`](./STATUS.md)** (kept
  live; this PRD is the frozen spec + grilled decision log).
- **Predecessor:** [`W0rld CUP Pr3dict0r`](/Users/markverdegaal/Projects/predictor) (FIFA World Cup 2026) — forked per its [`docs/REUSE_GUIDE.md`](/Users/markverdegaal/Projects/predictor/docs/REUSE_GUIDE.md)
- **Tournament:** UEFA Champions League 2026/27 (league-phase draw 27 Aug 2026 · MD1 8–10 Sep 2026 · Final Sat 5 Jun 2027, Estadio Metropolitano, Madrid)
- **Chain:** Chiliz mainnet `88888` (Spicy testnet `88882` for staging)
- **Domain:** [pr3dict0r.com](https://pr3dict0r.com) (GoDaddy) → Vercel (**Loideroi personal account**)
- **Repo:** personal GitHub, `mark.verdegaal@gmail.com` (Loideroi) — **NOT** the company org
- **Hard constraint:** free-tier services only (see §19)

---

## 1. Executive summary

₵h@mpi0nz Pr3dict0r is a staking-based score-prediction pool for the UEFA Champions
League 2026/27 on Chiliz Chain. Users stake CHZ, predict the 90-minute scoreline of
every match, earn points on-chain, and the top-ranked predictors split the pool.

It evolves the World Cup predictor in five big ways:

1. **Two-pronged entry** — early birds play the whole season (league phase + knockout)
   for 1,100 CHZ; latecomers can still join the knockout phase for 550 CHZ (§4).
2. **Hands-off operations** — match results flow automatically from UEFA's own
   (unofficial) JSON API onto the chain via an oracle relayer; the admin's per-match
   work drops from 2 signed transactions + a manual feed cross-check to *zero* (§8).
3. **Radically cheaper gas** — claim-time scoring removes the O(users × matches)
   settlement loops entirely (§10).
4. **Community lives on Telegram** — a results channel + feedback group, with optional
   account linking at sign-up (§12).
5. **A new look** — the "European nights" dark/glow aesthetic from the style-guide HTML,
   credited to **BigMac Bobby** in the footer (§14).

## 2. Goals & non-goals

**Goals**

- Trustless staking, scoring and payout — money and points live on-chain, verifiable on Chiliscan.
- Near-zero routine admin: results, locks, notifications and leaderboard updates are automated.
- A fair, fun path for latecomers to join at the knockout stage without diluting early birds.
- Clear, first-class "edit your prediction" UX up to 60 minutes before kickoff.
- Survive UEFA API changes gracefully: detect breakage, alert the admin, swap the source without redeploying the frontend or losing history.

**Non-goals**

- Live/in-play betting or odds — this is skill-based score forecasting, locked pre-kickoff.
- Custody beyond the staking contract.
- Paid infrastructure of any kind (no paid APIs, no paid tiers, no company GitHub/Vercel).
- Mobile app; responsive web only (mobile-first layouts, as the predecessor).

## 3. Heritage — what we reuse from the World Cup predictor

Per `docs/REUSE_GUIDE.md`, the fork checklist is: fresh contract → swap tournament data →
point app at new contract + Supabase → adapt verification to the new source of truth →
operate. What carries over vs. what changes:

| Area | Verdict | Notes |
|---|---|---|
| Staking / prediction / claim flow | **Reuse** | Same mental model; new economics (§4) |
| Scoring rubric 5/3/1 + knockout bonuses | **Reuse** | Now on two-legged ties (§5) |
| 60-min lockout + overwrite-before-lock | **Reuse + surface in UI** | §6 |
| `matches.json` single-file tournament data | **Reuse pattern** | Generated from UEFA API instead of hand-authored |
| Knockout feeder resolution (`src/lib/knockout.ts`) | **Extend** | Two-legged ties + league-position seeding (§7.3) |
| Bracket verification (numbering-independent leaf sets) | **Re-point** | FIFA feed → UEFA feed (§7.4) |
| Admin panel | **Shrink** | Becomes a monitoring + correction console (§9) |
| ERC-1271 dual-path signature verification | **Reuse verbatim** | `src/app/api/profile/route.ts` pattern (§11) |
| Supabase read-model | **Reuse** | New `clp_`-prefixed tables in the *same* project (§13) |
| i18n (6 locales) | **Reuse — all 6 at launch** | en, es, fr, it, pt-BR, tr (decided §21-D10); T&C humour adapted per locale, not translated. ⚠ 6× content risk in the August crunch |
| AI Match Insights + merge tooling | **Reuse — automated** | Generated per-matchday in en → translated to 5 locales via the merge scripts (§7.5, decided §21-D11) |
| Per-user settlement (`batchSettleUserPoints`) | **Delete** | Replaced by claim-time scoring (§10) |
| In-app feedback feature | **Delete** | Community feedback moves to Telegram (§12) |
| Funny T&Cs (`src/constants/terms.json`) | **Out-fun** | §15 |

Audit heritage: the predecessor's V2 contract fixed 5 High / 7 Medium / 6 Low findings
(double-settlement guard, winner-bonus bug, reward caps, ranking verification, emergency
withdrawal with 180-day locktime, exact-fee enforcement, cancellation, custom errors…).
That full checklist (`Audit.MD`) becomes the **regression baseline** for the new contract (§16).

## 4. The two-pronged predictor (flagship change)

### 4.1 The model: one season, two stages, two pools

The season is split into **Stage 1 — League Phase** (144 matches, MD1–MD8, Sep 2026 –
27 Jan 2027) and **Stage 2 — Knockout** (45 matches: play-offs, R16, QF, SF, final,
Feb – Jun 2027).

| | **Full Season pass** (early bird) | **Knockout pass** (latecomer) |
|---|---|---|
| Entry window | From launch until first MD1 kickoff (8 Sep 2026) — **hard close, no late league entry** | Opens the moment the Full Season sale closes (first MD1 kickoff) — **the shop is never closed** — and shuts at T-60min before the **last play-off first-leg kickoff** (~17 Feb 2027) |
| Price | **1,100 CHZ** — one transaction | **550 CHZ** |
| Split | 500 → League Pool · 500 → Knockout Pool · 100 → admin fee | 500 → Knockout Pool · 50 → admin fee |
| Competes in | Stage 1 **and** Stage 2 | Stage 2 only |

Knockout-window fine print (decided §21-D4):

- A September knockout buyer's stake is locked and non-refundable **from purchase**,
  not from February — they spend the league phase as engaged spectators (Telegram,
  Season View with a "—" league column, "your slate opens in Feb" state).
- Joiners in the final ~24h (between the first and last play-off first-leg kickoffs)
  can no longer score on already-locked matches — no special contract machinery
  (no prediction = 0 points naturally), but the **purchase screen must list exactly
  which matches are already locked** before payment. Bounded (≤ ~7 matches), disclosed, accepted.

- **Exactly two paying leaderboards.** Stage 1 ranks league-phase points (Full Season
  players only) and pays out the League Pool when MD8 settles (~early Feb 2027 — a
  mid-season payday that doubles as marketing for the knockout join window). Stage 2
  ranks knockout points — **everyone restarts at 0** — and pays the Knockout Pool after
  the final. Each pool pays the proven top-20 split: 25% / 15% / 10% / 30%÷7 (places
  4–10) / 20%÷10 (places 11–20), rounding dust to 1st.
- **The end-to-end feel** comes from the **Season View**: a combined table (Stage 1 +
  Stage 2 points) crowning one **Ultimate ₵h@mpi0n**. The crown is a minted **on-chain
  trophy NFT** (one tiny ERC-721 — zero funds attached, so pool maths and the pentest
  surface stay untouched) plus a profile crown and a permanent hall-of-fame page
  (decided §21-D8). Latecomers appear in the Season View too (league column simply
  reads "—"), so the app always shows one continuous story from MD1 to Madrid.

### 4.2 Why this design (alternatives considered)

- **Single leaderboard with a points handicap for latecomers** — rejected: any handicap
  (median, average) is arbitrary, gameable, and every payout would be contested.
- **Carry-over league points into the knockout** (mirroring UCL seeding) — rejected:
  latecomers pay the same 550 CHZ for Stage 2 as early birds do; letting early birds
  start ahead in a pool both funded equally is unfair. The "seeding reward" for early
  birds is structural instead: two shots at prizes + the mid-season payout.
- **Three paying leaderboards (league / knockout / overall)** — rejected: violates "as
  few leaderboards as possible" and splits the pot into unimpressive slices.

**Fairness invariants:** every participant pays the same 550 CHZ per stage they enter;
no points cross a pool boundary; each pool is funded only by the wallets eligible to win it.

### 4.3 Entry economics (clean 50s, not 12.82s)

The predecessor's `500 ÷ (1 − 2.5%) = 512.82 CHZ` maths is replaced by flat numbers:

- **550 CHZ per stage, exactly** — 500 CHZ to the prize pool, **50 CHZ flat fee** to the
  admin fee-recipient wallet. Full Season = 1,100 CHZ (1,000 pool / 100 fee), one transaction.
- The contract enforces `msg.value == ENTRY_GROSS` exactly (predecessor M-03 fix carries over).
- Entries are final and non-refundable from purchase; refunds only via the stage-void
  floor below or the emergency path (§16).
- One entry per wallet per stage. A Full Season wallet is automatically in both stages
  — no second transaction in February.
- **Participation floor (decided §21-D2):** if a stage locks with **fewer than 20
  entrants**, the stage is void and every entrant reclaims their **full 550 CHZ, fee
  included** (goodwill; tiny cost). At ≥ 20, the top-20 split applies as designed. One
  number, one rule, one T&C sentence. (For a September knockout buyer this doomsday
  refund would arrive in February — accepted.)
- **Stage 1 pays out immediately after MD8 finalizes** (~early Feb 2027; decided
  §21-D3): the freeze runs once the last MD8 result clears its 24h provisional window
  — a built-in dispute buffer — and the payout announcement doubles as the launch
  campaign for the knockout window's final weeks.

## 5. Scoring rules

Per match, best single scoreline rule applies, plus knockout bonuses — unchanged
rubric, proven UX:

| Component | Points | Condition |
|---|---|---|
| Exact score | **5** | both scores exact |
| Goal difference | **3** | same outcome and same goal difference |
| Outcome | **1** | correct win/draw/loss only |
| Extra-time bonus | **+1** | knockout deciders only |
| Penalties bonus | **+1** | knockout deciders only |
| Advancing-team bonus | **+1** | knockout deciders only; predicted the team that goes through (or lifts the trophy) |

### 5.1 The 90-minute rule (hard requirement)

**All scoreline points are computed on the score after 90 minutes** — even when media
report the after-extra-time score as "the result". The UEFA feed exposes this directly:
`score.regular` (90′) vs `score.total` (incl. ET), plus optional `score.penalty`
(shoot-out) and `score.aggregate` (two-legged tie). The oracle relayer **must** write
`score.regular` as the on-chain scoreline and derive `extraTime` / `penalties` /
`advancer` from `winner.match.reason` (`WIN_ON_EXTRA_TIME`, `WIN_ON_PENALTIES`, …) and
the aggregate winner. An automated test fixture must cover a real AET match
(regular ≠ total) before mainnet.

### 5.2 Two-legged ties (new vs. the World Cup)

UCL play-offs, R16, QF and SF are two-legged; only the final is a one-off:

- **Leg 1** is scored as a normal match: 5/3/1 on the 90′ score. No bonuses (a first
  leg cannot go to extra time).
- **Leg 2 (the decider)** is scored 5/3/1 on its own 90′ score **plus** the three
  knockout bonuses (ET / pens / advancing team, judged on the tie).
- **The final** is a single match with all bonuses.
- **v7 amendment (2026-07-08, CPO):** the ET and penalties bonuses are awarded
  **only when the 90′ outcome (win/draw/win) was also predicted correctly** —
  otherwise a wrong-winner slip could out-earn nothing at all on flag freebies
  (wrong winner + "stays 90 minutes" used to bank 2 while a correct winner with
  the wrong goal difference banked 4 with flags). The advancer bonus remains
  independent: "loses the night, advances on aggregate" is a distinct, honest
  call. Applied on-chain in contract v7 before any fixtures existed.

This needs a `tieId` / decider concept in both the data model and `knockout.ts` — the
predecessor only knew single-elimination matches. Flagged as a build slice of its own.

### 5.3 Tie-breaks (leaderboard)

1. Total points → 2. most exact scores → 3. earliest entry timestamp → 4. **lowest
wallet address ("because computers enjoy order")** — the predecessor's beloved final
tie-break survives.

## 6. Prediction UX — editing is a feature, not a loophole

The predecessor's contract always allowed overwriting a prediction before lockout, but
the UI never advertised it. Now it's a first-class feature:

- Predictions for any match are **editable until 60 minutes before its kickoff**
  (`PREDICTION_LOCKOUT = 3600s`, unchanged). Editing = resubmitting on-chain; **the
  user pays gas again** (cents on Chiliz — see §10.4) and the new prediction overwrites the old.
- **UI requirements:**
  - Every submitted, still-open match card shows an **"Edit prediction"** button plus a
    live countdown: *"Locks in 2h 14m"*.
  - The edit flow pre-fills the current prediction, shows an old → new diff before
    signing, and confirms with a toast (*"Prediction updated — you can change it again
    until 20:00"*).
  - Locked cards show the padlock state and the final submitted prediction.
  - A batch "edit matchday" mode groups changes into **one transaction** per matchday.
- **Telegram nudge:** the channel posts a reminder ~75 minutes before each kickoff
  cluster: *"Last call — predictions for tonight lock in 15 minutes."* (§12)
- T&Cs must describe editing plainly (§15): free to change your mind, gas is on you.

## 7. Tournament data — UEFA as the source of truth

### 7.1 The feed

- **Package:** [`uefa-api`](https://github.com/ErikMichelson/uefa-api) (npm, v1.0.2, MIT,
  TypeScript typings) — bindings for UEFA's own undocumented JSON API that powers
  uefa.com and the UCL app: `match.uefa.com/v5/matches`, `match.uefa.com/v5/livescore`,
  `comp.uefa.com/v2/{competitions,teams,players}`, `standings.uefa.com/v1/standings`,
  `matchstats.uefa.com/v1/team-statistics`. No auth, no documented rate limits, no SLA.
- **Key calls:** `getMatches({ competitionId, seasonYear })` for fixtures/results
  (`seasonYear` is mandatory alongside `competitionId`); `getLivescore()` for running +
  last-hour-finished matches — its payload carries a `hash` of all exposed match
  properties, i.e. a built-in cheap change detector for the relayer's fast path;
  `getStandings()` for the league table; `getTeams()` for the 36 participants.
- **Champions League `competitionId = 1`** — confirmed via UEFA.com's own
  `?competitionId=1` API URLs; still re-verify with one live `getCompetitions()` call
  in the first build slice.
- Useful upstream fields beyond the score: `Match.type`
  (`GROUP_STAGE | SINGLE | FIRST_LEG | SECOND_LEG`) and `leg` map directly onto our
  tie/decider model (§5.2); `Match.status` includes `ABANDONED` and `CANCELED`
  (→ `voidMatch` triggers, §8.2); `winner.match.reason` spells out
  `WIN_REGULAR | WIN_ON_PENALTIES | WIN_ON_EXTRA_TIME | WIN_ON_AGGREGATE | WIN_BY_FORFEIT | DRAW`
  — the flags for our knockout bonuses come straight from the feed.
- **Maintenance reality:** the package (v1.0.2) has been dormant since June 2024 —
  zero runtime dependencies, MIT, works, but nobody is updating it. Treat it as a
  reference implementation we own: pin the version, vendor the type definitions, and
  validate every response with zod schemas (§8.3 depends on this). If UEFA drifts the
  schema, we patch our vendored copy rather than wait upstream.

### 7.2 Source-adapter pattern (survive API churn)

All feed access goes through one interface so the whole data layer swaps in one module:

```ts
interface ResultSource {
  id: string;                                  // "uefa-api@1.0.2"
  fixtures(season: string): Promise<Fixture[]>;
  result(matchRef: string): Promise<MatchResult | null>;  // 90' + total + pens + advancer
  livescore(): Promise<LiveMatch[]>;
  health(): Promise<SourceHealth>;
}
```

`UefaApiSource` is the launch implementation; a `FootballDataSource`
(api.football-data.org free tier, which covers the UCL) is specced as the documented
fallback. On-chain, the contract stores an updatable `resultSourceRef` string (e.g.
`"uefa-api:match.uefa.com/v5"`) purely for transparency — `setResultSource()` is
owner-only and emits an event, so the community can see exactly which feed the oracle
claims to relay (§8, §10).

### 7.3 Fixtures, bracket wiring, seeding

- `matches.json` keeps the predecessor's shape (single file: `teams`, `matches[]` with
  numeric `matchId`, phases, kickoffs) but is **generated** by
  `scripts/generate-matches.mjs` from the UEFA feed after the 27 Aug draw — never
  hand-authored. It gains `uefaMatchId`, `tieId`, and `legNumber` fields.
- League phase: 144 concrete fixtures from the draw. Knockout: feeder placeholders as
  before, but seeded from **league positions** (top 8 direct to R16; 9–24 into
  play-offs) plus the play-off/R16 draw outcomes in February.
- Kickoff updates (UEFA reschedules matches) flow through the relayer calling
  `batchUpdateKickoffs` — no manual admin action.

### 7.4 Bracket verification

The predecessor's hardest-won lesson: resolution code is fine, hand-wired feeders are
not. Keep the guardrail, re-pointed:

- `scripts/verify-fixtures.mjs` and `verify-bracket.mjs` compare bundled + on-chain data
  against the UEFA feed (join by round + date + teams, numbering-independent).
- The admin add-matches path (now relayer-driven) keeps the **hard gate**: no knockout
  batch is broadcast unless the verifier passes against the live UEFA bracket.

### 7.5 AI Match Insights (decided §21-D11)

The predecessor's per-match preview blurbs return, **automation-first** like everything
else: generated per matchday in English from UEFA stats/standings data using the
existing tooling (`agent_docs/match-insights.md` workflow), translated to the other 5
locales via the merge scripts (non-translatable fields byte-identical, as before), and
shipped a few days before each matchday. The component is empty-safe — insights may
lag fixtures (especially knockout rounds, whose fixtures only exist after each draw)
without breaking anything.

### 7.6 Official club crests

- **Primary:** football-data.org free tier — covers the UCL, serves official crests at
  `https://crests.football-data.org/{teamId}.png` (10 req/min; cache aggressively
  server-side, store the mapping `uefaTeamId ↔ footballDataTeamId` in Supabase).
- **Fallback chain** (lifted from Fanbet's production `TokenCrest`, 4 tiers, never
  blank): manual override URL → football-data.org crest → `img.uefa.com` team PNG
  (`imgml/TP/teams/logos/140x140/{uefaTeamId}.png`, undocumented) → coloured monogram.
  Implementation note from Fanbet's 2026-05-29 incident: plain `<img onError>` swap, **not**
  Radix Avatar composition.
- Legal note: club crests are trademarks. Prototype/editorial use is fine; a commercial
  launch would need brand clearance. Recorded here so nobody is surprised later.

## 8. Results oracle — the "very little maintenance" machine

### 8.1 Architecture

```
UEFA API ──▶ Relayer (GitHub Actions, every 5 min on matchdays)
                 │  zod-validate → map to 90' score + flags → idempotency guard
                 ▼
        ClPredictor.pushResult(matchId, packedResult)   [RESULT_ORACLE_ROLE]
                 │                                (provisional, 24h dispute window)
                 ▼
        auto-finalize after window ──▶ points computable ──▶ Telegram post + Supabase sync
```

- **Relayer:** a TypeScript script run by **GitHub Actions cron** (free; Vercel Hobby
  crons are daily-only, so they are *not* an option for match polling —
  `cron-job.org` hitting a secret-protected API route is the documented backup
  trigger). Schedule: every 5 minutes during matchday windows (17:00–01:00 CET on
  fixture days), hourly otherwise; `concurrency.group: oracle-bot` so runs never
  overlap (Fanbet's proven pattern, incl. idempotency guard — check
  `results(matchId).status` on-chain before submitting).
- **Signer:** a dedicated low-value oracle wallet holding only gas, granted
  `RESULT_ORACLE_ROLE` on the contract. The **owner key is never in CI.** Owner can
  rotate the oracle (`setOracle`) at any time.
- **What the relayer automates:** lock detection (informational), posting results
  (90′ score + ET/pens/advancer for deciders), kickoff-time updates, standings/leaderboard
  cache sync to Supabase, Telegram posts, and generating the knockout `matches.json`
  entries after each draw (with the §7.4 verification gate).

### 8.2 Corrections — wrong scores and wrong matches

Automation needs an undo button:

- **Provisional window:** `pushResult` marks a result `PROVISIONAL`. It auto-finalizes
  after **24 hours** (configurable). Points and leaderboards compute immediately but
  display a "provisional" badge until finalized.
- **`correctResult(matchId, packedResult)`** — admin (owner) can overwrite any
  `PROVISIONAL` result; the relayer also self-corrects if UEFA amends a score within
  the window (official corrections do happen). Emits `ResultCorrected` with old + new.
- **After finalization,** corrections require `pause()` + an explicit
  `forceCorrectResult` that reverts unless paused — deliberate friction, loudly evented.
  Because scoring is computed at claim/freeze time (§10), a corrected result *before
  payout* automatically re-scores everyone; there are no per-user settlements to unwind
  — this is a structural win over the predecessor.
- **Non-football outcomes — mirror UEFA verbatim (decided §21-D6):** whatever the feed
  records in `score.regular` is the result, **forfeits and awarded results included**
  (`winner.match.reason = WIN_BY_FORFEIT`). The oracle stays perfectly dumb; "the feed
  is truth" is absolute. Abandoned-and-replayed matches score whatever UEFA ultimately
  records for that fixture; postponements use `updateKickoff`. The T&Cs pre-answer the
  inevitable dispute: *"If UEFA awards it 3-0 at a green table, that's the score. Take
  it up with Nyon."*
- **Wrongly created matches:** `voidMatch(matchId)` — now scoped **only to our own
  mistakes** (a fixture that should never have existed), not to UEFA's decisions.
  `setMatchTeams` (predecessor upgrade) carries over for fixing a wrong fixture
  pre-kickoff, predictions preserved.
- **Provisional results are visible immediately (decided §21-D9):** points and
  rankings update within minutes of full-time, marked with a ◌ provisional badge that
  clears at finalization; Telegram posts carry the same "provisional" label for the
  24h window. Corrections self-heal via lazy scoring, and the badge pre-answers "why
  did my rank change".

### 8.3 Breakage detection & admin alerting

The UEFA API is unofficial; assume it will break at the worst moment:

- **Schema watch:** every relayer response passes zod validation; any shape drift =
  a `SOURCE_SCHEMA_CHANGED` alert (not a silent `undefined`).
- **Staleness watchdog:** if a match should have finished >2h ago and has no result, or
  a scheduled poll returns 0 fixtures for a known matchday → `SOURCE_STALE` alert.
- **Alert channel:** Telegram bot DM to the admin (and the private ops channel), plus
  GitHub Actions failure e-mail as a second wire. Alerts include the failing endpoint,
  sample payload and the runbook link.
- **Heartbeat:** one daily "✅ oracle healthy — n matches tracked, next poll window …"
  DM, so *silence itself* is a detectable failure.
- **Degraded mode:** on source failure the app banners "results delayed — leaderboard
  will catch up", and the admin can post results manually from the console (§9) —
  the old manual path survives as the emergency fallback.
- **Recovery:** swap the adapter (§7.2), point `resultSourceRef` at the new source,
  redeploy relayer only. Contract and frontend untouched.

## 9. Admin console (what's left of it)

The predecessor's runbook required per-match: 2 signed txs + a manual feed cross-check.
The new console is a **monitoring + exceptions** surface:

- Oracle health dashboard (last poll, last result, alert history — from `clp_oracle_log`).
- Correction actions: `correctResult`, `voidMatch`, `setMatchTeams`, `updateKickoff` (all §8.2).
- Stage lifecycle: open/close entry windows, `freezeStage(stage, top20)` → payouts claimable.
- Emergency: `pause` / `unpause`, oracle rotation, `setResultSource`, UUPS upgrade path
  (validate-then-upgrade scripts, as predecessor).
- **Routine per-match admin work: none.** Target: an untouched laptop for an entire
  matchday leaves the system fully settled.

## 10. Smart contract v3 — `ChampionzPredictor.sol`

### 10.1 Shape

- Solidity **0.8.24**, EVM target **Shanghai** (Chiliz ceiling), OpenZeppelin
  upgradeable, **UUPS proxy** (same toolchain as predecessor: Hardhat, validate-upgrade
  → upgrade scripts, Chiliscan verification via Routescan's keyless Etherscan-compatible API).
- Roles: `owner` = **`0x47103b0FC04c91Ac388eaE3c4f91D038CBfD9CF8`** — a single
  hardware-backed key, never in CI, never hot (decided §21-D5; multisig rejected as
  ceremony for a solo operator — the contract structurally caps owner power instead:
  on-chain freeze recomputation, pause-gated post-finalization corrections, 180-day
  locked emergency withdrawal, separated oracle key). `RESULT_ORACLE_ROLE` (relayer,
  low-value, rotatable). `feeRecipient` defaults to the owner wallet
  (`setFeeRecipient` exists if that changes). Not called out in the T&Cs beyond the
  generic smart-contract-risk clause (owner's call).
- Two stages as first-class state: per-stage pools, entry windows, freezes and claims.

### 10.2 Gas efficiency — beat the World Cup contract

The predecessor's dominant cost was **`batchSettleUserPoints`**: admin-paid loops
writing one storage slot per user per match (~20k gas each; O(users × matches) ≈
hundreds of settlement writes per matchday). v3 deletes the whole concept:

| | World Cup (v2) | ₵h@mpi0nz (v3) |
|---|---|---|
| Result recording | `setMatchResult` (admin tx) | `pushResult` (oracle tx, packed, ~100k gas) |
| Point settlement | `batchSettleUserPoints` per match, O(users) storage writes + `userMatchSettled` guard slot per user-match | **None.** Points are a pure function of (predictions, results) computed at read/claim/freeze time |
| Leaderboard freeze | Admin submits full ranked array, on-chain order check | `freezeStage` submits top-20 only; contract **recomputes those 20 wallets' points on-chain** (bounded loop) and verifies §5.3 ordering + membership. **Not fully trustless re: maximality** (an owner could submit a validly-ordered non-maximal set) — mitigated by public scores + a 24h freeze→claim **challenge window** and a paused-only `refreezeStage` cure path (SECURITY_FINDINGS H-2b). Under the single-owner trust model (ADR-0005) this is an accepted, documented posture, not a merkle-proven guarantee |
| Claim | `claim()` | `claim(stage)` — verifies against frozen rank, one transfer |
| Admin/oracle txs, whole season | ~2 + N-batches per match × 189 matches + ops | **~1 per match** (189 oracle txs) + 2 freezes |

Additional v3 disciplines: predictions stay bit-packed in a single `uint256` per
user-match (predecessor layout, extended with a tie-advancer field); results packed
into one slot; matchday **batch prediction submission** (one tx, calldata-packed, up to
18 matches); custom errors everywhere; events over storage for anything the UI can
index; `unchecked` arithmetic where provably safe; no strings in hot paths (`bytes3`
team codes, as predecessor).

Chiliz note: the chain now runs Cancun/Pectra (v2.8.1 hardfork, 30 Jun 2026) including
**EIP-7702** — batching/sponsored-gas UX is a flagged *opportunity* (e.g. one-click
enter+predict), not a launch dependency.

### 10.3 Storage sketch

```solidity
struct Match { uint40 kickoff; uint8 phase; uint8 status; bytes3 teamA; bytes3 teamB;
               uint16 tieId; bool decider; }          // 1 slot
struct Result { uint8 scoreA90; uint8 scoreB90; bool extraTime; bool penalties;
                uint8 advancer; uint8 status; uint40 provisionalUntil; }   // 1 slot
mapping(address => mapping(uint16 => uint256)) predictions;   // packed, 1 slot each
mapping(uint16 => Result) results;
// per stage: pool, entryCount, frozen top-20, claimed bitmap
string public resultSourceRef;   // transparency pointer, owner-updatable (§7.2)
```

### 10.4 User gas reality check

Chiliz minimum gas price is **2,501 gwei** (2,500 base + 1 priority; EIP-1559 live
since Dragon8). A packed 18-match batch submission ≈ 450k gas ≈ **1.1 CHZ ≈ $0.05** —
so "edit your prediction, just re-pay gas" genuinely costs cents. Put this number in
the UI copy to defuse fee anxiety.

## 11. Wallet & chain compatibility

- **Socios.com Wallet support is mandatory** (per
  [docs.chiliz.com — integrate Socios.com wallet](https://docs.chiliz.com/develop/advanced/integrate-socios.com-wallet-in-your-dapp)):
  it is a smart-contract account — the dApp **MUST support ERC-1271**
  (`isValidSignature()`), branching contract-vs-EOA on any signature check. The
  predecessor's dual-path verifier (`src/app/api/profile/route.ts`) is reused verbatim.
- Supported methods are only `eth_sendTransaction`, `eth_signTransaction`,
  `personal_sign` — **no `eth_signTypedData(_v4)`**. Nothing in the product may depend
  on typed-data signatures (no permit-style flows).
- Write-confirmation pattern for SCWs: poll chain state for the effect (prediction
  present / entry recorded) with a ~120s window — never await a tx receipt that may
  arrive via WalletConnect relay (predecessor `usePredictions.ts` pattern).
- Never overwrite `window.ethereum`; pick from `window.ethereum.providers`.
- Stack: wagmi v2 + viem v2 + **Reown AppKit**, with Socios.com Wallet surfaced via
  `explorerRecommendedWalletIds`. Test on Spicy (88882) before mainnet (88888).

## 12. Telegram

- **Public channel** (results + hype): bot posts — entry-window milestones, T-75min
  lock reminders, per-matchday results + points summaries, leaderboard movements,
  provisional→final corrections, payout announcements, API-degraded notices.
- **Linked discussion group** (community + feedback): replaces the predecessor's
  in-app feedback feature entirely. Pinned formats for bug reports / rule questions.
- **Private ops channel**: oracle alerts + daily heartbeat (§8.3).
- **Account linking (optional, at sign-up):** profile screen offers *"Link Telegram"* →
  deep link `t.me/<bot>?start=<one-time-code>` → bot resolves code → stores
  `telegram_user_id` against the wallet in `clp_user_profiles` → auto-invites to the
  group. Used for personal nudges ("your MD5 slate is empty!"). Strictly opt-in, one-tap unlink.
- Free-tier compliance: Bot API is free; respect 20 msg/min per channel (batch matchday
  posts into digests). Bot token in GitHub Actions secrets / Vercel env — never in the repo.

## 13. Sign-up, profiles & Supabase

### 13.1 Sign-up flow

1. Connect wallet (Reown AppKit; Socios wallet first-class).
2. Pay entry (Full Season 1,100 CHZ until MD1; thereafter Knockout 550 CHZ — the shop
   is never closed, §4.1).
3. **Set username + country (required)** — the leaderboard renders flag + username, so
   it feels alive from day one. Usernames unique per chain, profanity-filtered.
4. **Optionally link Telegram** (§12). Skippable, re-offerable later.

### 13.2 Supabase (existing free project, clearly labelled tables)

All tables live in the **existing predictor Supabase project** (free tier allows only
2 active projects; reuse also keeps the project warm past the 7-day auto-pause). Every
table is prefixed **`clp_`** and carries
`COMMENT ON TABLE … IS 'ChampionsLeague predictor'` so future cleanup is one query:

| Table | Purpose |
|---|---|
| `clp_user_profiles` | wallet, chain_id, username, country_code, telegram_user_id/handle (nullable), entry_tier (`full_season` \| `knockout`), timestamps |
| `clp_match_cache` | on-chain matchId ↔ uefaMatchId ↔ footballDataTeamIds, kickoff, status, cached score JSON |
| `clp_leaderboard` | per-stage points cache (read-model; chain is truth) |
| `clp_oracle_log` | relayer runs, results pushed, corrections, alerts (feeds admin console + heartbeat) |
| `clp_tg_link_codes` | one-time Telegram linking codes, TTL'd |

RLS: public read; writes via service-role key only (server routes / relayer). Rate
limiting per wallet on profile writes (predecessor's DB-backed pattern). Free-tier
budget: 500 MB DB / 5 GB egress is ample — the leaderboard cache is a few thousand rows.

## 14. Design & branding

- **Style guide, not spec:** the attached `ucl-predictor.html` mock defines the *look*
  — deep-navy "European nights" palette (`--night #060A1A`, glow blue `#2E6BFF`, CHZ
  pink `#FF1257`, star gold `#F6C76A`), Archivo display / Inter body / Space Mono data,
  ambient starfield, glowing scoreboard steppers with ▲▼, pill badges, stat strips with
  accent top-bars, generous uppercase display type. Features and copy in that file are
  illustrative only — **the real feature set is this PRD**.
- **Footer credit (required):** `Design inspired by BigMac Bobby` — visible in the
  standard footer, all pages.
- Semantic CSS-variable tokens from day one (redesign-repo discipline): palette lives
  in tokens, components consume tokens, no hardcoded hexes in components. Tailwind v4
  — and per Fanbet's 2026-05-29 incident: `postcss.config.mjs` **and** the
  `@source`-bearing `globals.css` are both load-bearing; never delete either.
- Real interactive elements (`<button>`, `aria-pressed` on toggles — the mock's `.chk`
  pattern already does this), `prefers-reduced-motion` respected (mock does; keep it).
- Accessibility gate: contrast-check the glow-on-navy combos (AA minimum).

## 15. Terms & conditions — funnier, still binding

The predecessor set the bar ("*Lowest wallet address (because computers enjoy
order)*" as a tie-break; "*If you're looking for guaranteed profits, this probably
isn't for you*"). v3 must be **funnier and still legally valid**:

- Keep every load-bearing clause: skill-based competition (not bookmaking — no odds,
  no house edge on outcomes), 60-min lockout, edits allowed until lockout (gas on you),
  non-refundable entries, provisional-result window, smart-contract risk disclosure,
  "the blockchain is public — your predictions are visible to rivals", eligibility/geo
  responsibility, UEFA non-affiliation (**mandatory**: not endorsed by or associated
  with UEFA; club names/crests property of their owners), BigMac Bobby design credit.
- Humor direction (drafting notes): the 90-minute rule as a support-ticket pre-emption
  (*"Yes, it went to extra time. No, we don't care. Rule 5.1 has been waiting for your
  email."*); the mirror-UEFA rule (*"If UEFA awards it 3-0 at a green table, that's the
  score. Take it up with Nyon."*); the two-pronged entry as aviation classes
  (*"Latecomers board at the knockout gate; there is no legroom difference, only fewer
  matchdays"*); the oracle (*"Results are set by a robot reading UEFA's own data. The
  robot does not take bribes; it doesn't even take weekends."*); keep the
  wallet-address tie-break joke — it's canon.
- **Six locales (§21-D10):** the humour is **adapted per locale, not translated** —
  each language gets jokes that land natively while the legal substance stays
  byte-equivalent in meaning. This is the single most expensive T&C consequence of the
  6-locale decision; budget it in the August content crunch.
- Process: draft with counsel-grade structure, then a dedicated per-locale humor pass;
  edge cases (abandonments, sanctions, withdrawals) are now settled by the
  mirror-UEFA rule (§8.2).

## 16. Security program

### 16.1 Adversarial pentest loop (cross-model)

1. **Design & implement** the contract with the primary model (Claude, this workspace),
   full unit + fuzz tests.
2. **Red team with a different model:** hand the frozen source + ABI + deployment
   config to a *different* model in a fresh context with an attacker persona and zero
   access to the design rationale. Deliverable: findings with PoC sketches, severity-ranked.
3. **Resolution loop:** every finding goes back to the designer model → fix + test →
   red team re-attacks the diff. Repeat until **two consecutive clean rounds**.
4. Every accepted finding + fix is logged in `SECURITY_FINDINGS.md` (the new Audit.MD),
   which doubles as the regression checklist for future upgrades.

### 16.2 Known-weakness & past-hack scan

- Static analysis: **Slither** (zero high-severity gate), Snyk on the app code
  (`snyk_code_scan` per global rules), `npm audit` in CI.
- Checklist sweep against known exploit classes: reentrancy, oracle manipulation &
  single-source trust, front-running (predictions are plaintext — inherited accepted
  risk M-06, mitigated by lockout), access control, UUPS pitfalls (uninitialized impl,
  storage-gap collisions), unbounded loops / DoS (freeze loop is bounded at 20),
  precision & rounding (floor + dust-to-first), signature replay (ERC-1271 path),
  exact-value enforcement, griefing via dust transfers (no receive/fallback — predecessor L-04).
- Review against real prediction-market/staking incidents (oracle-feed manipulation and
  admin-key compromise being the two relevant families → oracle role separation + owner
  multisig recommendation).
- Predecessor regression baseline: all 18 Audit.MD findings (H-01…L-06) re-checked
  against v3 explicitly.

### 16.3 Operational security

- Secrets: oracle key (low-value, gas-only) in GitHub Actions secrets; owner key in a
  hardware/multisig setup, never in CI; Supabase service key server-side only; quarterly
  rotation calendar (Fanbet's `SECURITY.md` template).
- Incident runbook: detect → assess funds-at-risk → `pause()` → announce in Telegram
  within 1h → remediate → postmortem in `docs/postmortems/`.
- `emergencyWithdraw` with a 180-day locktime carries over (predecessor H-05 fix) —
  and the lock counts from the **pause** (the incident), not from deploy, so recovery
  requires a 180-day visible halt and can never be a fast quiet rug (SECURITY_FINDINGS N-1).
- The contract was hardened through a **cross-model adversarial pentest loop** (§16.1);
  every finding and resolution is logged in [`SECURITY_FINDINGS.md`](../SECURITY_FINDINGS.md).

### 16.4 Geo-fencing (decided §21-D7)

Copy Fanbet's production edge block verbatim: the Vercel `proxy.ts` returns **HTTP
451** for the same 14 jurisdictions (CN, BD, DZ, EG, NP, AF, KP, IQ, IR, AE, ID, VN,
QA, SG), paired with a T&C eligibility self-certification clause. Logged explicitly as
an **engineering mitigation, not legal advice** — it is the precedent already accepted
in the ecosystem, at near-zero implementation cost.

## 17. Ways of working (agent setup)

Copied from the redesign repo's proven setup, adapted:

- **rtk token optimization:** already wired globally
  (`~/.claude/settings.json` PreToolUse Bash hook → `rtk hook claude`; 60–90% token
  savings). **Zero per-project setup** — just verify `rtk --version` works from the new
  repo and keep `@RTK.md` conventions.
- **Automation bash guards:** copy the redesign repo's `.claude/settings.json`
  (allowlist: npm/git/gh/vercel/file tools; ask on `git push --force`, `rm -rf`; deny
  raw curl/wget, cloud CLIs, `.env` reads) and grow a project-local
  `settings.local.json` allowlist as domains appear (uefa.com endpoints,
  crests.football-data.org, api.telegram.org, chiliscan.com). Goal: agents run the
  routine loop unprompted, dangerous ops always ask.
- **Matt Pocock skills** ([github.com/mattpocock/skills](https://github.com/mattpocock/skills)):
  install via `npx skills@latest add mattpocock/skills`, then run
  `/setup-matt-pocock-skills` (choose the **local-markdown issue tracker** + 5-label
  triage vocabulary, exactly as the redesign repo did). **`/grill-with-docs` is
  mandatory** on this PRD before build kick-off and on every contested design decision
  — outputs land as ADRs in `docs/adr/` + a `CONTEXT.md` glossary (single-context
  layout). Also adopt: `tdd` for the contract, `to-issues` to slice this PRD,
  `git-guardrails-claude-code`, `setup-pre-commit`.
- **Model switching policy:** there is no fully automatic per-task model switcher in
  Claude Code, but we approximate one so limits aren't burned on mechanical work:
  - `.claude/agents/*.md` definitions with `model:` frontmatter — **haiku** for
    mechanical chores (data generation, i18n merges, log triage), **sonnet** as the
    default builder, **the top tier (Opus/Fable)** reserved for contract design,
    security review and economics.
  - Workflow scripts pass per-stage `model:`/`effort:` overrides (cheap finders, expensive judges).
  - Session default stays mid-tier; escalate explicitly per task.
- **Repo hygiene** (redesign CONTRIBUTING pattern): protected `main`, branch-per-task,
  `tsc --noEmit && test && build` before PR, rebase-on-main, hot-file awareness, never
  commit `.env.local`. CI on GitHub Actions (free tier).
- **Docs layout:** this `PRD.md` (master) + `PRD.html` (mirror) + `CONTEXT.md` +
  `docs/adr/` (immutable, supersede-don't-edit) + `.scratch/<slice>/issues/` +
  `docs/postmortems/`. CLAUDE.md is the agent entry point (Fanbet's "critical contract
  zones" table pattern: list the functions agents must read before touching).
- **SSR safety** (redesign hard rule): no `Date.now()` / `Math.random()` / unpinned
  `toLocale*()` in render — countdown timers (§6) mount client-side after hydration;
  pin locale `en-US`.

## 18. Deployment, domain & accounts

- **GitHub:** new repo under the personal **Loideroi** account
  (`mark.verdegaal@gmail.com`). Public repo preferred (free unlimited Actions minutes
  for the relayer); contract + relayer live in-repo (`contracts/`, `relayer/`).
  ⚠️ Note: GitHub Actions scheduled workflows auto-disable after 60 days without repo
  activity — the relayer's daily heartbeat commit-free schedule is fine during the
  season, but set a calendar reminder for the winter break.
- **Vercel:** project in the **Loideroi personal (Hobby) account**. Hobby limits
  respected: daily crons only (relayer is on GitHub Actions), 100 GB transfer,
  non-commercial use. Env vars mirror `.env.example`.
- **Domain — pr3dict0r.com (GoDaddy, already purchased):** add the domain to the Vercel
  project first, then in GoDaddy DNS: apex `A @ → 216.198.79.1` (legacy 76.76.21.21
  also works), `CNAME www → cname.vercel-dns.com` (or the per-project
  `*.vercel-dns-01x.com` value Vercel displays — **copy exactly what Vercel shows**),
  and **delete GoDaddy's default parked A record** or verification fails. Propagation
  ≤1h typical. (Nameserver delegation to ns1/ns2.vercel-dns.com only if we later need
  wildcards.)
- **Contracts:** deploy to Spicy (88882) for the full staging pass (including a fake
  "matchday" driven by the relayer against recorded UEFA fixtures), then mainnet
  (88888). Verify on Chiliscan (keyless Routescan API). Proxy address into
  `src/lib/wagmi/contracts.ts`.

## 19. Free-tier service matrix

| Service | Tier | Limit that matters | Our usage |
|---|---|---|---|
| UEFA API via `uefa-api` | free, unofficial | no SLA — see §8.3 | fixtures, live scores, results, standings |
| football-data.org | free | 10 req/min | crests + fallback results source |
| GitHub (Loideroi) | free | Actions: unlimited on public repo; 5-min cron floor; 60-day inactivity auto-disable | relayer cron, CI |
| Vercel (Loideroi) | Hobby | **daily crons only**; 100 GB; non-commercial | frontend + API routes |
| Supabase (existing project) | free | 500 MB DB, 5 GB egress, 2 projects, 7-day auto-pause | `clp_*` read-model tables |
| Telegram Bot API | free | 20 msg/min/channel | channel, group, alerts, linking |
| cron-job.org | free | 1-min granularity, 30s timeout | backup trigger for the relayer |
| Chiliscan / Routescan verify | free | — | contract verification |
| WalletConnect/Reown Cloud | free | project ID | wallet connection |

## 20. Milestones

| # | Milestone | Target |
|---|---|---|
| 0 | ~~PRD grilled~~ ✅ (2026-07-04, §21) → ADRs cut, issues sliced | Jul 2026 |
| 1 | Repo + agent setup (skills, guards, CI, Supabase `clp_` tables) | Jul 2026 |
| 2 | Contract v3 on Spicy + adversarial pentest loop complete | Aug 2026 |
| 3 | UEFA adapter + relayer + breakage alerts live against 2025/26 archive data; `competitionId` confirmed | Aug 2026 |
| 4 | Frontend (BigMac Bobby style) + Telegram bot + sign-up flow + **6-locale content pass (strings, T&Cs, MD1 insights) — the crunch risk** | late Aug 2026 |
| 5 | **League-phase draw → generate matches.json, verify, push on-chain** | 27–31 Aug 2026 |
| 6 | Mainnet deploy, pr3dict0r.com live, entries open | ~1 Sep 2026 |
| 7 | MD1 — first fully automated matchday | 8–10 Sep 2026 |
| 8 | Stage 1 freeze + payout (knockout sales — open since Sep — enter their final-weeks push) | early Feb 2027 |
| 9 | Final in Madrid; Stage 2 freeze + payout; Ultimate ₵h@mpi0n crowned | 5 Jun 2027 |

## 21. Decision log — grilling session 2026-07-04

Eleven decisions locked in a `/grilling`-style session (one question at a time, each
with a recommendation; three answers overrode the recommendation — marked ⚡):

| # | Question | Decision |
|---|---|---|
| D1 | Late league-phase entry? | **Hard close at first MD1 kickoff.** Knockout pass is the latecomer product. |
| D2 | Small-pool handling | **Floor 20 per stage**: below → stage void, full 550 refund (fee incl.); at ≥20 the top-20 split applies. |
| D3 | League Pool payout timing | **Pay immediately after MD8 finalizes** (24h provisional window doubles as dispute buffer); the payout post markets the knockout window. |
| D4 | Knockout window edges ⚡ | **Open at first MD1 kickoff (continuous sales), close at T-60 of the *last* play-off first-leg** (~17 Feb). Final-day joiners can miss ≤ ~7 locked matches (0 pts) — disclosed on the purchase screen. Stake non-refundable from purchase. |
| D5 | Owner key ⚡ | **Single hardware-backed key `0x47103b0FC04c91Ac388eaE3c4f91D038CBfD9CF8`**; structural caps instead of multisig; not called out in T&Cs. |
| D6 | Forfeits / sanctions / withdrawals ⚡ | **Mirror UEFA verbatim** — `score.regular` is truth even for green-table results; `voidMatch` scoped to our own mistakes only. |
| D7 | Geo-fencing | **Copy Fanbet's 14-jurisdiction HTTP-451 edge block** + T&C eligibility clause (engineering mitigation, not legal advice). |
| D8 | Ultimate ₵h@mpi0n prize | **On-chain trophy NFT** (ERC-721, zero funds) + profile crown + hall-of-fame page. |
| D9 | Provisional results display | **Immediate leaderboard movement with ◌ badge**; Telegram posts labelled "provisional" for 24h. |
| D10 | Languages ⚡ | **All 6 predecessor locales at launch** (en, es, fr, it, pt-BR, tr). Accepted risk: 6× content in the August crunch; T&C humour adapted per locale. |
| D11 | AI Match Insights | **Kept, automated per-matchday**: en generation from UEFA data → 5-locale translation via merge tooling; empty-safe component so insights may lag fixtures. |

### Still open (build tasks, not decisions)

1. Lock the exact field names against one **live** `match.uefa.com/v5` payload
   (typings are community-maintained; `competitionId=1` and the `score.*` shape are
   confirmed from UEFA's own URLs + the package types, but a real response may carry
   extra/renamed fields).

## 22. Acceptance criteria (launch gate)

- [ ] Full Season entry (1,100 CHZ) and Knockout entry (550 CHZ) enforced exactly on-chain; fees (100/50) land at `feeRecipient`.
- [ ] A complete matchday settles end-to-end (result → provisional → finalize → leaderboard → Telegram post) with **zero human actions**.
- [ ] An AET match from archive data scores on the **90-minute** score (`score.regular`), with correct ET/pens/advancer bonuses on deciders.
- [ ] A deliberately corrupted feed response triggers a Telegram admin alert within one poll cycle; a wrong score is corrected via `correctResult` inside the window and the leaderboard self-heals.
- [ ] Prediction editing: submit → edit → verify overwrite on-chain → lock at T-60min, all through the UI, from a Socios.com Wallet (ERC-1271, Spicy).
- [ ] Total oracle gas for a simulated 18-match matchday ≤ 10% of the predecessor's equivalent settle cost for 100 users (measured, in the repo).
- [ ] Adversarial pentest loop: two consecutive clean rounds; Slither zero high-severity; Snyk clean; 18-item predecessor regression checklist green.
- [ ] Sign-up captures username + country; leaderboard shows flags; Telegram linking round-trips.
- [ ] All Supabase tables `clp_`-prefixed + commented `ChampionsLeague predictor`.
- [ ] Stage-void floor works on Spicy: a stage locked with 19 entrants refunds all 550s in full.
- [ ] Knockout purchase screen during the play-off first-leg window lists already-locked matches before payment.
- [ ] Geo edge block returns HTTP 451 for the 14 Fanbet jurisdictions.
- [ ] Ultimate ₵h@mpi0n trophy NFT mints to the Season View winner on Spicy.
- [ ] All 6 locales render (UI strings + T&Cs + at least MD1 insights); non-translatable fields byte-identical across locales.
- [ ] Footer credit "Design inspired by BigMac Bobby" present; T&Cs reviewed as legally coherent **and** measurably funnier in every locale (at least one new joke per section, adapted not translated; tie-break joke preserved).
- [ ] pr3dict0r.com resolves to the Vercel production deployment over HTTPS.

---

*Master file. Update me first, mirror to PRD.html second. — ₵h@mpi0nz Pr3dict0r, v1.1.0*
