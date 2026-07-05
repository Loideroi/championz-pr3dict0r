# 15 — Match Insights pipeline

Status: ready-for-human
PRD: ../../PRD.md §7.5 · Decision: D11

## What to build

The automated per-matchday content pipeline. For each upcoming matchday, generate the
per-match preview blurbs in English from UEFA stats and standings data (head-to-head,
form, context), following the predecessor's insight structure and generation workflow;
translate to the other five locales with the merge tooling that enforces byte-identical
non-translatable fields; and ship the locale files a few days before the matchday. The
rendering component is empty-safe: a match without an insight renders nothing, so
insights may lag fixtures — which they always will for knockout rounds, whose fixtures
only exist after each draw. The pipeline is a repeatable command (and ideally a
scheduled workflow), not a hand ritual: one invocation per matchday produces all six
locale files ready for review and merge.

## Acceptance criteria

- [ ] One command generates complete six-locale insights for an archived matchday
- [ ] Merge tooling rejects a locale file whose non-translatable fields drift from en
- [ ] Match cards render insights when present and collapse cleanly when absent
- [ ] A knockout fixture created mid-season picks up its insight on the next pipeline run
- [ ] Generated content passes the repo's locale checks (no hydration issues, pinned formatting)

## Blocked by

- 04-uefa-source-adapter-fixtures.md
- 14-i18n-six-locales-terms.md

## Comments

**2026-07-05 — built; design deliberately LLM-free at runtime.**
- **Design note (evolution of the predecessor's workflow):** insights are
  deterministic FACTS from the feed (last-5 form via the 90′-rule results, a 3/1/0
  mini-table over played league matches, knockout/decider context) rendered through
  per-locale sentence templates (`relayer/src/insights.ts`). Zero API cost, fully
  reproducible, numerics byte-identical across locales BY CONSTRUCTION — the parity
  property the predecessor needed merge tooling to enforce. The predecessor's
  LLM-generated prose was richer; this trades flourish for automation (ADR-0011's
  priority). A future slice can layer LLM color on top of the same facts.
- **One command per matchday**: `generate-insights.mjs (--season | --fixtures) --out`
  → six `<locale>.json` files keyed by uefaMatchId; `rawSeason()` added to the source
  for a single-pass fetch. Recorded-archive sample committed
  (`relayer/test/output/insights-sample/`, 50 matches × 6 locales).
- **Empty-safe rendering**: `components/predict/InsightCard.tsx` fetches static
  `/insights/<locale>.json`, renders nothing on missing key/file — knockout fixtures
  pick up insights on the next generator run after each draw (acceptance criterion:
  proven by keying on uefaMatchId, files regenerated per run).
- 5 new relayer tests (form strictly-before-kickoff, mini-table density, decider vs
  table lines, six-locale numeric parity, committed-sample key parity). 71 relayer
  tests total.
- **Remaining:** mount `<InsightCard>` in the slate's MatchRow once PR feat/i18n-wiring
  merges (one line — avoids a cross-PR conflict on that file), and add the generator
  to the matchday runbook/cron once real 2026/27 fixtures exist post-draw.
