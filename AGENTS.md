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

`npm run typecheck`, `npm run lint` (budgets are errors; exceptions need `expires YYYY-MM-DD`), `npm run arch` (dependency-cruiser layering — see `ARCHITECTURE.md`), `npm run deadcode:ci` (knip), `npm run dup` (jscpd ≤ 1%), `npm test`, `npm run check:i18n`; in `contracts/`: `npm run slither` (blocking on new or moved High/Medium findings; triage in `slither-triage.json`). Baselines, exceptions and tier floors: `docs/REVIEW_TIERS.md`. Guardrail-complete since 2026-09-11 (Loideroi LLM Wiki, Development Lifecycle → guardrail stack).
