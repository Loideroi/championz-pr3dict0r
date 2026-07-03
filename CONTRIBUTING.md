# Contributing

`main` is protected — never push to it. All changes go through a PR with green CI.

## Every task

```bash
git checkout main && git pull --ff-only origin main
git checkout -b feat/<short-name>       # or fix/, chore/
# ... do the work ...
git fetch origin && git rebase origin/main   # surface conflicts locally
npm run typecheck && npm test && npm run build   # all must pass
git push -u origin feat/<short-name>
gh pr create --fill --base main
```

Keep branches small and focused. If the contracts workspace changed:
`cd contracts && npx hardhat compile && npx hardhat test` must also pass.

## Rules

- Never commit `.env.local`, private keys, or any secret. `.env.example` is the only
  env file in git.
- Issue tracker is local markdown: `.scratch/championz-predictor/issues/` — update the
  `Status:` line of the slice you're working (see `docs/agents/triage-labels.md`).
- Respect ADRs (`docs/adr/`); they're immutable — supersede with a new ADR, don't edit.
- SSR safety, ERC-1271, the 90-minute rule and the other hard rules live in
  `CLAUDE.md` — read it first.
- Deploys: merge to `main` → Vercel production (Loideroi account). Contract
  deployments are manual, owner-only, and never from CI.
