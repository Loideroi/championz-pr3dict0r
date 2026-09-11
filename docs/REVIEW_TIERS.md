# Review Tier Floor Map

Per-repo path→minimum-tier map required by the multi-agent code review contract
(Loideroi LLM Wiki, `agent/contracts/multi-agent-code-review.md`). These are
FLOORS: a touched path sets the minimum tier; the author's declaration or a
reviewer's contest can only raise it, never lower it. Highest applicable tier
wins. Changing THIS file (or the review log) is itself Tier 3 — tier
boundaries belong to the human.

| Path | Tier floor | Why |
|---|---|---|
| `contracts/**` (sources, tests, configs, scripts, lockfile) | 3 | On-chain prediction pools and settlement — value-moving |
| `relayer/**` (incl. its lockfile) | 3 | Oracle relayer — the results it produces settle pools; wrong data is value-moving even when no key is held |
| `.github/workflows/**` | 3 | CI is a merge gate; `oracle-bot.yml` is production automation with repo secrets |
| `supabase/**` (incl. `migrations/**`) | 3 | Production data schema and config — migrations are named Tier 3 in the contract |
| `app/api/**` | 3 | Server-side routes |
| `middleware.ts` and any edge/proxy module owning CSP, geo-restriction, or security-header policy | 3 | Production security enforcement (Fanbet reviewer-finding parity, 2026-08-27) |
| Any module that constructs, signs, or submits chain transactions, and Reown/AppKit wallet configuration (`lib/wagmi/**`, `app/providers.tsx`) | 3 | Signing surface — path-independent catch-all |
| `lib/supabase/**`, `lib/telegram/**`, `lib/profile/verify.ts`, `lib/profile/rate-limit.ts` — and any module handling secrets, privileged service clients, or authentication/signature verification | 3 | Auth/secrets kernel (reviewer finding 2026-08-27): the service-role Supabase client, ERC-1271/EOA wallet verification, and account linking are the contract's "auth, permissions, secrets handling" — path-independent catch-all applies to new modules of this kind |
| `scripts/**` | 3 | `check-i18n-parity.mjs` is gate tooling; catch-all: any script that signs, deploys, or mutates production data is Tier 3 regardless of name |
| `.github/**` (non-workflows), `.npmrc` (all three roots), `eslint.config.mjs`, `.dependency-cruiser.js`, `knip.jsonc`, `.squawk.toml`, `next.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `postcss.config.mjs` | 3 | Guardrail / build / deploy config — editing these can silence a gate |
| `package.json`, `contracts/package.json`, `relayer/package.json` | 3 | Own the gate scripts; editing them can silence every gate |
| `package-lock.json`, `contracts/package-lock.json`, `relayer/package-lock.json` | 3 | Precedent: chilitize adjudication 2026-08-25, mirrored on Fanbet with explicit owner confirmation 2026-08-27 (supply chain feeding CI; no reviewer credibly reads a lockfile blob — detection is mechanical or nothing). Deliberately stricter than the contract's Tier 1 dependency-patch row; owner confirmation for this repo recorded at the 2026-08-27 wiring gate |
| `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `docs/REVIEW_TIERS.md`, `docs/REVIEW_LOG.md` | 3 | Agent instruction files and the review process itself |
| `docs/**` (except the two review files above), other `*.md`, comments-only diffs | 1 | Docs / formatting |
| **Anything not listed above** (incl. `app/**` pages, `components/**`, `hooks/**`, `lib/**`, `messages/**`, `content/**`) | 2 | Default floor until mapped — an unlisted path is never Tier 1 by omission; add a row when a new surface appears |

Review depth per tier, reviewer independence, PR size caps, and merge gates:
see the wiki contract. Log every reviewed PR in `docs/REVIEW_LOG.md`.

## Gate Baselines (ratchet — may shrink, never grow)

