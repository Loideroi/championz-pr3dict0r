# STATUS — ₵h@mpi0nz Pr3dict0r

**Last updated:** 2026-07-05. Single source of truth for "where are we / what's next".
See also: [`PRD.md`](./PRD.md) (spec), [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md)
(PRD §22 gate), [`SECURITY_FINDINGS.md`](./SECURITY_FINDINGS.md) (pentest log),
[`contracts/deployments.md`](./contracts/deployments.md) (live addresses).

## Where we are: BUILD COMPLETE, live on mainnet, awaiting launch cutover

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

## NEXT STEPS — all owner-gated (irreversible / real-money / your accounts)

Ordered by the recommendation given to the user. None are code work; the build is done.

1. **Fund the mainnet oracle `0xB57C…` with CHZ gas** (⚠ silent-failure risk).
   Without gas it cannot push results. Send ~50–100 CHZ from `0x4710…` to `0xB57C…`.
   Owner action (or Claude can prep a one-liner). **Not urgent until fixtures exist
   (post-27-Aug draw), but easy to forget.**

2. **Vercel production + pr3dict0r.com DNS** — gives the live mainnet contract a UI.
   - New Vercel project (Loideroi Hobby account) from this repo.
   - Prod env: `NEXT_PUBLIC_PREDICTOR_ADDRESS=0x742c6963a81012bc7949F0058Fba07c8d1A80c4d`,
     `NEXT_PUBLIC_CHAIN_ID=88888`, `NEXT_PUBLIC_RPC_URL=https://rpc.ankr.com/chiliz`,
     plus the WalletConnect/Supabase/Telegram values from `.env.local` (mainnet where
     applicable). See `.env.example`.
   - DNS (GoDaddy → Vercel): add domain in Vercel first, copy the exact records it
     shows — apex `A @ → 216.198.79.1` (or the value Vercel shows), `CNAME www →
     cname.vercel-dns.com` — and **delete GoDaddy's default parked A record**.

3. **Telegram public channel + community group** (5 min, reversible). Create both, add
   `@Chmpi0nz_Pr3dict0r_bot` as admin (channel: Post Messages; group: Invite via Link),
   then set repo Actions variables `TELEGRAM_CHANNEL_ID` (@handle) and
   `TELEGRAM_GROUP_ID` (-100… — send a group message, Claude reads it via getUpdates).
   Bot privacy mode off (`/setprivacy` → Disable) if the group needs message reads.

4. **Socios.com Wallet end-to-end test on Spicy** — connect → enter → predict → edit,
   exercising the ERC-1271 path no simulation covers. **Do before the 6 Jul staging
   league close** (Spicy proxy `0xAE32…83D6`).

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

- **Daily 07:07 UTC oracle heartbeat** DM to the admin (Telegram).
- **7–8 Jul: staging self-settlement** — the oracle-bot cron settles the 4 Spicy
  matches (archived AET/pens classics) hands-off — the "zero maintenance" demo.
