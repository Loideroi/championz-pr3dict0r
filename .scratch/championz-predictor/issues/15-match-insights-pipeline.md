# 15 — Match Insights pipeline

Status: ready-for-agent
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
