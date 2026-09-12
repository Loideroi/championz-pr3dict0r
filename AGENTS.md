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

## Boundaries

- **Merges are the owner's click, never an agent's.** `gh pr merge` and `git merge` are ask-first, and an owner instruction to "merge it" does not replace the reviewer passes or the review-log entry — if asked to merge an unreviewed PR, say so and run the reviews first. (2026-09-09: PRs #85–#87 were merged that way with no review; 11 Majors surfaced afterwards, one in production — `docs/REVIEW_LOG.md`.)
- **Every PR declares its tier and ships its own log entry.** Open PRs with `gh pr create` and let the template load (never `--fill`); take the tier floor from `docs/REVIEW_TIERS.md`, run that tier's reviewers before asking for the merge, and add this PR's `docs/REVIEW_LOG.md` entry inside the same PR. The `review-gate` CI check (lands with the stacked judges/gate PRs; merge the three in order) fails without the tier line, the log entry, or under the 500-line cap breach (label `size-waiver` plus a recorded human waiver is the only override — applying that label yourself prompts, and the waiver field must name the owner).
- **Pushes without asking** cover only already-committed work on `feat/*`, `fix/*`, `docs/*`, `chore/*`, `refactor/*`, `perf/*` branches (the settings encode exactly these; other prefixes such as `release/*` or `dependabot/*` prompt). Anything on `main`, any refspec (`a:b`), deletes, `--tags`, `--prune`, deploys (`vercel`), dependency installs, and force-pushes are ask-first or denied.
- **The settings shape what an agent tries; they are not the security boundary.** Claude Code Bash rules are textual: `node scripts/*`, `npm run*` and similar allow rows can run arbitrary code, `git -C`/`sh -c` forms are not matched, and the main-push deny rows over-match on purpose (any branch name ending in `main`, any `git -c`/`git -C` push). The mechanical boundary is GitHub branch protection on `main` — today enforce-admins + required checks (live since 2026-08-28) but **no "require a pull request" rule**, so a green PR head can still be fast-forwarded to `main` directly — plus two owner clicks still outstanding: enable "Require a pull request before merging" and enroll `review-gate` as a required check. Until both, the 2026-09-09 escape is narrowed, not closed.
- Never add or upgrade a dependency without approval; never weaken `.npmrc`, the lockfiles, CI gates, or `.claude/settings.json` — the settings file is Tier 3 and its permission rows are never waivable.
- Tier 3 paths (2 reviewers + human gate): `contracts/**`, `relayer/**`, `.github/**`, `supabase/**`, `app/api/**`, `middleware.ts`, any module that signs or submits chain transactions, the auth/secrets kernel (`lib/supabase/**`, `lib/telegram/**`, `lib/profile/verify.ts`, `lib/profile/rate-limit.ts`), `scripts/**`, guardrail/build config, all three lockfiles, and every instruction file. Reasons and the full map: `docs/REVIEW_TIERS.md`. Unlisted paths are Tier 2, never Tier 1 by omission.
- Never store secrets in the repo or in instruction files.

## Pointers

- Review tiers and log: `docs/REVIEW_TIERS.md`, `docs/REVIEW_LOG.md` (every entry must satisfy `scripts/lint-review-log.mjs`)
- Shared review contract, permission ladder, and model roster: Loideroi LLM Wiki (`~/Projects/Loideroi LLM Wiki` — `agent/contracts/multi-agent-code-review.md`, `agent/contracts/permission-ladder.md`, `wiki/agent-ops/review-model-roster.md`); project page `wiki/projects/championz-pr3dict0r.md`.
