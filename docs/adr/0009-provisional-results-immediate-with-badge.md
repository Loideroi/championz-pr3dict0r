# ADR-0009 — Provisional results move the leaderboard immediately, with a badge (D9)

Status: accepted · 2026-07-04 · PRD §8.2, §21-D9

## Context

Results sit provisional for 24h before finalizing. The leaderboard must pick a posture
during that window, and it determines what the Telegram bot posts on match nights
(minutes after full-time).

## Decision

Points and rankings update within minutes of full-time, marked with a ◌ provisional
badge that clears at finalization. Telegram posts carry a "provisional" label for the
window.

## Consequences

Match night stays the engagement moment; the product never feels slower than a
newspaper. Rare corrections self-heal automatically (lazy scoring), and the badge
pre-answers "why did my rank change". Rejected: freeze-until-final (kills the live
loop), dual live/official views (two truths on one leaderboard confuse more than a
badge ever will).
