# ADR-0002 — Stage floor of 20 entrants; below → void + full refund (D2)

Status: accepted · 2026-07-04 · PRD §4.3, §21-D2

## Context

The top-20 payout split silently assumes a healthy crowd: with 14 entrants it pays
ranks that don't exist; with 25 nearly everyone wins something. The contract needs an
explicit rule before it is written.

## Decision

If a stage locks with fewer than 20 entrants, the stage is void and every entrant
reclaims their full gross entry — **fee included** (goodwill, tiny cost). At ≥ 20 the
standard top-20 split applies unchanged.

## Consequences

One number, one rule, one T&C sentence. A refund path exists in the contract and must
be tested (19 vs 20 entrants). A September knockout buyer's doomsday refund would
arrive in February — accepted. Alternatives rejected: floor 40 (brutal product outcome
at 35 paid entrants), no floor with renormalized percentages (5-person pools look
absurd, disputes guaranteed).
