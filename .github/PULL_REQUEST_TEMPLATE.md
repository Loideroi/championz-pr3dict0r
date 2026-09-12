# What

<!-- One logical change. ≤500 changed lines (excl. lockfiles and linguist-generated paths); Tier 3 aims ≤300. Over the cap → split, or label `size-waiver` and record the human waiver in this PR's review-log entry as `**Size waiver.** owner <go/decision> YYYY-MM-DD: <why splitting is worse>` (the gate checks for the owner, a real date, and a rationale). -->

## Tier declaration

- Declared tier: <!-- 1 | 2 | 3 — replace this comment with the digit; the review-gate check reads it -->
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
brief. -->

- [ ] The tier's reviewers ran; every Blocker/Major fixed or rebutted and re-checked by the raising reviewer
- [ ] **This PR's entry is appended to `docs/REVIEW_LOG.md` in this PR** (tier, exact model ids, verdicts, findings table, `Checked:`, `Dismissed:`; Tier 2/3 also `verification-gap`, `named-set`, `Missing:`) — `node scripts/lint-review-log.mjs docs/REVIEW_LOG.md` green
- [ ] Tier 3 → the reviewer-written risk brief and the behavioral verification script are in the log entry for the owner

The merge is the owner's click. Agents do not run `gh pr merge`.
