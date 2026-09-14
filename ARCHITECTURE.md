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

`app` → `components` → `hooks` → foundation (`lib`, `i18n`, `content`; mutually importable). Lower layers never import upward. Enforced by `.dependency-cruiser.js` (`npm run arch`, in CI): no cycles, no upward imports, no orphans outside Next.js framework entry files, no runtime imports of devDependencies. Dead files, dead dependencies, unlisted and unresolved imports are enforced by `knip.jsonc` (`npm run deadcode:ci`). `contracts/` is outside these rules by design and carries its own tests.

## Layers and direction (relayer)

`scripts/*.mjs` → `dist/` (the tsc build of `src/`) → `src` → `vendor`. Since 2026-09-13 the same two gates cruise `relayer/` from the root (`npm run arch`, `npm run deadcode:ci`, in the required `app` check; both tools are root devDependencies, so nothing is installed twice):

- `scripts/*.mjs` are the entry points: eleven shebang CLIs with a usage contract in their header, four of them production automation (`relay`, `check-balance`, `sentinel`, `matchday-span` — run by `oracle-bot.yml` and `matchday-watch.yml`), the other seven operator tools (five listed in `relayer/README.md`; `bot-poll` and `generate-insights` document their own invocation). They import the build output (`../dist/src/x.js`), never `src` directly; `dist/` is gitignored and excluded from the graph, and `knip.jsonc` maps it back to `src` so the graph is complete without a build. That edge is checked by the relayer's own `test/scripts-dist-imports.test.ts` (required `relayer` check): every dist import names an emitted module and an existing export.
- `src` is the library: no cycles, no import of `scripts/` or `test/`, no import of a devDependency, no orphan (a module only a script uses is kept in-graph by its test).
- `vendor/uefa-api-types.ts` is a leaf that imports nothing — vendored reference types (PRD §7.1) that nothing imports by design; `src/schema.ts` mirrors them in zod. knip models it as an entry, not an ignore, so a package import added to it is still checked.
- `test/` sits on top and is imported by nothing (`test/helpers.ts` included).
- Package imports are judged against `relayer/package.json`, not the root: a root-only package (`next`, `react`, …) resolves locally and in the CI app job but not where `oracle-bot.yml` runs `npm ci` in `relayer/` alone — `relayer-no-unlisted-package` fails it (knip's unlisted check treats root dependencies as available to the workspace, so it cannot).
- The two trees never import each other. The relayer takes app data (`lib/fixtures/matches.json`) as a CLI path; shipped app code consumes relayer output through Supabase rows and chain state. The single sanctioned bridge is `lib/admin/pipeline.lockstep.test.ts`, which pins the app's port of `relayer/src/matchday.ts` to the original; every other app-tree → relayer edge, tests included, fails.

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
