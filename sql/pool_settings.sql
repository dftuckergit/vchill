-- Run in Supabase SQL editor (once per project).
create table if not exists pool_settings (
  season text primary key,
  current_round integer not null default 1
    check (current_round in (1, 2, 3)),
  deadline_r1 timestamptz,
  deadline_r2 timestamptz,
  deadline_r3 timestamptz,
  payment_deadline_at timestamptz,
  eligible_teams_r1 text[],
  eligible_teams_r2 text[],
  eligible_teams_r3 text[],
  stats_sync_limit integer not null default 8,
  stats_sync_concurrency integer not null default 1,
  updated_at timestamptz default now()
);

comment on table pool_settings is 'Per-season pool config: active pick round (1–3) and deadlines. Round 3 = R3+4 pick window.';
