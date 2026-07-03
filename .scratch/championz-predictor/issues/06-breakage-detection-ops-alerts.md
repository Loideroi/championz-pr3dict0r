# 06 — Breakage detection & ops alerting

Status: ready-for-agent
PRD: ../../PRD.md §8.3

## What to build

The assumption is that the unofficial UEFA API breaks at the worst possible moment;
this slice makes that loud instead of silent. Schema drift raises a
SOURCE_SCHEMA_CHANGED alert; a match that should have finished more than two hours ago
with no result, or an empty fixtures response on a known matchday, raises SOURCE_STALE.
Alerts go to the admin as a Telegram DM and to a private ops channel, with the failing
endpoint, a payload sample and a runbook link; GitHub Actions failure e-mail is the
second wire. A daily "oracle healthy" heartbeat DM makes silence itself detectable.
On source failure the app shows a degraded-mode banner ("results delayed — leaderboard
will catch up") and the admin console's manual result entry keeps working as the
emergency fallback. Relayer activity persists to an oracle log table so the console
and heartbeat read from history, not memory.

## Acceptance criteria

- [ ] A deliberately corrupted feed response produces a Telegram admin DM within one poll cycle
- [ ] A simulated silent feed (finished match, no result, 2h+) produces a SOURCE_STALE alert
- [ ] Heartbeat DM arrives daily with matches-tracked and next-window summary
- [ ] Degraded-mode banner appears while the source health check fails and clears on recovery
- [ ] Manual result entry from the admin console still settles a match while the feed is down
- [ ] All relayer runs, alerts and pushes are queryable from the oracle log table

## Blocked by

- 05-oracle-relayer.md
