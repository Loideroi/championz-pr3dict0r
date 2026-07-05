# 14 — i18n: six locales + the funnier T&Cs

Status: ready-for-agent
PRD: ../../PRD.md §15, §17 · Decision: D10

## What to build

All six predecessor locales at launch (en, es, fr, it, pt-BR, tr): next-intl wired
through every UI string with English as source, times in 24-hour en-GB convention,
non-translatable fields (scores, rankings, team codes, timestamps) byte-identical
across locales, and locale-pinned formatting everywhere (SSR-safety: no unpinned
toLocale calls). The terms & conditions ship in all six languages, legally coherent
and measurably funnier than the predecessor's: every load-bearing clause kept
(skill-based competition, 60-minute lockout, edits-until-lockout with gas on you,
non-refundable from purchase, provisional-result window, mirror-UEFA green-table rule,
public-chain visibility, eligibility/geo self-certification, UEFA non-affiliation,
BigMac Bobby credit) — with the humour adapted per locale, not translated, and the
wallet-address tie-break joke preserved in all six. This is the August crunch risk
named in the milestones: treat content generation as the critical path.

## Acceptance criteria

- [ ] All six locales render every route; language switcher works; no missing-key warnings
- [ ] Non-translatable fields verified byte-identical across locale files by a script
- [ ] T&Cs exist in all six locales; each contains every load-bearing clause and at least one new joke per section
- [ ] The tie-break joke appears in all six, natively funny per locale
- [ ] No hydration errors from locale formatting on any route
- [ ] en-GB 24-hour times everywhere regardless of locale

## Blocked by

- 08-prediction-ux.md
- 13-bigmac-bobby-design-pass.md

## Comments

**2026-07-05 — T&Cs shipped separately (PR `feat/terms-six-locales`); i18n wiring remains.**
- The six-locale Terms & Conditions are done as their own slice: `content/terms/{en,es,fr,it,pt-BR,tr}.ts`
  (19 shared section ids, every load-bearing clause in each), `content/terms/index.ts`
  (locale map + per-locale `TIE_BREAK_JOKE` consts), and `/terms?lang=` with an
  SSR-safe switcher (real buttons, `aria-pressed`).
- Humor adapted per locale, not translated: green-table rule renders natively as
  "en los despachos" (es), "sur tapis vert" (fr), "a tavolino" (it), "no tapetão"
  (pt-BR), "hükmen" (tr). Wallet-address tie-break joke preserved in all six, pairwise distinct.
- Parity enforced by `content/terms/parity.test.ts` (32 tests: section-id order,
  byte-identical numeric tokens 1,100 / 550 / 5/3/1 / 25% / jurisdiction list,
  tie-break joke canon). Registered via shim `app/terms/parity.test.ts` because
  vitest `include` is scoped to `lib/**`+`app/**` and configs were out of slice
  boundary — fold into vitest.config.ts when the i18n wiring lands.
- Still open for this issue: next-intl wiring for all UI strings, language switcher
  on every route, en-GB 24-hour times, byte-identity script for non-T&C fields.
