# 04 — UEFA source adapter + fixture generation

Status: ready-for-human
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

## Comments

**2026-07-04 — agent (slice built, PR open):**
https://github.com/Loideroi/championz-pr3dict0r/pull/3 · branch `feat/uefa-source-adapter` ·
`npm run typecheck` + `npm test` (43 tests) green inside `relayer/`. Per-criterion evidence:

- ✅ **Recorded live payload + field-for-field zod schemas** — captured live on
  2026-07-04 (no network blocks): `relayer/test/fixtures/matches-ucl-2026-first20.json`
  (the exact URL from the spec, `competitionId=1&seasonYear=2026&limit=20&offset=0` —
  seasonYear=2026 was non-empty, no 2025 fallback needed) + `matches-ucl-2026-aet.json`
  (50-match knockout batch) + `capture-meta.json` (request log). `relayer/src/schema.ts`
  parses both in `test/schema.test.ts`. Schema surprises locked in: `matchNumber` is
  `null`; undocumented `competitionPhase: QUALIFYING|TOURNAMENT` (the season feed
  includes 92 qualifying matches); the feed default sort is date-DESCENDING.
- ✅ **Real AET match, regular ≠ total → 90′ + ET/pens/advancer** — two real AET matches
  in the archive: `2048061` Sporting 3-0 (90′) / 5-0 aet, and `2047770` Juventus 3-0
  (90′) but **Galatasaray** advance in ET — which exposed the key subtlety: on legs
  `winner.match.reason` stays `WIN_REGULAR`; the tie outcome lives in
  `winner.aggregate.reason/team`. Also covered: the final `2047742` (Paris 1-1 Arsenal,
  4-3 pens → penalties+extraTime true, 90′ score stays 1-1). `test/result.test.ts`.
- ✅ **generate-matches.mjs for the archived 2025/26 season incl. tie wiring** —
  committed evidence `relayer/test/output/matches-sample.json` (recorded fixtures →
  50 matches, all 22 knockout ties with legs 1+2, shared `tieId`, final = SINGLE with
  no tie). Live full-season run (logged, not committed): 36 teams, 189 matches
  (144 league + 16 + 16 + 8 + 4 + 1), 22 complete ties, zero warnings.
- ✅ **Verifier passes archive / fails loudly on scramble** — `verify-fixtures.mjs`
  joins by kickoff date + ordered team names (numbering-independent, orientation-aware).
  Exit 0 + "0 discrepancies" on the untouched archive; exit 1 + named diff on scrambled
  feeders, home/away swap, +90 min kickoff, wrong uefaMatchId, missing match — all five
  fail modes proven in `test/scripts.test.ts` via real CLI exit codes.
- ✅ **Malformed payload → typed zod error** — deleted `score.regular`, drifted `status`
  enum, string goal count, missing `homeTeam.id`: all rejected with `ZodError` + exact
  issue paths; unknown EXTRA fields tolerated. `UefaApiSource` wraps drift in
  `SourceSchemaError` and `health()` classifies it as `SOURCE_SCHEMA_CHANGED`.
- ✅ **FootballDataSource stub behind the same interface** — compiles as
  `ResultSource`, `health()` responds (not-ok, "stub"), data methods throw
  `NotImplementedError`; smoke tests in `test/source.test.ts`.
- Vendoring: `relayer/vendor/uefa-api-types.ts` = uefa-api v1.0.2 dist `.d.ts` verbatim
  with provenance header; the npm dep was installed once and removed.
- Snyk code scan: 5 × Low `javascript/PT` (CLI `--from/--out` paths into fs read/write
  in the three local dev scripts). Reviewed + accepted: operator-run tooling, the path
  IS the operator's own argument, no untrusted input boundary; sandboxing would break
  legitimate use (tests write to os.tmpdir()). No other findings.
- Blocked criteria: none.
