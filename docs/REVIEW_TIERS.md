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
| `.github/**` (non-workflows), `.npmrc` (all three roots), `eslint.config.mjs`, `.squawk.toml`, `next.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `postcss.config.mjs` | 3 | Guardrail / build / deploy config — editing these can silence a gate |
| `package.json`, `contracts/package.json`, `relayer/package.json` | 3 | Own the gate scripts; editing them can silence every gate |
| `package-lock.json`, `contracts/package-lock.json`, `relayer/package-lock.json` | 3 | Precedent: chilitize adjudication 2026-08-25, mirrored on Fanbet with explicit owner confirmation 2026-08-27 (supply chain feeding CI; no reviewer credibly reads a lockfile blob — detection is mechanical or nothing). Deliberately stricter than the contract's Tier 1 dependency-patch row; owner confirmation for this repo recorded at the 2026-08-27 wiring gate |
| `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `docs/REVIEW_TIERS.md`, `docs/REVIEW_LOG.md` | 3 | Agent instruction files and the review process itself |
| `docs/**` (except the two review files above), other `*.md`, comments-only diffs | 1 | Docs / formatting |
| **Anything not listed above** (incl. `app/**` pages, `components/**`, `hooks/**`, `lib/**`, `messages/**`, `content/**`) | 2 | Default floor until mapped — an unlisted path is never Tier 1 by omission; add a row when a new surface appears |

Review depth per tier, reviewer independence, PR size caps, and merge gates:
see the wiki contract. Log every reviewed PR in `docs/REVIEW_LOG.md`.

## Gate Baselines (measured 2026-08-27, ratchet — may shrink, never grow)

| Gate | Baseline | Budget |
|---|---|---|
| ESLint `complexity` (warn ≥ 15) | 6 warnings | Warn-only ratchet; new code stays under 15 |
| ESLint `max-lines` (warn > 400; tests exempt) | 0 warnings | Warn-only ratchet — keep it at zero |
| jscpd (`npm run dup`: app, components, hooks, lib, middleware.ts, relayer/src; tests excluded, min-tokens 50) | 8 exact clones, 1.20% duplicated lines | CI threshold 2% — ratchet down as clones consolidate |
| squawk (Supabase migrations) | 25 warning-level findings in the 1 historical (already-applied) migration — squawk exits non-zero on ANY finding | CI lints changed migration files only; history is not retro-gated. A new migration must be squawk-clean; deliberate exceptions land as commented, justified `.squawk.toml` exclusions in the same PR. Note: `npm run migrations:lint` is the full-history debt view — expect exit 1 with the 25 baseline findings until history is cleaned; for PR verification run `npx squawk` on the new files only |

## Named Follow-Ups (gaps known at wiring time, 2026-08-27 — not silently accepted)

- **Relayer ESLint coverage**: the relayer (Tier 3, value-moving oracle data) has typecheck + tests but no lint tooling at all, so the complexity/max-lines budgets don't reach it. Adding ESLint there needs a dependency decision (owner).
- **Contracts security scanning**: CodeQL covers JS/TS only; the contracts workspace has no slither step (Fanbet's does). Mirror Fanbet's slither job when the contracts suite is next touched (owner decision — adds Python toolchain to CI).
- **Dependabot alerts + automated security fixes**: repo Settings → Security & analysis (owner click; the CodeQL workflow covers scanning, this covers advisories).
