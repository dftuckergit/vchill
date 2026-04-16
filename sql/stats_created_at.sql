-- Run once in Supabase SQL editor so standings can show “last playoff stats” time.
alter table stats
  add column if not exists created_at timestamptz default now();

comment on column stats.created_at is
  'When this row was written (playoff stats sync). New inserts set explicitly per sync batch.';
