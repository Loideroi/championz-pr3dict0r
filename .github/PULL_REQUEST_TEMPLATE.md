# What

<!-- One logical change. ≤500 changed lines (excl. lockfiles/generated); Tier 3 aims ≤300. -->

## Tier declaration

- Declared tier: <!-- 1 | 2 | 3 -->
- Floor-map paths touched: <!-- from docs/REVIEW_TIERS.md; the floor beats the declaration -->

## Author verification (before requesting review)

- [ ] `npm run lint` green (complexity/max-lines budgets may warn — no NEW warnings)
- [ ] `npm run dup` green (duplication under the 2% ratchet threshold)
- [ ] `npm run typecheck` green
- [ ] `npm test` green
- [ ] `npm run check:i18n` green
- [ ] Relayer touched → `npm run test:relayer` green
- [ ] Contracts touched → `npx hardhat compile && npx hardhat test` green in `contracts/`
- [ ] Migrations touched → `npx squawk` green on the new files (squawk fails on ANY finding; a deliberate exception is a commented, justified `.squawk.toml` exclusion in this PR)
- [ ] Behavior exercised, not just generated — state what you ran:

## Review

<!-- Tier 1: 1 reviewer. Tier 2: 2 independent reviewers (reviewer 1 = different
vendor than author). Tier 3: 2 reviewers + human gate, reviewer-written risk
brief. Record verdicts + exact model IDs in docs/REVIEW_LOG.md. -->
