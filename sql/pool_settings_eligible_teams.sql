-- Run in Supabase SQL editor if you already created `pool_settings` without these columns.
alter table pool_settings
  add column if not exists eligible_teams_r1 text[];

alter table pool_settings
  add column if not exists eligible_teams_r2 text[];

alter table pool_settings
  add column if not exists eligible_teams_r3 text[];

comment on column pool_settings.eligible_teams_r1 is 'If non-null and non-empty, only these team_abbrevs appear in the pool R1 pick list.';
comment on column pool_settings.eligible_teams_r2 is 'Same for pool R2.';
comment on column pool_settings.eligible_teams_r3 is 'Same for pool R3+4.';
