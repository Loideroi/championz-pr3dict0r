# STATUS — ₵h@mpi0nz Pr3dict0r

**Last updated:** 2026-08-28 (post-draw fixture import in flight). Single source of truth for "where are we / what's next".
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
| Impl (v7, verified) | `0x09FeC2eA6f5a1EeA5171cb0ffBC65Dcf76ed72f6` | `0x888e…bBd7` |
| Trophy NFT | **`0x5f990aD689d2c1B33604AdABB38d40Ab496845AB`** | `0xFe6112BFBA2Ec16ddA0E4b079865d7A7d0892F02` |
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

3. ✅ **Telegram — fully wired 2026-08-28.** Public channel **@championz_pr3dict0r**
   (id `-1003940503748`, bot admin, post-message test OK) → Actions var
   `TELEGRAM_CHANNEL_ID=-1003940503748` re-added (oracle-bot posts results digests +
   T-75 reminders there). Community **supergroup** "₵h@mpi0nz Pr3dict0r — Community"
   (id `-1004494559812`, bot admin with invite rights; the earlier plain group
   `-5380283657` was auto-migrated to it) → `TELEGRAM_GROUP_ID=-1004494559812` set as an
   Actions var **and** in Vercel production (the webhook route hands out one-person
   invites on wallet link). The production **webhook was never registered** before —
   `getWebhookInfo` showed no URL, so "Link Telegram" could not work; it is now
   registered at `https://pr3dict0r.com/api/telegram/webhook` (secret_token =
   `TELEGRAM_WEBHOOK_SECRET`, rotated in Vercel at registration time; `allowed_updates:
   message`). Ops alerts + heartbeat still DM the owner (`TELEGRAM_OPS_CHAT_ID=2055709055`).
   Owner to-do: pin the welcome post in the channel; link the group as the channel's
   Discussion; round-trip "Link Telegram" from /profile once.

4. 🔲 **Socios.com Wallet end-to-end test** — connect → enter → predict → edit, exercising
   the ERC-1271 path no simulation covers. Do it on the live mainnet `/enter` before real
   users arrive (the pre-6-Jul Spicy-staging window has now passed).

## ✅ LEAGUE-PHASE FIXTURES ON-CHAIN — 2026-08-29 (pushed a day early)

UEFA published the schedule in batches on Sat 29 Aug (12:06–13:36 UTC). Same afternoon:
`generate-matches` → `verify-fixtures` (0 discrepancies) → mainnet **dry run** → `CONFIRM=1
PAUSE=1` push: pause → 8 × `addMatches` (ids 1–144, 4.42M gas ≈ 11.1 CHZ) → all 144 read back
exactly → unpause. Independent `verify-onchain.mjs`: 0 discrepancies. First kickoff
2026-09-08T16:45Z == league close (D1 holds, no window change). 49 entrants at push time.
`lib/fixtures/matches.json` + `relayer/config/mainnet-map.json` (144 entries) committed —
oracle-bot tracks the season from the next cron tick. Txs: `0xef61…f294b` (MD1) …
`0x4e93…2b2f` (MD8). **Knockout rounds + `setTies` follow the February draw** (same
scripts, `EXPECT_MATCHCOUNT=144`). MD1 Match Insights generated 2026-08-29 into
`public/insights/<locale>.json` (144 keys × 6 locales; regenerate before each matchday —
`generate-insights.mjs --season 2027 --out public/insights` — so form/table lines appear).
Club crests: the bundle carries UEFA's own crest URL per team; `TeamCrest` renders it with
a monogram fallback (`<img onError>`, PRD §7.6) on /play and the /enter disclosure.

## Post-draw fixture import — runbook (kept for the knockout rounds)

State on 2026-08-28 09:11 UTC: **43 Full Season entrants** (21,500 CHZ per pool, contract
solvent at 47,300), `matchCount = 0`, both stages SELLING. The UEFA v5 feed for
`seasonYear=2027` still carried **0 TOURNAMENT-phase matches** (90 qualifying only) —
the draw fixed opponents; the fixture list with dates + kick-off times is published by
UEFA **no later than Saturday 29 August**. Owner decisions: Hardhat script for the owner
txs (same key setup as the deploy / v7 upgrade), **pause-bracketed** push (nobody predicts
on an unverified slate), slate UI shows club names + matchday headers before opening.
Tooling PR: `feat/league-fixtures-import`. **There is no "open predictions" switch** —
matches are predictable the moment they exist on-chain (T-60 lock only); the pause
bracket IS the gate.

