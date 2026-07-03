# ADR-0007 — Geo-fencing: copy Fanbet's 14-jurisdiction edge block (D7)

Status: accepted · 2026-07-04 · PRD §16.4, §21-D7

## Context

The product takes stakes and pays winners; several jurisdictions don't distinguish
skill-based pools from gambling. A full legal review costs money (breaking the
free-only constraint) and weeks (against a hard 8 Sep deadline). Fanbet already ships
an accepted mitigation.

## Decision

Reuse Fanbet's Vercel edge proxy verbatim: HTTP 451 for CN, BD, DZ, EG, NP, AF, KP,
IQ, IR, AE, ID, VN, QA, SG — paired with a T&C eligibility self-certification clause.

## Consequences

Near-zero implementation cost; materially reduced exposure; ecosystem-consistent
precedent. Explicitly recorded as an **engineering mitigation, not legal advice** —
if the project outgrows "fan project on personal accounts", commission the real
jurisdictional read.
