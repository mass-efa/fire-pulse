-- 001_initial.sql
-- No Supabase Auth. All auth is custom phone OTP + JWT.

-- ─── USERS ────────────────────────────────────────────────────────────────────
create table users (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  phone                text not null unique,        -- E.164 e.g. +14155550123
  am_briefing_enabled  boolean default true,
  pm_briefing_enabled  boolean default true,
  created_at           timestamptz default now(),
  last_login_at        timestamptz
);

-- ─── OTP CODES ────────────────────────────────────────────────────────────────
-- Short-lived, single-use login codes. Shared by signup and login flows.
create table otp_codes (
  id          uuid primary key default gen_random_uuid(),
  phone       text not null,
  code        text not null,                        -- 6-digit string
  expires_at  timestamptz not null,                 -- now() + 10 minutes
  used        boolean default false,
  attempts    int default 0,                        -- failed verify attempts
  blocked     boolean default false,                -- true after 5 failed attempts
  created_at  timestamptz default now()
);

create index otp_phone_idx on otp_codes(phone);

-- Cleanup job: delete expired OTP rows nightly (handled by scheduler)
-- delete from otp_codes where expires_at < now();

-- ─── HOLDINGS ─────────────────────────────────────────────────────────────────
-- Manual entry only for MVP. CSV import is V2.
create table holdings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id) on delete cascade,
  ticker      text not null,
  name        text not null,                        -- auto-filled from Yahoo Finance on entry
  shares      numeric not null,
  avg_cost    numeric not null,
  asset_type  text default 'stock',                 -- stock | etf | crypto | bond | option
  sector      text,                                 -- auto-filled from Yahoo Finance on entry
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── PRICE CACHE ──────────────────────────────────────────────────────────────
-- Prevents redundant API calls. All users share cached prices.
-- Cache is valid for 15 minutes. Checked before any live fetch.
create table price_cache (
  ticker      text primary key,
  price       numeric not null,
  change_pct  numeric,                              -- day change %
  source      text default 'yahoo',                 -- 'yahoo' | 'alphavantage'
  fetched_at  timestamptz default now()
);

-- ─── PORTFOLIO SNAPSHOTS ───────────────────────────────────────────────────────
-- One snapshot per user per day (AM briefing only).
-- If no new snapshot exists, agent uses the most recent one available.
create table portfolio_snapshots (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references users(id) on delete cascade,
  snapshot_date  date not null default current_date,
  holdings_json  jsonb not null,                    -- full holdings with prices at snapshot time
  total_value    numeric,
  created_at     timestamptz default now(),
  unique(user_id, snapshot_date)                    -- one per user per day
);

-- ─── BRIEFINGS ────────────────────────────────────────────────────────────────
create table briefings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references users(id) on delete cascade,
  briefing_type    text not null,                   -- 'am' | 'pm'
  status           text default 'pending',          -- 'pending' | 'completed' | 'failed'
  content_full     text,                            -- full markdown briefing (null if failed)
  content_sms      text,                            -- condensed SMS version ~280 chars
  market_snapshot  jsonb,                           -- prices at time of run
  error_log        text,                            -- error message if status = 'failed'
  retry_count      int default 0,                   -- max 1 retry
  sent_at          timestamptz default now()
);
