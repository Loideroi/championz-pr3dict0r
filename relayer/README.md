# relayer/ — UEFA results oracle workspace

Initialized in build slices 04–05 (`.scratch/championz-predictor/issues/`).

Shape (PRD §7–8):

- All feed access through the `ResultSource` interface; `UefaApiSource` first
  (vendored `uefa-api` types + zod validation), `FootballDataSource` as fallback
- Runs on **GitHub Actions cron** (Vercel Hobby crons are daily-only); every 5 min in
  matchday windows, hourly otherwise; concurrency-grouped; idempotent before every push
- Writes the **90-minute score** (`score.regular`) + ET/pens/advancer flags derived
  from `winner.match.reason`; mirror-UEFA verbatim (D6) — no result filtering
- Signer: `ORACLE_PRIVATE_KEY` (gas only, `RESULT_ORACLE_ROLE`), from Actions secrets
- Health: zod drift → SOURCE_SCHEMA_CHANGED, staleness watchdog → SOURCE_STALE,
  Telegram DM alerts + daily heartbeat (slice 06)
