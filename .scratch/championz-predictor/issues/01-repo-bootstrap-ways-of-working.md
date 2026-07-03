# 01 — Repo bootstrap & ways-of-working

Status: done (2026-07-04)
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

## Comments

**2026-07-04 — completed.** Repo: https://github.com/Loideroi/championz-pr3dict0r
(public, Loideroi account). Evidence per criterion: dev/build/test/typecheck all green
locally + CI run 28686124459 green; direct-push probe rejected ("protected branch hook
declined") with required status checks `app` + `contracts`, enforce_admins on;
rtk verified; bash guards in `.claude/settings.json`; Matt Pocock skills copied from
the redesign repo into `.claude/skills/` (23 skills) with tracker/triage docs in
`docs/agents/`; ADRs 0001–0011 = grill decisions D1–D11; CLAUDE.md (with critical
contract zones table), CONTEXT.md, CONTRIBUTING.md, `.env.example` (no secrets) all
present. Snyk code scan: 0 issues. Deviations: skills copied from the redesign repo
instead of `npx skills add` (interactive picker, same content); branch protection uses
required-status-checks without required-review (solo repo — self-approval impossible);
`.claude/launch.json` not created (preview tooling permission-bound to the main
session project — harmless, `npm run dev` works).
