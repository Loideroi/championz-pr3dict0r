# ₵h@mpi0nz Pr3dict0r

@AGENTS.md

A staking-based score-prediction pool for the **UEFA Champions League 2026/27** on
Chiliz Chain. Users stake CHZ, predict 90-minute scorelines, earn points on-chain,
and the top-20 of each stage split the pools. Results flow automatically from UEFA's
(unofficial) JSON API via an oracle relayer — routine per-match admin work is zero.

- **Master spec:** [`PRD.md`](./PRD.md) (v1.1.0, grilled — decision log in §21). The
  HTML mirror is `PRD.html`; the `.md` always wins.
- **Issues:** `.scratch/championz-predictor/issues/` (local markdown tracker, 16
  slices, dependency graph in its README).
- **Predecessor:** `~/Projects/predictor` (World Cup 2026) — reuse per its
  `docs/REUSE_GUIDE.md`; its `Audit.MD` is our security regression baseline.
- **Accounts:** GitHub + Vercel = personal **Loideroi** (mark.verdegaal@gmail.com).
  Free-tier services only. Domain: pr3dict0r.com (GoDaddy → Vercel).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind v4
- Vitest · wagmi v2 + viem v2 + Reown AppKit (Chiliz 88888 / Spicy 88882)
- `contracts/` Hardhat + Solidity 0.8.24 (UUPS) · `relayer/` GitHub-Actions oracle
- Supabase (existing free project, `clp_`-prefixed tables) — read-model only; chain is truth

## Commands

```bash
npm run dev        # dev server (port 3000)
npm test           # Vitest
npm run typecheck  # tsc --noEmit
npm run build      # production build
npm run lint       # eslint
```

## Hard rules (don't break these)

- **SSR safety:** never `Date.now()`, `Math.random()`, or unpinned `toLocale*()` in
  render (hydration error #418). Pin locale `"en-US"`; countdowns mount client-side.
- **Socios.com Wallet is ERC-1271** (smart-contract account): every signature check
  branches contract-vs-EOA via `isValidSignature()`; **no `eth_signTypedData`**
  anywhere; SCW write confirmation = poll chain state, never await a relayed receipt.
- Never overwrite `window.ethereum` — pick from `window.ethereum.providers`.
- **The 90-minute rule:** all scoreline logic uses `score.regular`, never the AET total.
- Entry amounts are exact: 1,100 / 550 CHZ (`lib/economics.ts` ↔ contract constants in lockstep).
- Tailwind v4: `postcss.config.mjs` **and** `app/globals.css` are both load-bearing — never delete either.
- Semantic tokens only — no design-system hexes outside `app/globals.css`.
- Never commit `.env.local` or any secret. `main` is protected — all changes via PR.
- Run `snyk_code_scan` on new first-party code when the Snyk MCP is available.

## Critical contract zones (read before touching — Fanbet pattern)

| Zone | Why |
|---|---|
| `enterFullSeason()` / `enterKnockout()` | exact-value enforcement, pool/fee split, entry windows (D1/D4), floor-20 void path (D2) |
| `pushResult()` / `correctResult()` / `forceCorrectResult()` | oracle trust boundary, provisional window, mirror-UEFA (D6) |
| points computation (lazy scoring) | 5/3/1 + tie bonuses, two-legged deciders, 90′ rule — no settlement loops, ever |
| `freezeStage()` / `claim()` | on-chain top-20 recomputation, split percentages, dust-to-first |
| `voidMatch()` / `setMatchTeams()` | scoped to our own mistakes only (D6) |
| pause / upgrade / oracle rotation | owner = single key (D5); UUPS validate-then-upgrade |

## Agent skills & conventions

- Skills live in `.claude/skills/` (Matt Pocock suite). **`/grilling` big decisions**;
  `/tdd` for contract work; `/to-issues` for new feature slicing.
- Issue tracker: local markdown — see `docs/agents/issue-tracker.md`.
- Triage labels: five-role vocabulary — see `docs/agents/triage-labels.md`.
- Domain docs: `CONTEXT.md` glossary + `docs/adr/` (immutable; supersede, don't edit)
  — see `docs/agents/domain.md`. ADRs 0001–0011 encode the grilled decisions D1–D11.
- Workflow: see `CONTRIBUTING.md` — branch off main, `typecheck && test && build`
  before PR, rebase on origin/main, never push to main.
