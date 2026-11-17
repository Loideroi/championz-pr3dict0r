# What

<!-- One logical change. ≤500 changed lines (excl. lockfiles and linguist-generated paths); Tier 3 aims ≤300. Over the cap → split, or label `size-waiver` and record the human waiver in this PR's review-log entry as `**Size waiver.** owner approved YYYY-MM-DD: <why splitting is worse>` (the field must open with `owner approved` / `waived` / `granted` and a real date, then a 20+ character rationale with no negative, pending or conditional wording such as if / once / unless / no-go, and no contractions). Entry headings follow `## YYYY-MM-DD — PR #N <title>` (or `PRs #N, #M and #K`); the subject numbers are the run right after `PR`. Write the entry's tier only in a labeled form, `**Tier.** N` (or `raised to Tier N`); the gate reads those (and `(Tier N` in the heading), not prose. Text hidden in an HTML comment never counts. A text file git reports as binary (a NUL byte) fails the gate. -->

## Tier declaration

- Declared tier: <!-- 1 | 2 | 3 — replace this comment with the digit; the review-gate check reads it -->
- Floor-map paths touched: <!-- from docs/REVIEW_TIERS.md; the floor beats the declaration -->

## Author verification (before requesting review)

- [ ] `npm run lint` green (blocking: zero warnings, complexity ≤ 15, max-lines ≤ 400; any `eslint-disable` carries `expires YYYY-MM-DD` and is listed in `docs/REVIEW_TIERS.md`)
- [ ] `npm run arch` green (dependency-cruiser: layering, cycles, orphans, devDeps)
- [ ] `npm run deadcode:ci` green (knip: unused files, dependencies, unlisted imports)
- [ ] `npm run dup` green (duplication under the 1% ratchet threshold)
- [ ] `npm run typecheck` green
- [ ] `npm test` green
- [ ] `npm run check:i18n` green
- [ ] Relayer touched → `npm run test:relayer` green
- [ ] Contracts touched → `npx hardhat compile && npx hardhat test && npm run slither` green in `contracts/` (slither: a new High/Medium finding or a moved triaged one fails — re-triage in `slither-triage.json` with the reason and a SECURITY_FINDINGS.md reference)
- [ ] Migrations touched → `npx squawk` green on the new files (squawk fails on ANY finding; a deliberate exception is a commented, justified `.squawk.toml` exclusion in this PR)
- [ ] Behavior exercised, not just generated — state what you ran:

## Review

<!-- Tier 1: 1 reviewer. Tier 2: 2 independent reviewers (reviewer 1 = different
vendor than author). Tier 3: 2 reviewers + human gate, reviewer-written risk
brief. -->

- [ ] The tier's reviewers ran; every Blocker/Major fixed or rebutted and re-checked by the raising reviewer
- [ ] **This PR's entry is appended to `docs/REVIEW_LOG.md` in this PR** (tier, exact model ids, verdicts, findings table, `Checked:`, `Dismissed:`; Tier 2/3 also `verification-gap`, `named-set`, `Missing:`) — `node scripts/lint-review-log.mjs docs/REVIEW_LOG.md` green
- [ ] Tier 3 → the reviewer-written risk brief and the behavioral verification script are in the log entry for the owner

The merge is the owner's click: an agent runs `gh pr merge` only on the owner's explicit GO, through the ask-first prompt (`AGENTS.md`, Boundaries).