1. **Generate + verify against the live feed** (repeat until 144 league matches appear):
   `cd relayer && npm run build && node scripts/generate-matches.mjs --season 2027 --out
   ../lib/fixtures/matches.json && node scripts/verify-fixtures.mjs --matches
   ../lib/fixtures/matches.json --season 2027` → expect `0 discrepancies`, 36 teams,
   phases `{"0":144}` (knockout rounds appear after each later draw). LASK is pinned to
   the bytes3 code `LAS` (`CODE_OVERRIDES` / `--code`). Eyeball the MD-by-MD table.
2. **Rehearse on Spicy** (proxy `0xAE32…83D6`, holds 4 staging matches):
   `cd contracts && PROXY=0xAE32d62B71DD1f6Eb4f27fC65Facc69AcFEe83D6 MATCHES=../lib/fixtures/matches.json
   EXPECT_MATCHCOUNT=4 PAUSE=1 CONFIRM=1 npx hardhat run scripts/add-fixtures.ts --network spicy`,
   then `RPC_URL=https://spicy-rpc.chiliz.com PREDICTOR_ADDRESS=0xAE32… node
   relayer/scripts/verify-onchain.mjs --matches lib/fixtures/matches.json --phase 0 --id-offset 4`.
   (Done 2026-08-28 with the 2025/26 archive season: Spicy now holds ids 5–148, so a
   second rehearsal needs `EXPECT_MATCHCOUNT=148`. Lesson baked in: the public RPC lags
   its own receipts — the script polls `matchCount` per chunk and supports `RESUME=1`.)
3. **Mainnet push (pause-bracketed)** — dry run first, then CONFIRM:
   `cd contracts && PROXY=0x742c6963a81012bc7949F0058Fba07c8d1A80c4d MATCHES=../lib/fixtures/matches.json
   PAUSE=1 npx hardhat run scripts/add-fixtures.ts --network chiliz` (prints the 8 chunks,
   gas ≈ 20 CHZ, and the D1 window check) → same command with `CONFIRM=1`. The script
   pauses, pushes 8 × 18, reads every match back, and **unpauses only if the read-back
   is exact** (otherwise it stays paused — fix via `setMatchTeams` / `batchUpdateKickoffs` /
   `voidMatch` from /admin, then unpause).
4. **Windows (D1):** if the first MD1 kickoff ≠ 2026-09-08 16:45 UTC the script says so →
   `LEAGUE_CLOSE=<unix> KO_OPEN=<unix> CONFIRM=1 npx hardhat run scripts/set-stage-windows.ts --network chiliz`
   (handles the M-3 ordering).
5. **Verify on-chain + wire the oracle:** `RPC_URL=https://rpc.ankr.com/chiliz
   PREDICTOR_ADDRESS=0x742c… node relayer/scripts/verify-onchain.mjs --matches lib/fixtures/matches.json --phase 0`
   → `node relayer/scripts/generate-map.mjs --matches lib/fixtures/matches.json --out
   relayer/config/mainnet-map.json --phase 0` → commit `lib/fixtures/matches.json` +
   `relayer/config/mainnet-map.json` (one PR: names / matchdays / insights light up on prod,
   oracle-bot starts tracking 144 matches). `oracle-bot.yml` already relays **mainnet**.
6. **Owner clicks:** re-add the `TELEGRAM_CHANNEL_ID=@championz_pr3dict0r` Actions var;
   run `generate-insights.mjs --season 2027 --out public/insights` for MD1; announce.

## Known follow-ups / tech debt (non-blocking)

- ~~InsightCard is a placeholder~~ — resolved 2026-08-28: the slate is decorated from
  the bundled `lib/fixtures/matches.json` (names, matchday, `uefaMatchId`); the bundle
  is defensive (used only when it agrees with the chain on both team codes).
- ~~oracle-bot targets Spicy~~ — resolved 2026-08-28: the relay step points at the
  mainnet proxy with `config/mainnet-map.json` (empty until the fixture push); Spicy
  keeps its sentinels + balance watch only. `chain.ts` now signs with the CHAIN_ID's
  chain (a Spicy-signed tx against mainnet would have been rejected by the node).
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
