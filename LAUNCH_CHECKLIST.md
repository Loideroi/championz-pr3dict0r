# Launch checklist — ₵h@mpi0nz Pr3dict0r (PRD §22 gate)

The go-live sequence. ✅ = done & verified · 🔵 = automated, running · 👤 = **needs the
owner** (a human action or an irreversible/real-money step Claude will not take alone).

## Contract & security

- ✅ Contract v6 on Spicy with the full economics, scoring, freeze/claims, admin console
  and security hardening. Every slice's tests green (43 contract tests).
- ✅ Cross-model adversarial pentest loop complete — see [`SECURITY_FINDINGS.md`](./SECURITY_FINDINGS.md).
  All Critical/High findings fixed or accepted-with-mitigation; the disputed C-1
  solvency claim is disproven by a dedicated test.
- ✅ Slither 0.11.4: no high-severity class (`reentrancy-eth`/`uninitialized-state`/
  `suicidal`/user-controlled `arbitrary-send`). Remaining detectors reviewed & accepted.
- ✅ Snyk on app code: 0 issues.
- ✅ Predecessor `Audit.MD` 18-finding regression re-checked (all green; H-05 emergency
  withdrawal added this slice).
- 👤 **Mainnet deploy** — from a **fresh owner-key ceremony** (NOT the Spicy deployer
  `0x4710…`, which is staging only per ADR-0005). Claude will prepare the exact
  `deploy.ts` invocation but will **not** broadcast to mainnet without your explicit go.

## Economics gate (PRD §22)

- ✅ Full Season 1,100 / Knockout 550 enforced exactly; 100/50 fees escrowed → forwarded at lock.
- ✅ Floor-20 void + full-refund-including-fee; solvency holds across mixed void/lock (tested).
- ✅ 90-minute-rule scoring; two-legged decider bonuses; §5.3 tie-breaks incl. the wallet joke.
- ✅ Freeze recomputes top-20 on-chain + 24h challenge window before claims (H-2b).
- ✅ Ultimate ₵h@mpi0n trophy NFT (zero funds).

## Automation gate

- ✅ Oracle relayer settles a matchday hands-off (proven against archived data).
- 🔵 GitHub Actions cron live — **staging self-settlement scheduled 7–8 Jul** (the
  "zero human actions" acceptance test, running on real Spicy).
- ✅ Breakage detection + Telegram alerts + daily heartbeat (heartbeat DM delivered live).
- ✅ Degraded-mode manual-results fallback via workflow_dispatch.

## Compliance & content

- ✅ Geo-fence: HTTP 451 middleware for the 14 jurisdictions (ADR-0007) + T&C clause.
- ✅ T&Cs in six locales, legally coherent + funnier (parity-tested).
- 🔵 App i18n wiring (six locales across every route) — in progress on `feat/i18n-wiring`.
- ✅ Match Insights pipeline (six locales, empty-safe).
- ✅ Footer: "Design inspired by BigMac Bobby"; UEFA non-affiliation everywhere.

## Infrastructure

- ✅ Supabase `clp_` tables applied; keys set (owner done).
- ✅ Telegram bot token + admin chat id; Actions secrets/vars set.
- 👤 **Telegram public channel + community group** — create, add the bot as admin,
  set `TELEGRAM_CHANNEL_ID` / `TELEGRAM_GROUP_ID`. (5 min; instructions in chat.)
- 👤 **Vercel production project** in the Loideroi Hobby account + production env vars
  (mirror `.env.example`, mainnet values).
- 👤 **pr3dict0r.com DNS** — GoDaddy → Vercel: add the domain in Vercel first, copy the
  exact A/CNAME records it shows, **delete GoDaddy's parked A record**. Claude will
  give the exact records but will **not** touch your live domain without your go.

## Final human sign-offs (only the owner can do these)

- 👤 Socios.com Wallet end-to-end on Spicy (connect → enter → predict → edit → the
  ERC-1271 path no simulation covers) — **before the 6 Jul staging league close**.
- 👤 Watch the 7–8 Jul cron self-settlement + the daily heartbeat DM.
- 👤 Approve the mainnet deploy + DNS cutover, then walk this list top-to-bottom on prod.
