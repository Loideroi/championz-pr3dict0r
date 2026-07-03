# 01 — Repo bootstrap & ways-of-working

Status: ready-for-agent
PRD: ../../PRD.md §17–18 · Decisions: D5, D10 (tooling implications)

## What to build

A new repository under the personal Loideroi GitHub account containing the full project
skeleton, so every later slice lands in a working pipeline from day one: a Next.js app
workspace, a Hardhat contracts workspace, and a relayer workspace; agent tooling copied
from the Socios redesign repo (permission-allowlist bash guards, project settings);
the Matt Pocock skills installed and configured for the local-markdown issue tracker
with the standard 5-label triage vocabulary; CI running type-check, tests and build on
every PR with protected `main`; a CLAUDE.md agent entry point carrying a
"critical contract zones" table placeholder; a CONTEXT.md glossary seeded from the PRD;
and the 11 grill decisions (D1–D11 in PRD §21) recorded as immutable ADRs so later
slices can cite them.

## Acceptance criteria

- [ ] `npm install && npm run dev` serves a hello page; CI (type-check + test + build) is green on a PR
- [ ] `main` is protected; a direct push is rejected
- [ ] `rtk --version` works from the repo; bash-guard settings deny raw curl/cloud CLIs and ask on force-push
- [ ] `/setup-matt-pocock-skills` has been run: issue tracker = local markdown, triage labels documented
- [ ] `docs/adr/` contains one ADR per grill decision D1–D11, each citing PRD §21
- [ ] CLAUDE.md, CONTEXT.md, CONTRIBUTING.md exist and reflect PRD §17
- [ ] No secrets in the repo; `.env.example` lists every required variable

## Blocked by

None — can start immediately.
