-- Adds commissioner-facing sync status fields to pool_settings.
-- Run in Supabase SQL editor.

alter table if exists public.pool_settings
  add column if not exists stats_last_sync_started_at timestamptz null,
  add column if not exists stats_last_sync_completed_at timestamptz null,
  add column if not exists stats_last_sync_total_players integer null,
  add column if not exists stats_last_sync_processed_players integer null,
  add column if not exists stats_last_sync_ok boolean null,
  add column if not exists stats_last_sync_error text null;

