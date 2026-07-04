# 09 — Sign-up, profiles & Supabase read-model

Status: ready-for-human
PRD: ../../PRD.md §13

## What to build

The identity layer that makes the leaderboard feel alive. After paying an entry, the
user must set a username (unique per chain, profanity-filtered) and a country before
their leaderboard row renders — flags appear from day one. Profile writes are
signature-verified with the dual EOA / ERC-1271 path (contract wallets verified via
isValidSignature, EOAs via ecrecover). All persistence lands in the existing free
Supabase project as `clp_`-prefixed tables, every one carrying the comment
"ChampionsLeague predictor": user profiles, match cache, leaderboard cache, oracle log,
and Telegram link codes. Row-level security allows public reads; all writes go through
the service-role key server-side; profile writes are rate-limited per wallet in the
database (serverless-safe).

## Acceptance criteria

- [ ] Entry → username + country flow is enforced before the leaderboard row displays; flags render
- [ ] Profile update signed by a Socios.com Wallet passes ERC-1271 verification; an EOA passes ecrecover
- [ ] All five `clp_` tables exist with the labelling comment; one SQL query lists them all by comment
- [ ] Anonymous reads work; anonymous writes are rejected by RLS
- [ ] Rapid profile writes from one wallet hit the DB-backed rate limit
- [ ] Duplicate username on the same chain is rejected with a clear error

## Blocked by

- 03-two-stage-economics.md

## Comments

- **2026-07-04 (agent):** Implemented on `feat/signup-profiles`. Migration
  `supabase/migrations/0001_clp_tables.sql` is **authored but NOT applied** — this
  environment has no Supabase credentials by design; the operator pastes it into the
  Supabase SQL editor of the existing predictor project (the file header carries the
  instructions plus the one-query cleanup listing tables by comment).
- **2026-07-04 (agent):** All five `clp_` tables carry
  `COMMENT ON TABLE … IS 'ChampionsLeague predictor'`; RLS = public SELECT, no anon
  write policies (service-role writes only). The rate-limit state (1/30s, 8/hour)
  lives on the `clp_user_profiles` row itself — DB-backed and serverless-safe.
- **2026-07-04 (agent):** Sign-up UI at `/profile`: username + searchable flag-emoji
  country select, human-readable personal_sign message, dual EOA/ERC-1271
  verification server-side, entry tier read from `entered(stage, wallet)` on chain.
  Flags-on-leaderboard integration (rendering these profiles in the leaderboard rows)
  lands with slice 07 — the first acceptance criterion completes there.
