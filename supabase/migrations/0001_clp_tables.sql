-- ============================================================================
-- ₵h@mpi0nz Pr3dict0r — migration 0001: all clp_ tables (PRD §13.2)
--
-- HOW TO APPLY: paste this file into the Supabase SQL editor of the existing
-- predictor project (free tier — we reuse the project; all our tables are
-- prefixed clp_ and labelled with a table comment so they never collide with
-- the predecessor's tables).
--
-- CLEANUP IS ONE QUERY — list every table this product owns by its comment:
--
--   select c.relname
--   from pg_class c
--   join pg_namespace n on n.oid = c.relnamespace
--   join pg_description d on d.objoid = c.oid and d.objsubid = 0
--   where n.nspname = 'public'
--     and c.relkind = 'r'
--     and d.description = 'ChampionsLeague predictor';
--
-- SECURITY MODEL: RLS enabled on every table; public (anon) SELECT only.
-- There are NO insert/update/delete policies — all writes go through the
-- service-role key (server routes / relayer), which bypasses RLS.
-- Chain is truth: everything here is a read-model / cache except
-- clp_user_profiles (usernames + countries) and clp_tg_link_codes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. clp_user_profiles — wallet → username/country identity (PRD §13.1)
--    Rate-limit bookkeeping (last_write_at / window_*) lives on the row so the
--    limit is DB-backed and serverless-safe (no in-memory counters).
-- ----------------------------------------------------------------------------
create table if not exists public.clp_user_profiles (
  wallet_address    text        not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  chain_id          integer     not null check (chain_id in (88882, 88888)),
  username          text        not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  country_code      text        not null check (country_code ~ '^[A-Z]{2}$'),
  telegram_user_id  bigint,
  telegram_handle   text,
  entry_tier        text        check (entry_tier in ('full_season', 'knockout')),
  last_write_at     timestamptz,
  window_started_at timestamptz,
  window_writes     integer     not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  primary key (wallet_address, chain_id),
  unique (username, chain_id)
);
comment on table public.clp_user_profiles is 'ChampionsLeague predictor';

-- Usernames are unique per chain case-insensitively too ("Rikkert" vs "rikkert").
create unique index if not exists clp_user_profiles_username_ci
  on public.clp_user_profiles (lower(username), chain_id);

-- ----------------------------------------------------------------------------
-- 2. clp_match_cache — on-chain matchId ↔ UEFA / football-data ids + score
-- ----------------------------------------------------------------------------
create table if not exists public.clp_match_cache (
  chain_id               integer     not null check (chain_id in (88882, 88888)),
  match_id               integer     not null,
  uefa_match_id          text,
  football_data_home_id  integer,
  football_data_away_id  integer,
  team_a                 text,
  team_b                 text,
  stage                  smallint,
  kickoff                timestamptz,
  status                 text,
  score                  jsonb,
  updated_at             timestamptz not null default now(),
  primary key (chain_id, match_id)
);
comment on table public.clp_match_cache is 'ChampionsLeague predictor';

-- ----------------------------------------------------------------------------
-- 3. clp_leaderboard — per-stage points cache (read-model; chain is truth)
-- ----------------------------------------------------------------------------
create table if not exists public.clp_leaderboard (
  chain_id       integer     not null check (chain_id in (88882, 88888)),
  stage          smallint    not null,
  wallet_address text        not null,
  points         integer     not null default 0,
  rank           integer,
  updated_at     timestamptz not null default now(),
  primary key (chain_id, stage, wallet_address)
);
comment on table public.clp_leaderboard is 'ChampionsLeague predictor';

create index if not exists clp_leaderboard_stage_points
  on public.clp_leaderboard (chain_id, stage, points desc);

-- ----------------------------------------------------------------------------
-- 4. clp_oracle_log — relayer runs, result pushes, corrections, alerts
--    (feeds the admin console + Telegram heartbeat)
-- ----------------------------------------------------------------------------
create table if not exists public.clp_oracle_log (
  id         bigint generated always as identity primary key,
  chain_id   integer,
  kind       text        not null check (kind in ('run', 'result_push', 'correction', 'alert', 'heartbeat')),
  match_id   integer,
  tx_hash    text,
  detail     jsonb,
  created_at timestamptz not null default now()
);
comment on table public.clp_oracle_log is 'ChampionsLeague predictor';

create index if not exists clp_oracle_log_created
  on public.clp_oracle_log (created_at desc);

-- ----------------------------------------------------------------------------
-- 5. clp_tg_link_codes — one-time Telegram linking codes, TTL'd (PRD §12)
-- ----------------------------------------------------------------------------
create table if not exists public.clp_tg_link_codes (
  code           text        primary key,
  wallet_address text        not null,
  chain_id       integer     not null check (chain_id in (88882, 88888)),
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);
comment on table public.clp_tg_link_codes is 'ChampionsLeague predictor';

create index if not exists clp_tg_link_codes_expiry
  on public.clp_tg_link_codes (expires_at);

-- ----------------------------------------------------------------------------
-- Row-level security: public SELECT on everything, no anon writes anywhere.
-- The service-role key bypasses RLS, so server routes / the relayer write.
-- ----------------------------------------------------------------------------
alter table public.clp_user_profiles enable row level security;
alter table public.clp_match_cache   enable row level security;
alter table public.clp_leaderboard   enable row level security;
alter table public.clp_oracle_log    enable row level security;
alter table public.clp_tg_link_codes enable row level security;

create policy clp_user_profiles_public_read on public.clp_user_profiles
  for select using (true);
create policy clp_match_cache_public_read on public.clp_match_cache
  for select using (true);
create policy clp_leaderboard_public_read on public.clp_leaderboard
  for select using (true);
create policy clp_oracle_log_public_read on public.clp_oracle_log
  for select using (true);
-- Link codes are short-lived, single-use and bound to a wallet; public read
-- follows the blanket PRD rule. Tighten to service-role-only if slice 06/10
-- decides the bot never needs anon reads.
create policy clp_tg_link_codes_public_read on public.clp_tg_link_codes
  for select using (true);

-- No INSERT/UPDATE/DELETE policies on purpose: with RLS enabled and no
-- matching policy, anon/authenticated writes are rejected outright.
