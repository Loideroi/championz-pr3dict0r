# ADR-0011 — Match Insights kept, generated per matchday (D11)

Status: accepted · 2026-07-04 · PRD §7.5, §21-D11

## Context

The predecessor's per-match AI preview blurbs were a genuine engagement
differentiator, but with six locales (ADR-0010) and 189 matches — knockout fixtures
only existing after mid-season draws — they are a recurring content pipeline, not a
one-off batch.

## Decision

Keep the feature, automation-first: generate insights per matchday in English from
UEFA stats/standings data using the predecessor's workflow, translate to the other
five locales with the merge tooling, ship a few days before each matchday. The
rendering component is empty-safe — a match without an insight renders nothing.

## Consequences

Insights may lag fixtures (they always will for knockout rounds) without breaking
anything. One repeatable command per matchday, ideally scheduled. Rejected: dropping
insights (cuts against the 6-locale richness bet), one upfront league-phase batch
(stale by January, knockout dark).
