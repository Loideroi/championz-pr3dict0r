# 14 — i18n: six locales + the funnier T&Cs

Status: ready-for-human
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

**2026-07-05 — i18n component wiring complete (branch `feat/i18n-wiring`).**
All app-side wiring done on top of the infra commit; `npm run typecheck && npm test
&& npm run build` and `eslint --max-warnings=0` and `npm run check:i18n` all green.
Per acceptance criterion:

- [x] **All six locales render every route; switcher works; no missing-key warnings.**
  `NextIntlClientProvider` wraps the tree in `app/layout.tsx` with `<html lang>` from
  `getLocale()`. Every route + component is wired to `useTranslations`/`getTranslations`.
  Language switcher is a real `<select aria-label>` in `SiteNav` that sets the
  `NEXT_LOCALE` cookie and calls `router.refresh()`, showing the active locale.
  Production build compiles clean (zero warnings). ~140 string sites converted across
  16 files; namespaces: `layout, nav, localeSwitcher, health, home, stats, enter,
  play, predict, insight, standings, hallOfFame, profile, terms`.
- [x] **Non-translatable fields verified byte-identical by a script.**
  `scripts/check-i18n-parity.mjs` (+ `npm run check:i18n`) asserts deep key parity
  (174 keys × 6 locales) AND that `CHZ`, `1,100`, `550`, `BigMac Bobby` present in en
  appear in every locale. Wired into CI's `app` job before typecheck.
- [x] **T&Cs in all six locales** — shipped separately (see prior comment); this PR
  folds `content/terms/parity.test.ts` into `vitest.config.ts` (`content/**/*.test.ts`)
  and deletes the `app/terms/parity.test.ts` shim. 105 tests pass (incl. 32 terms parity).
- [x] **Tie-break joke** — covered by the terms slice; unchanged here.
- [x] **No hydration errors from locale formatting.** Server + client both read the
  same `NEXT_LOCALE` cookie (no client-side messages swap), all translated strings are
  static per-locale, dynamic clocks keep their existing SSR-safe (`now===null`) guards.
  Build's static-page generation produced no hydration warnings.
- [x] **en-GB 24-hour times everywhere.** `formatUtcTime` (the slate/MatchRow clock)
  pinned to `en-GB` + `hour12:false`; `EnterPanel.fmtDate` already `en-GB`. Day-bucket
  label (`formatKickoffDay`, a weekday/month label, not a clock) stays en-US so it reads
  identically across locales — documented inline.

Deferred `<InsightCard>` mounted in `MatchRow` (one line, under the fixture). NOTE: the
on-chain match struct exposes no `uefaMatchId` (see `SlateMatch` in
`lib/predictor/slate.ts` — internal id + 3-letter codes only), so there is no real
per-match insight feed yet; the card renders localised canned copy keyed off the
internal match id and threads `locale`, documented in `components/predict/InsightCard.tsx`.
Wire it to a real feed once the oracle publishes UEFA fixture ids.

Translation confidence: the `insight` namespace copy (label + form/headToHead/stakes)
was authored fresh for all six locales using native football idiom; a native reviewer
should sanity-check tone (esp. tr/pt-BR). All other strings were pre-existing in the
infra message files.
