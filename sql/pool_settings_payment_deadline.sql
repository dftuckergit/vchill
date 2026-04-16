-- Run once in Supabase SQL editor if `payment_deadline_at` is missing.
alter table pool_settings
  add column if not exists payment_deadline_at timestamptz;

comment on column pool_settings.payment_deadline_at is
  'Pay-by moment for home page copy (US Eastern wall time in admin UI; stored UTC).';
