# Contributing

`main` is protected — never push to it. All changes go through a PR with green CI, the
tier's reviewer passes, and the owner's merge click. The process is the Loideroi LLM
Wiki's multi-agent code review contract; this file is the per-task recipe.

## Every task

```bash
git checkout main && git pull --ff-only origin main
git checkout -b feat/<short-name>       # or fix/, chore/, docs/, refactor/, perf/
# ... do the work, one logical change, <=500 changed lines excl. lockfiles/generated ...
git fetch origin && git rebase origin/main   # surface conflicts locally
npm run typecheck && npm test && npm run build && npm run lint && npm run dup && npm run check:i18n
git push -u origin feat/<short-name>
gh pr create --base main                # NO --fill: the PR template must load
```

Then, before anyone asks for a merge:

1. **Declare the tier** in the PR template from the floor map in `docs/REVIEW_TIERS.md`
   (the floor beats your declaration; a reviewer can only raise it).
2. **Run the tier's reviewers** — Tier 1: one reviewer; Tier 2: two independent
   reviewers (reviewer 1 from a different vendor than the author); Tier 3: two reviewers
   plus a reviewer-written risk brief for the owner. Fix or rebut every Blocker/Major;
   the raising reviewer re-checks the fix.
3. **Append this PR's entry to `docs/REVIEW_LOG.md` in the same PR** (tier, exact model
   ids, verdicts, findings table, `Checked:`, `Dismissed:`; Tier 2/3 also
   `verification-gap`, `named-set`, `Missing:`). `node scripts/lint-review-log.mjs
   docs/REVIEW_LOG.md` must pass.
4. **The owner merges.** Agents never run `gh pr merge`, and an owner's "merge it" on an
   unreviewed PR is a request to run steps 1–3 first, not a waiver.

The `review-gate` CI check enforces the tier line, the size cap (label `size-waiver`
only with a human waiver recorded in the log entry), the same-PR log entry, and the log
entry's fields. It cannot check that the reviews actually happened — that is what the
log entry and the monthly escape audit are for.

If the contracts workspace changed: `cd contracts && npx hardhat compile && npx hardhat
test` must also pass. Relayer: `npm run test:relayer`. Migrations: `npx squawk` on the
new files.

## Rules

- Never commit `.env.local`, private keys, or any secret. `.env.example` is the only
  env file in git.
- Issue tracker is local markdown: `.scratch/championz-predictor/issues/` — update the
  `Status:` line of the slice you're working (see `docs/agents/triage-labels.md`).
- Respect ADRs (`docs/adr/`); they're immutable — supersede with a new ADR, don't edit.
- SSR safety, ERC-1271, the 90-minute rule and the other hard rules live in
  `CLAUDE.md` — read it first; ask-first boundaries live in `AGENTS.md`.
- Deploys: merge to `main` → Vercel production (Loideroi account), which is why every
  merge needs its reviews first. Contract deployments are manual, owner-only, and never
  from CI.
