-- 002_price_cache_meta.sql
-- Add ticker metadata columns to price_cache so the validate endpoint
-- can persist name/sector/asset_type across server restarts.

alter table price_cache
  add column if not exists name       text,
  add column if not exists sector     text,
  add column if not exists asset_type text default 'stock';
