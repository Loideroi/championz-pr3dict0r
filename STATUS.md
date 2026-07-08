# STATUS — ₵h@mpi0nz Pr3dict0r

**Last updated:** 2026-07-05. Single source of truth for "where are we / what's next".
See also: [`PRD.md`](./PRD.md) (spec), [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md)
(PRD §22 gate), [`SECURITY_FINDINGS.md`](./SECURITY_FINDINGS.md) (pentest log),
[`contracts/deployments.md`](./contracts/deployments.md) (live addresses).

## Where we are: BUILD COMPLETE + LAUNCHED — live on mainnet at pr3dict0r.com

All 16 build slices are implemented, tested, and merged to `main` (PRs #1–#18).
The security-hardened v6 contract passed a 5-round cross-model pentest loop (clean
sign-off) and is **deployed + verified on Chiliz mainnet**.

### Live contracts (see contracts/deployments.md)

| | Mainnet (88888) | Spicy staging (88882) |
|---|---|---|
| **Predictor proxy** | **`0x742c6963a81012bc7949F0058Fba07c8d1A80c4d`** | `0xAE32d62B71DD1f6Eb4f27fC65Facc69AcFEe83D6` |
| Impl (v6, verified) | `0xD8d86bbfF76ce138eFC91C768dC6c350AF2728Af` | `0x45d2…6f86` |
| Trophy NFT | not yet deployed | `0xFe6112BFBA2Ec16ddA0E4b079865d7A7d0892F02` |
| Owner / feeRecipient | `0x47103b0FC04c91Ac388eaE3c4f91D038CBfD9CF8` | same |
| Oracle (RESULT_ORACLE_ROLE) | `0xB57Cb421E3B707d0970Ec758D40a4366DB317B15` | same |
| League sales | **OPEN** → close 2026-09-08 16:45 UTC | staging windows |
| Knockout sales | 2026-09-08 → 2027-02-17 20:00 UTC | staging windows |

- Repo: https://github.com/Loideroi/championz-pr3dict0r (public, **Loideroi** account —
  `mark_chilizgr` is an EMU and cannot PR here).
- `main` is protected; required checks `app`+`contracts`+`relayer`; merge via
  auto-merge + `gh pr update-branch` (no merge queue → the babysitter loop pattern).

## LAUNCH CUTOVER — status (updated 2026-07-06)

1. ✅ **Mainnet oracle funded** — `0xB57C…7B15` holds **100 CHZ** on mainnet (verified
   on-chain 2026-07-06). Enough for hundreds of result pushes at 2,510 gwei.

2. ✅ **Vercel production + pr3dict0r.com LIVE** — **pr3dict0r.com loads** (owner-confirmed
   2026-07-06). Project `championz-pr3dict0r` on the **Loideroi personal** Vercel scope
   `markverdegaal-gmailcoms-projects` (⚠ NOT chiliz-group — the `vercel` CLI defaults to the
   wrong work identity; `vercel login` as mark.verdegaal@gmail.com first). GitHub-connected
   → auto-deploys on merge to `main`. **11 production env vars**: 8 public (chain 88888,
   predictor `0x742c…`, ankr RPC, WalletConnect, Supabase URL+anon, bot username) + 3 secrets
   (`SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` — the last is
   new, not in `.env.local`). Deployment Protection OFF (fully public — informed owner choice
   despite live sales + no fixtures until the draw). GoDaddy DNS: `A @ → 216.198.79.1`,
   `CNAME www → cname.vercel-dns.com`, parked record removed.

3. 🟡 **Telegram** — public channel **@championz_pr3dict0r** created, bot
   `@Chmpi0nz_Pr3dict0r_bot` added as **admin** (for a channel you add the bot as admin
   directly — there is no join step). Ops alerts route to the owner DM
   `TELEGRAM_OPS_CHAT_ID=2055709055`. **Still to do:** the community **group** (create → add
   bot admin → set `TELEGRAM_GROUP_ID` Actions var); an optional separate ops/private channel
   (not required — ops already DMs the owner).
   - ⚠️ **`TELEGRAM_CHANNEL_ID` Actions var is deliberately REMOVED** so the 7–8 Jul staging
     self-settlement demo stays out of the public channel. **RE-ADD
     `TELEGRAM_CHANNEL_ID=@championz_pr3dict0r` before the real season (post-draw, pre-MD1)
     or the channel will stay silent.**

4. 🔲 **Socios.com Wallet end-to-end test** — connect → enter → predict → edit, exercising
   the ERC-1271 path no simulation covers. Do it on the live mainnet `/enter` before real
   users arrive (the pre-6-Jul Spicy-staging window has now passed).

## Post-deploy owner tasks for the REAL tournament (later, not launch-blocking)

- After the **27 Aug 2026 league draw**: `cd relayer && node scripts/generate-matches.mjs
  --season 2027 --out …` → `verify-fixtures.mjs` → `addMatches` + `setTies` on the
  mainnet proxy via `/admin` (owner wallet). Until then the contract sits in SELLING
  with no matches (correct).
- Confirm/adjust the exact window timestamps via `setStageWindow` (owner, while
  SELLING) once UEFA publishes precise kickoff times.
- Update the mainnet `oracle-bot.yml` env `PREDICTOR_ADDRESS` to the mainnet proxy and
  fund the oracle (item 1) before MD1.
- If reconsidering the early-open decision: `pause()` or `setStageWindow` to defer the
  league open are available to the owner.

## Known follow-ups / tech debt (non-blocking)

- **InsightCard is a placeholder** — the on-chain slate (`lib/predictor/slate.ts`)
  carries only internal match ids, not `uefaMatchId`, so `/insights/<locale>.json`
  never matches. Thread real `uefaMatchId` through the slate to light insights up.
- **oracle-bot workflow** currently targets the **Spicy** address + runs the staging
  self-settlement demo (7–8 Jul). Add/point a mainnet job before the season.
- **GitHub merge queue** would replace the manual `update-branch` + auto-merge
  babysitter loop (every merge re-stales other open PRs under strict protection).
- **Recurring CI gotchas** (see memory): contract PRs need `contracts/package-lock.json`
  regenerated + both OZ packages EXACT-pinned `5.0.2` (caret → 5.6.1 pulls Cancun
  `mcopy` > Shanghai); new parent contracts need their `__X_init()` in `initialize()`;
  root-app lockfile drift needs a clean `rm -rf node_modules package-lock.json && npm i`.

## Automation running on its own

- **Daily 07:07 UTC oracle heartbeat** DM to the admin (Telegram), now with an
  oracle-gas battery line (🔋/🪫).
- **Oracle balance watch** (every cron tick, both chains): Telegram warning when
  the oracle key drops below 20 CHZ (`ORACLE_MIN_CHZ`), ≤1 warning/chain/24h.
- **Ops sentinels** (every cron tick, both chains, same dedupe):
  - governance drift — owner()/oracle()/EIP-1967 impl slot vs expected + paused()
    (⚠ update `EXPECTED_IMPL` in oracle-bot.yml on every legitimate upgrade);
  - solvency invariant — balance ≥ unfrozen pools + fee escrow (exploit tripwire);
  - site uptime (mainnet step) — pr3dict0r.com + profile API;
  - seasonal deadlines — entrant floor <20 in the last 14 days before league
    close; fixtures missing after the 27 Aug draw (doubles as the reminder to
    re-add `TELEGRAM_CHANNEL_ID`); fully-played-but-unfrozen stage (daily --deep).
- **7–8 Jul: staging self-settlement** — the oracle-bot cron settles the 4 Spicy
  matches (archived AET/pens classics) hands-off — the "zero maintenance" demo.
