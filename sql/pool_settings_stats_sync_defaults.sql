-- Run in Supabase SQL editor once (adds persisted defaults for manual + documented GitHub Actions tuning).
alter table pool_settings
  add column if not exists stats_sync_limit integer not null default 8;

alter table pool_settings
  add column if not exists stats_sync_concurrency integer not null default 1;

comment on column pool_settings.stats_sync_limit is 'Default batch size for GET /api/sync-stats (Admin + optional automation). App clamps 1–100.';
comment on column pool_settings.stats_sync_concurrency is 'Default NHL parallel fetches per stats batch. App clamps 1–10.';
