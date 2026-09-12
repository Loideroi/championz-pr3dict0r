# Architecture

One page. Decisions with lasting consequences live in `docs/adr/`; the product spec is `PRD.md`.

## Shape

Three npm trees in one repository, each with its own toolchain and CI job:

```
app/            Next.js App Router entry points: pages, layouts, API route handlers (Tier 3), manifest/robots/sitemap
components/     presentational + client islands (chrome, predict, profile, pwa, ui); reusable across routes
hooks/          React hooks; below components, above the foundation
lib/            foundation: economics, fixtures, predictor logic, profile, Supabase, Telegram, wagmi, admin
i18n/           next-intl config + request loader (cookie-based, no locale routing)
content/        terms and other long-form content modules
messages/       user-visible copy (JSON, not cruised)
middleware.ts   geofence + security headers (Tier 3)
supabase/       SQL migrations (squawk-gated)
scripts/        gate tooling run by CI
relayer/        oracle relayer — its own npm tree (Tier 3, value-moving results)
contracts/      Solidity pools + Hardhat — its own npm tree (Tier 3, value-moving)
```

## Layers and direction (app tree)

`app` → `components` → `hooks` → foundation (`lib`, `i18n`, `content`; mutually importable). Lower layers never import upward. Enforced by `.dependency-cruiser.js` (`npm run arch`, in CI): no cycles, no upward imports, no orphans outside Next.js framework entry files, no runtime imports of devDependencies. Dead files, dead dependencies and unlisted imports are enforced by `knip.jsonc` (`npm run deadcode:ci`). `relayer/` and `contracts/` are outside these rules by design and carry their own tests.

## Data ownership

- On-chain state (pools, stakes, points) is owned by the contracts; the app reads it via wagmi/viem and never derives settlement itself.
- Match results enter only through the relayer; the app and Telegram tooling consume its output.
- Profiles and standings read models live in Supabase behind `lib/supabase/**` (service-role client is a Tier 3 module).
- Copy lives in `messages/*.json`; fixtures in `lib/fixtures`.

## Boundaries that must not move without an ADR

- No second path for results into a pool besides the relayer.
- No module outside `lib/wagmi/**` and `app/providers.tsx` constructs or signs transactions.
- No secret or privileged client outside the Tier 3 kernel named in `docs/REVIEW_TIERS.md`.
- No gate in CI is downgraded to advisory; known debt is a commented, dated exception.
