-- Run once in Supabase SQL Editor if `participants` predates sheet columns
-- `location`, `fav`, `linkedin` (Google Sheet → sync-participants)

alter table participants
  add column if not exists location text,
  add column if not exists fav text,
  add column if not exists linkedin text;
