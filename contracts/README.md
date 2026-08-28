# contracts/ — ChampionzPredictor.sol workspace

Initialized in build slice 02 (`.scratch/championz-predictor/issues/02-walking-skeleton-spicy.md`).

Hard constraints (PRD §10, do not violate):

- Solidity **0.8.24**, EVM target **Shanghai** (Chiliz ceiling)
- OpenZeppelin upgradeable, **UUPS proxy**; validate-upgrade before every upgrade
- **No settlement loops** — points are computed lazily at read/freeze/claim time
- Owner = `0x47103b0FC04c91Ac388eaE3c4f91D038CBfD9CF8` (D5); oracle is a separate
  low-value `RESULT_ORACLE_ROLE` key, never the owner, never in CI
- Entry amounts enforced exactly: 1,100 / 550 CHZ (lib/economics.ts mirrors these)
- Verify on Chiliscan via Routescan's keyless Etherscan-compatible API

## Owner scripts (never from CI — `DEPLOYER_PRIVATE_KEY` in `contracts/.env` is the owner key)

- `scripts/add-fixtures.ts` — push a generated matches.json (`PROXY`, `MATCHES`, `PHASE=0`,
  `EXPECT_MATCHCOUNT`, `PAUSE=1`, `CONFIRM=1`): one `addMatches` per matchday-sized chunk,
  read-back diff, pause-bracketed so nobody predicts on an unverified slate. DRY RUN by default.
- `scripts/set-stage-windows.ts` — align the D1/D4 windows with the published calendar
  (`LEAGUE_CLOSE`, `KO_OPEN`, `KO_CLOSE`), respecting the M-3 ordering. DRY RUN by default.
- `scripts/lib/fixtures.ts` — the pure planning/encoding both use; exercised on the real
  contract in `test/AddFixtures.test.ts` (144-match push, id offsets, bytes3 codes).
