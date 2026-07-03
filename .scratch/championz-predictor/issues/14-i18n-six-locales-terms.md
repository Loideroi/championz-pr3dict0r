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
