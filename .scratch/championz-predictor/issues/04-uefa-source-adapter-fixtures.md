# 04 — UEFA source adapter + fixture generation

Status: ready-for-agent
PRD: ../../PRD.md §7 · Decision: D6 (feed is truth)

## What to build

The data layer that makes UEFA's unofficial API safe to depend on. Vendor the
`uefa-api` package's type definitions (the package is dormant; we own our copy), wrap
all access in one `ResultSource` interface (fixtures / result / livescore / health),
and validate every response with zod so schema drift is a loud failure. Close the
PRD's last open item: capture one live `match.uefa.com/v5` payload for UCL
(`competitionId=1`) and lock the real field names — especially `score.regular` vs
`score.total`, penalty data, and `winner.match.reason` — into the zod schemas and a
recorded test fixture. Build the generator that turns the feed into the single
`matches.json` (teams, matchIds, phases, kickoffs, `uefaMatchId`, `tieId`,
`legNumber`), exercised against the archived 2025/26 season. Re-point the
predecessor's fixture and bracket verification scripts at the UEFA feed, keeping the
numbering-independent comparison.

## Acceptance criteria

- [ ] One recorded live payload checked into test fixtures; zod schemas match it field-for-field
- [ ] A real AET match from the archive shows `regular ≠ total` and parses into 90′ score + ET/pens/advancer flags correctly
- [ ] `generate-matches.mjs` produces a valid matches.json for the archived 2025/26 season, including two-legged tie wiring
- [ ] Verification scripts pass against the archive and fail loudly when a feeder is deliberately scrambled
- [ ] A deliberately malformed payload fails zod validation with a typed error (no silent undefined)
- [ ] `FootballDataSource` fallback is stubbed behind the same interface (compiles, one smoke test)

## Blocked by

- 01-repo-bootstrap-ways-of-working.md
