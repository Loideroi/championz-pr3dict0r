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
