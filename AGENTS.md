<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Socios / Chiliz Wallet Rules (moved from global CLAUDE.md, 2026-08-20)

- Never overwrite `window.ethereum` — pick from `window.ethereum.providers`.
- Socios.com Wallet uses ERC-1271 (smart contract signatures, not EOA).
- ASCII-only in anything signed or sent to chain/external APIs: the Socios.com Wallet re-encodes personal_sign strings before signing, so multibyte chars (₵, ·, smart quotes, emoji) break `isValidSignature`. Fancy branding belongs in UI copy only — never in signed messages, on-chain strings, or API payloads.
- Deep patterns: Loideroi LLM Wiki `wiki/chiliz/**`.

## Go-To-Market

`GO_TO_MARKET.md` at the repo root is the single source of truth for launch/growth activities and their statuses. Include it when planning any GTM work, and keep it updated when GTM work lands. (Moved from global CLAUDE.md, 2026-08-20.)

## Gates (all blocking in CI — never weaken one to pass a task)

`npm run typecheck`, `npm run lint` (budgets are errors; exceptions need `expires YYYY-MM-DD`), `npm run arch` (dependency-cruiser layering — see `ARCHITECTURE.md`), `npm run deadcode:ci` (knip), `npm run dup` (jscpd ≤ 1%), `npm test`, `npm run check:i18n`. Baselines, exceptions and tier floors: `docs/REVIEW_TIERS.md`. Guardrail-complete since 2026-09-11 (Loideroi LLM Wiki, Development Lifecycle → guardrail stack).

## Boundaries

The ask-first rules an agent must see every session (mechanically required by `scripts/check-agents-md.mjs`, the AGENTS.md admission-test judge from the Loideroi LLM Wiki, run in CI).

- Commits, branches, PRs, and dependency changes are ask-first; `main` is protected and every change lands through a PR.
- Merges are the owner's own click — never run `gh pr merge` or `git merge` into `main`, even when asked (contract: the human clicks merge at every tier; an owner instruction to merge never waives the reviewer passes or the log entry — the 2026-09-09 escapes on PRs #85–#87 are why this line exists).
- Deploys, the oracle relayer workflow, and anything that signs or moves value are forbidden unless the owner explicitly requests them.
- Never weaken `.npmrc`, the lockfile, `eslint.config.mjs`, `.squawk.toml`, or a CI step to make a task pass; the jscpd threshold only tightens.
- Tier 3 paths (2 reviewers + human gate): the floor map in `docs/REVIEW_TIERS.md`; unlisted paths are never Tier 1 by omission. Log every reviewed PR in `docs/REVIEW_LOG.md` (linted in CI).
- Never store secrets in the repo or in instruction files.