Guardrail-complete since 2026-09-11: every gate below fails CI inside the required `app` check (strict, enforce-admins). Wired warn-only 2026-08-27; measured again 2026-09-11 before the flip.

| Gate | Baseline (2026-09-11) | Budget / enforcement |
|---|---|---|
| ESLint `complexity` (error ≥ 15) | 5 over-budget functions, each carrying a dated exception (below) | Blocking; `eslint --max-warnings 0`. New code stays under 15 — no new exceptions without a reviewer-approved, dated comment |
| ESLint `max-lines` (error > 400; tests exempt) | 0 | Blocking — keep it at zero |
| Lint exceptions (`scripts/check-lint-exceptions.mjs`) | 5, all `expires 2026-10-31` | Blocking: an `eslint-disable` without an expiry, or past it, fails the build; `reportUnusedDisableDirectives: error` fails a stale one once the function is fixed |
| dependency-cruiser (`npm run arch`: app, components, hooks, lib, i18n, content, middleware.ts) | 0 violations over 123 modules / 297 dependencies | Blocking: no cycles, no upward imports, no orphans outside framework entry files, no runtime devDependency imports |
| knip (`npm run deadcode:ci`: files, dependencies, unlisted) | 0 / 0 / 0 (19 unused exports + 7 unused types remain informational via `npm run deadcode`) | Blocking on the three high-signal categories; exports/types are slow-burn, not gated |
| jscpd (`npm run dup`: app, components, hooks, lib, middleware.ts, relayer/src; tests excluded, min-tokens 50) | 9 exact clones, 0.86% duplicated lines | CI threshold **1%** (tightened from 2% on 2026-09-11) — ratchet down as clones consolidate |
| squawk (Supabase migrations) | 25 warning-level findings in the 1 historical (already-applied) migration — squawk exits non-zero on ANY finding | CI lints changed migration files only, on pull requests **and** pushes to main (since 2026-09-11); history is not retro-gated. A new migration must be squawk-clean; deliberate exceptions land as commented, justified `.squawk.toml` exclusions in the same PR. `npm run migrations:lint` is the full-history debt view (expect exit 1 until history is cleaned) |

### Complexity exceptions (burn-down list — delete the comment when the function is under 15)

| Function | File | Complexity 2026-09-11 | Expires |
|---|---|---|---|
| `EnterPanel` | `app/enter/EnterPanel.tsx` | 51 | 2026-10-31 |
| `MatchRow` | `components/predict/MatchRow.tsx` | 32 | 2026-10-31 |
| `saveProfile` | `lib/profile/service.ts` | 27 | 2026-10-31 |
| `ProfileForm` | `components/profile/ProfileForm.tsx` | 26 | 2026-10-31 |
| `POST` (Telegram webhook) | `app/api/telegram/webhook/route.ts` | 19 | 2026-10-31 |

An expiry may be extended only in a reviewed PR that says why; the checker fails the build the day after it passes.

## Named Follow-Ups (gaps known at wiring time, 2026-08-27 — not silently accepted)

- **Relayer ESLint coverage** (next PR after the 2026-09-11 app-tree gates, per the guardrail-complete plan review): the relayer (Tier 3, value-moving oracle data) has typecheck + tests but no lint tooling, so the complexity/max-lines budgets don't reach it; dependency-cruiser/knip applicability to be evaluated in the same PR. jscpd already covers `relayer/src`.
- **Contracts security scanning** (the PR after that): CodeQL covers JS/TS only; the contracts workspace has no slither step (Fanbet's does). Mirror Fanbet's slither job (adds a Python toolchain to the `contracts` required check).
- **CI npm bootstrap**: the `app` job still runs an unpinned `npm install -g npm@11` before the supply-chain guard (flagged by the wiki's CI-template review 2026-09-11). Move the job to Node 24, whose bundled npm is 11, and delete the step.
- **Dependabot alerts + automated security fixes**: repo Settings → Security & analysis (owner click; the CodeQL workflow covers scanning, this covers advisories).
