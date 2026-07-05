# 10 — Telegram community bot & account linking

Status: ready-for-human
PRD: ../../PRD.md §12 · Decision: D9 (provisional labels)

## What to build

The community surface. One free bot serving three rooms: a public channel where it
posts entry-window milestones, last-call reminders about 75 minutes before each kickoff
cluster, matchday results-and-points digests (batched to respect the 20 messages/min
limit), leaderboard movements, provisional→final correction notices, and payout
announcements; a linked discussion group that replaces the predecessor's in-app
feedback feature (with pinned formats for bug reports and rule questions); and the
private ops channel already used by slice 06. Optional account linking at sign-up: the
profile screen offers a deep link (`t.me/<bot>?start=<one-time-code>`), the bot
resolves the code to the wallet, stores the Telegram id, and auto-invites the user to
the group. Strictly opt-in, one-tap unlink, and codes expire.

## Acceptance criteria

- [ ] A settled archive matchday produces one digest post with results, points and provisional labels
- [ ] T-75 reminder fires for a kickoff cluster and names the lock time
- [ ] Link flow round-trips: code issued → bot start → wallet linked → group invite; unlink removes the id
- [ ] Expired or reused link codes are rejected
- [ ] Bot token lives only in env/secrets; posting stays under the per-channel rate limit on an 18-match digest
- [ ] Correction notice posts when a provisional result is amended

## Blocked by

- 05-oracle-relayer.md
- 09-signup-profiles-supabase.md

## Comments

**2026-07-05 — built; needs the operator's channel/group creation to go live.**
- **Channel layer** (`relayer/src/channel.ts` + relay.mjs): one results digest per run
  (FULL TIME + CORRECTED sections, 90′ scores, ET/pens notes, ◌ provisional labels,
  standings link — digest-not-per-match respects the 20 msg/min cap); last-call
  reminder in the (T-75 → T-60] window with oracle-log dedupe (5-min cron would
  triple-post otherwise). Posting skips gracefully until TELEGRAM_CHANNEL_ID exists.
- **Account linking** (strictly opt-in, PRD §12): profile "Link Telegram" → signed
  message (personal_sign, ERC-1271-verified server-side, 10-min freshness) →
  single-use 15-min code in clp_tg_link_codes (service-role only) → deep link →
  `/start <code>` consumed by the webhook route (secret_token-guarded) or the staging
  poller (`relayer/scripts/bot-poll.mjs` forwarding getUpdates to the route);
  telegram_user_id/handle stored on the profile; one-tap unlink clears both. Codes
  burn on use OR expiry (replay-tested). Group invites: one-person
  createChatInviteLink when TELEGRAM_GROUP_ID is set.
- Tests: 7 channel tests (digest shape, null-on-empty, reminder window edges,
  dedupe-ready ids) + 4 link-service tests (burn, replay, expiry, unlink). 73 root +
  66 relayer green.
- **Remaining (operator, ~5 min):** (1) create the public channel, add
  @Chmpi0nz_Pr3dict0r_bot as admin with Post rights, put its @handle in
  TELEGRAM_CHANNEL_ID (env + Actions variable); (2) create the community group, add
  the bot, capture the -100… id into TELEGRAM_GROUP_ID; (3) staging link test: run
  `node relayer/scripts/bot-poll.mjs` beside `npm run dev`, link from /profile, press
  START, confirm the profile row + group invite.
