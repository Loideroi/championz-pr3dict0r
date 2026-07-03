# 10 — Telegram community bot & account linking

Status: ready-for-agent
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
