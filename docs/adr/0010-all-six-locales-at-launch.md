# ADR-0010 ⚡ — All six predecessor locales at launch (D10)

Status: accepted · 2026-07-04 · PRD §15, §17, §21-D10 · user decision

## Context

The predecessor shipped en, es, fr, it, pt-BR, tr. Every locale multiplies content
work: UI strings, match insights, and the legally-valid-but-funny T&Cs. The
recommendation was English-only at launch with plumbing kept; the user chose full
reach for the pan-European tournament.

## Decision

Ship all six locales at launch. T&C humour is **adapted per locale, not translated** —
jokes must land natively while the legal substance stays equivalent. Non-translatable
fields (scores, rankings, team codes, timestamps) stay byte-identical across locales,
enforced by tooling. Times remain 24-hour en-GB convention.

## Consequences

Named schedule risk: the 6× content pass lands in the late-August crunch alongside the
draw, mainnet deploy and launch (PRD milestone 4 flags it). Match insights inherit the
same 6-locale pipeline (ADR by extension via D11). Budget content generation as the
critical path, not an afterthought.
