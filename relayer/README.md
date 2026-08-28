# relayer/ — UEFA results oracle workspace

Initialized in build slices 04–05 (`.scratch/championz-predictor/issues/`).
Self-contained npm package — `npm install` here, not at the repo root.

## Layout (slice 04)

- `vendor/uefa-api-types.ts` — vendored `uefa-api` v1.0.2 type definitions
  (upstream dormant; we own this copy — patch it on drift, PRD §7.1)
- `src/schema.ts` — zod schemas locked against a live payload captured
  2026-07-04 (`test/fixtures/matches-ucl-2026-*.json` + `capture-meta.json`)
- `src/source.ts` — `ResultSource` interface, `UefaApiSource` (launch impl),
  `FootballDataSource` (documented fallback, stub)
- `scripts/capture-fixture.mjs` — (re)record live payloads into test fixtures
- `scripts/generate-matches.mjs` — UEFA feed → `matches.json` (teams, matchIds,
  phases, kickoffs, `uefaMatchId`/`tieId`/`legNumber`); never hand-authored
- `scripts/verify-fixtures.mjs` — numbering-independent matches.json ↔ feed
  comparison (the §7.4 hard gate); non-zero exit on any discrepancy
- `scripts/verify-onchain.mjs` — matches.json ↔ the proxy's `matches(id)` rows
  (kickoff, teams, stage, no strays) + the D1 window check; the other §7.4 half
- `scripts/generate-map.mjs` — matches.json → relayer map (`config/*-map.json`:
  on-chain id ↔ uefaMatchId ↔ home/away UEFA team ids); never hand-authored
- `src/fixtureMap.ts` / `src/onchainVerify.ts` — the pure logic behind those two
- Team codes go on-chain as `bytes3`: UEFA's 4-letter `LASK` is pinned to `LAS`
  (`CODE_OVERRIDES` in generate-matches.mjs, or `--code <uefaTeamId>=<CODE>`)
- `test/output/matches-sample.json` — generator output for the recorded
  archive slice (evidence, committed)

## Commands

```bash
npm test           # vitest run (43 tests, offline — recorded fixtures only)
npm run typecheck  # tsc --noEmit
npm run build      # tsc -> dist/
node scripts/capture-fixture.mjs [seasonYear]
node scripts/generate-matches.mjs --season 2027 --out ../lib/fixtures/matches.json
node scripts/verify-fixtures.mjs --matches ../lib/fixtures/matches.json --season 2027
npm run build   # the two below import the compiled src
node scripts/generate-map.mjs --matches ../lib/fixtures/matches.json --out config/mainnet-map.json --phase 0
RPC_URL=… PREDICTOR_ADDRESS=0x… node scripts/verify-onchain.mjs --matches ../lib/fixtures/matches.json --phase 0
```

Shape (PRD §7–8):

- All feed access through the `ResultSource` interface; `UefaApiSource` first
  (vendored `uefa-api` types + zod validation), `FootballDataSource` as fallback
- Runs on **GitHub Actions cron** (Vercel Hobby crons are daily-only); every 5 min in
  matchday windows, hourly otherwise; concurrency-grouped; idempotent before every push
- Writes the **90-minute score** (`score.regular`) + ET/pens/advancer flags derived
  from `winner.match.reason`; mirror-UEFA verbatim (D6) — no result filtering
- Signer: `ORACLE_PRIVATE_KEY` (gas only, `RESULT_ORACLE_ROLE`), from Actions secrets
- Health: zod drift → SOURCE_SCHEMA_CHANGED, staleness watchdog → SOURCE_STALE,
  Telegram DM alerts + daily heartbeat (slice 06)
