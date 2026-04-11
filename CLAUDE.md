@AGENTS.md

# V Chill Pool — agent onboarding

Living doc: **verify in repo** if behavior drifts. Paths from repo root `vchill-pool/`.

---

## 1. Product snapshot

**What it is:** Casual **NHL playoff** pool: each **pool round** (1–3), participants submit a **12-player** roster (East/West, salary cap, **stars**). Points come from **NHL stats** stored in Supabase. A commissioner syncs data and **pool settings** in **Admin**; players open **Make picks** with a numeric pick code, build a roster on **`/picks/[pick_page_id]`**, and view **standings** and **team** pages.

**Journeys → routes / owners**

| Journey | Route(s) | Primary files |
|--------|----------|-----------------|
| Home / join context | `/` | [`app/page.jsx`](app/page.jsx) |
| Enter pick code | `/make-picks` | [`app/make-picks/page.jsx`](app/make-picks/page.jsx), [`app/make-picks/ui.jsx`](app/make-picks/ui.jsx) — **exactly 6 digits** (input capped); then **`GET /api/check-pick-page?pick_page_id=`** must succeed before navigating to `/picks/…` |
| Build & submit roster | `/picks/[pick_page_id]` | [`app/picks/[pick_page_id]/page.jsx`](app/picks/[pick_page_id]/page.jsx), [`ui.jsx`](app/picks/[pick_page_id]/ui.jsx), [`DeadlineAtForViewer.jsx`](app/picks/[pick_page_id]/DeadlineAtForViewer.jsx) |
| Standings | `/standings` | [`app/standings/page.jsx`](app/standings/page.jsx), [`lib/scoring.js`](lib/scoring.js) |
| Team bio + rounds + compare | `/teams/[slug]` | [`app/teams/[slug]/page.jsx`](app/teams/[slug]/page.jsx), [`TeamBio.jsx`](app/teams/[slug]/TeamBio.jsx), [`ui.jsx`](app/teams/[slug]/ui.jsx) |
| Commissioner | `/admin` | [`app/admin/page.jsx`](app/admin/page.jsx), [`app/admin/ui.jsx`](app/admin/ui.jsx) |

---

## 2. Stack & conventions

- **Next.js** `16.2.2`, **App Router**, **JavaScript only** — [`jsconfig.json`](jsconfig.json) path alias `@/*` (no `tsconfig`).
- **React** `19.2.4`. **No** `"use server"` / Server Actions in `*.js` / `*.jsx` (grep clean); writes go through **`app/api/**/route.js`** handlers.
- **Supabase** `@supabase/supabase-js` — [`lib/supabase/server.js`](lib/supabase/server.js) (RSC / route handlers), [`lib/supabase/browser.js`](lib/supabase/browser.js) (client if needed). Env via [`lib/env.js`](lib/env.js) `requireEnv`.
- **Tailwind** v4 — [`app/globals.css`](app/globals.css) (`@import "tailwindcss"`). **Work Sans** in [`app/layout.jsx`](app/layout.jsx) (`400,600,700,900`); semantic **`h1`–`h6`** heavy weight in globals; **navy** `#163a59` / `#193b5a` in UI; team tri-code colors [`lib/nhl/team-primary-colors.js`](lib/nhl/team-primary-colors.js).
- **NHL HTTP** — `https://api-web.nhle.com/v1/` in [`lib/nhl/api.js`](lib/nhl/api.js) (`nhlFetch`, 429 backoff).
- **Participants CSV** — [`lib/participants/sheet.js`](lib/participants/sheet.js) + env `PARTICIPANTS_SHEET_URL`.

**Where code lives**

- **Routes & layouts:** `app/` — RSC by default; **`"use client"`** on picker, admin UI, team compare UI, teams menu, etc.
- **Shared chrome:** [`app/_components/SiteHeader.jsx`](app/_components/SiteHeader.jsx), [`app/_components/TeamsMenuClient.jsx`](app/_components/TeamsMenuClient.jsx).
- **Domain logic:** `lib/` (scoring, pool settings, pick rules, NHL, eligibility, [`lib/roster-slot-order.js`](lib/roster-slot-order.js) for team table slot order aligned with picks UI).

**Next.js 16** — short pointer in [`AGENTS.md`](AGENTS.md) (read `node_modules/next/dist/docs/` if APIs surprise you).

---

## 3. Local dev & verification

**Scripts** ([`package.json`](package.json))

| Command | Purpose |
|---------|---------|
| `npm run dev` | `next dev` (local app, default port 3000) |
| `npm run build` | Production build |
| `npm run start` | Serve `.next` after `build` |
| `npm run lint` | ESLint |
| `npm run seed:demo-picks -- --slug-a=… --slug-b=…` | Dev-only: seed two participants’ picks (see [`scripts/seed-demo-picks.mjs`](scripts/seed-demo-picks.mjs)); needs Node **20+** `node --env-file=.env.local` pattern (script header) |
| `npm run reset:season-picks` | Clears **all** `picks` for resolved/latest season; sets `pool_settings.current_round` to **1** if a row exists ([`scripts/reset-season-picks.mjs`](scripts/reset-season-picks.mjs)) |

**Smoke (manual)**

- `http://localhost:3000` — home + header nav.
- `/make-picks` — six-digit codes only (extra digits stripped); unknown code → error under button, no navigation. Valid code → **`GET /api/check-pick-page`** → `/picks/{id}`.
- `/picks/123456` — dynamic segment must match **`/^\d{6}$/`** or **`notFound()`** ([`app/picks/[pick_page_id]/page.jsx`](app/picks/[pick_page_id]/page.jsx)) (e.g. `/picks/1234567` is 404).
- `/standings`, `/teams/[slug]`, `/admin` — need env + data; watch **terminal** (RSC / server logs) and **browser Network** for `/api/*`.
- **Supabase dashboard** — Table Editor / logs for failed writes or RLS.

**Automated tests**

- **None** — no Jest/Vitest/Playwright config and no `*.test.*` / `*.spec.*` files. QA: **manual** + `npm run lint` + `npm run build`.

---

## 4. Environment variables

| Name | Required? | Read in | Purpose |
|------|-----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (boot) | [`lib/supabase/server.js`](lib/supabase/server.js), [`lib/supabase/browser.js`](lib/supabase/browser.js) | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Yes | same | Publishable key (name is **not** `ANON_KEY`) |
| `PARTICIPANTS_SHEET_URL` | For sheet sync | [`lib/participants/sheet.js`](lib/participants/sheet.js) | Public CSV URL for participant sync |
| `ADMIN_PASSWORD` | For protected admin APIs | [`app/api/pool-settings/route.js`](app/api/pool-settings/route.js), [`app/api/sync-stats/route.js`](app/api/sync-stats/route.js) | `PUT /api/pool-settings` returns **503** if unset; stats auth when `SYNC_STATS_SECRET` is set |
| `SYNC_STATS_SECRET` | Optional | [`app/api/sync-stats/route.js`](app/api/sync-stats/route.js) | If set, `GET /api/sync-stats` requires Bearer / `x-sync-stats-secret` / matching `x-admin-password` |
| `NEXT_PUBLIC_SITE_URL` | Optional | [`app/layout.jsx`](app/layout.jsx) | `metadataBase` for OG/Twitter |
| `VERCEL_URL` | On Vercel | [`app/layout.jsx`](app/layout.jsx) | Fallback host for `metadataBase` |

**GitHub Actions** — repo secrets `STATS_SYNC_BASE_URL`, `SYNC_STATS_SECRET`: [`.github/workflows/sync-playoff-stats.yml`](.github/workflows/sync-playoff-stats.yml).

Do **not** commit `.env*`.

---

## 5. Data model / Supabase

**RLS:** No policy SQL in repo ([`sql/`](sql/)). Assume **RLS off** or policies maintained in the Supabase dashboard.

**Tables (from code)**

| Table | Columns / usage (representative) |
|-------|----------------------------------|
| `participants` | `id`, `name`, `slug`, `pick_page_id` (unique), `location`, `fav`, `linkedin` — sheet sync [`app/api/sync-participants/route.js`](app/api/sync-participants/route.js); team page [`app/teams/[slug]/page.jsx`](app/teams/[slug]/page.jsx), bio [`TeamBio.jsx`](app/teams/[slug]/TeamBio.jsx). Upsert `onConflict: pick_page_id`. |
| `players` | `id`, `nhl_id`, `name`, `team`, `team_abbrev`, `position`, `conference`, `salary`, `season`, `season_points` — sync, picker, picks FK. |
| `picks` | `participant_id`, `player_id`, `round` (pool **1–3**; legacy **4** → pool 3 in [`lib/scoring.js`](lib/scoring.js)), `season` (**text** 8-digit), `is_star`, `submitted_at`. |
| `stats` | `nhl_id`, `season`, `round` (NHL **1–4**), goals/assists + goalie fields (column names probed in sync-stats). |
| `pool_settings` | PK `season`; `current_round` 1–3; `deadline_r1`–`deadline_r3`; `eligible_teams_r1`–`r3` (`text[]`); `stats_sync_limit`, `stats_sync_concurrency`; `updated_at` — [`lib/pool-settings.js`](lib/pool-settings.js), Admin + submit validation. |

**Season** — string everywhere (e.g. `20242025`) for `picks`, `pool_settings`, `.eq("season", …)`.

**SQL helpers (no `supabase/` migrations folder)** — run in Supabase SQL editor as needed:

- [`sql/pool_settings.sql`](sql/pool_settings.sql), [`sql/pool_settings_eligible_teams.sql`](sql/pool_settings_eligible_teams.sql), [`sql/pool_settings_stats_sync_defaults.sql`](sql/pool_settings_stats_sync_defaults.sql), [`sql/participants_bio_columns.sql`](sql/participants_bio_columns.sql)

**Gotchas**

- `GET /api/sync-stats` with **`offset=0`** deletes all **`stats`** for that `season` before import.
- Replacing **`players`** rows can invalidate **`picks.player_id`** FKs (ops).

---

## 6. API (Route Handlers only)

All handlers: `app/api/**/route.js`. **`export const maxDuration = 60`** on: [`sync-participants`](app/api/sync-participants/route.js), [`sync-players`](app/api/sync-players/route.js), [`sync-stats`](app/api/sync-stats/route.js), [`sync-regular-season`](app/api/sync-regular-season/route.js) — not on `check-pick-page`, `pool-settings`, `playoff-teams`, `picks/submit`, `team-summary`.

Common error JSON: `{ ok: false, error }` or `{ ok: false, step, error }`.

| Method | Path | Auth | Query / body | Success / effects | Typical errors |
|--------|------|------|----------------|-------------------|----------------|
| `GET` | `/api/sync-participants` | None | — | Sheet → upsert `participants` | `500` (missing URL, sheet, DB) |
| `GET` | `/api/sync-players` | None | `year` (default `2025`) | Replace `players` for derived `season` | `500` / empty data |
| `GET` | `/api/playoff-teams` | None | **`year`** required | `{ ok, year, season, teams }` | `400`, `502` |
| `GET` | `/api/sync-stats` | If `SYNC_STATS_SECRET`: Bearer / `x-sync-stats-secret` / `x-admin-password` | `year`, `limit`, `offset` (default `0`), `concurrency` (default **2**, clamp 1–10) | Batch stats; **`offset=0`** wipes `stats` for season | `401`, `500` |
| `GET` | `/api/sync-regular-season` | None | `year`, `limit`, `offset`, `concurrency` (defaults in route) | Updates `players.season_points` | `500` |
| `GET` | `/api/pool-settings` | None | **`season`** required | `{ ok, settings }` | `400`, `500` |
| `PUT` | `/api/pool-settings` | `ADMIN_PASSWORD` via `x-admin-password` or body `admin_password` | JSON: `season`, `current_round`, deadlines, optional `eligible_teams_r*`, optional `stats_sync_*` | Upsert + eligible ∩ bracket | `503` (no password), `401`, `400`, `502`, `500` |
| `POST` | `/api/picks/submit` | None (public) | JSON: `pick_page_id`, `season`, `round` (1–3), `roster` (12 NHL ids), `stars` | Validates deadlines, eligibility, [`lib/pick-roster-rules.js`](lib/pick-roster-rules.js); replaces round picks | `400`, `403`, `404`, `500` |
| `GET` | `/api/team-summary` | None | **`participant_id`**, **`season`** | `{ ok, summary }` via [`computeParticipantSummary`](lib/scoring.js) | `400`, `404`, `500` |
| `GET` | `/api/check-pick-page` | None | **`pick_page_id`** — string must match **`/^\d{6}$/`** (then queried as number) | `{ ok: true }` if `participants` row exists | **`400`** bad format; **`404`** not found; **`500`** DB |

[`app/admin/ui.jsx`](app/admin/ui.jsx) — sync buttons send `x-admin-password` when the password field is filled (needed when `SYNC_STATS_SECRET` is set for stats).

---

## 7. Frontend map

| Area | Files | Notes |
|------|-------|--------|
| Shell + SEO | [`app/layout.jsx`](app/layout.jsx), [`app/globals.css`](app/globals.css) | `SiteHeader`; `metadataBase`; icons / OG images under `app/` |
| Home | [`app/page.jsx`](app/page.jsx) | Marketing |
| Make picks | [`app/make-picks/page.jsx`](app/make-picks/page.jsx), [`ui.jsx`](app/make-picks/ui.jsx) | Digits-only input **max 6**; submit calls [`/api/check-pick-page`](app/api/check-pick-page/route.js) then `location` to `/picks/{code}`; inline error if missing/invalid |
| Picks | [`page.jsx`](app/picks/[pick_page_id]/page.jsx) (`dynamic = "force-dynamic"`), [`ui.jsx`](app/picks/[pick_page_id]/ui.jsx) | **`pick_page_id` param** must be **exactly six digits** or `notFound()`; sortable picker; roster chips; `savedIdsKey` / `useEffect` after `router.refresh()`; client `key` includes round + lock |
| Standings | [`app/standings/page.jsx`](app/standings/page.jsx) | `computeStandingsRows` |
| Teams | [`page.jsx`](app/teams/[slug]/page.jsx), [`ui.jsx`](app/teams/[slug]/ui.jsx) | Rounds table + compare; compare calls `/api/team-summary`; slot order from [`lib/roster-slot-order.js`](lib/roster-slot-order.js) + [`lib/scoring.js`](lib/scoring.js) `computeParticipantSummary` |
| Admin | [`app/admin/page.jsx`](app/admin/page.jsx), [`ui.jsx`](app/admin/ui.jsx) | Syncs, pool form, eligible teams, stats batch fields |

**Gotchas**

- Picks deadline UI: **`suppressHydrationWarning`** in [`DeadlineAtForViewer.jsx`](app/picks/[pick_page_id]/DeadlineAtForViewer.jsx) / picks [`ui.jsx`](app/picks/[pick_page_id]/ui.jsx).
- Dev: flaky HMR → delete `.next`, restart; **`EMFILE`** → `npm run build && npm run start`.

---

## 8. Operational notes

- **Vercel:** `maxDuration` on long sync routes; keep **`sync-stats`** batches modest and concurrency low on Hobby.
- **Workflow:** [`.github/workflows/sync-playoff-stats.yml`](.github/workflows/sync-playoff-stats.yml) — chains `sync-stats` until done; **defaults `limit=8`, `concurrency=1`** (not read from `pool_settings`).
- **Off-season:** avoid scheduled `offset=0` runs that wipe `stats`; disable workflow if unused.
- **NHL:** [`lib/nhl/api.js`](lib/nhl/api.js); stats fetch **`maxRetries: 8`**, **`baseDelayMs: 1500`** in [`app/api/sync-stats/route.js`](app/api/sync-stats/route.js).
- **Bracket / season:** Admin **year** must align with `pool_settings.season` and `players.season` ([`lib/nhl/season.js`](lib/nhl/season.js)).
- **Stats schema drift:** probe insert in [`app/api/sync-stats/route.js`](app/api/sync-stats/route.js).

---

## 9. Project status

**Stable (daily use)**

- Participant sheet → Supabase; picks → standings / team pages; Admin NHL + pool config; optional GitHub stats workflow.
- Team page: multi-round table, compare for current pool round, mobile vs desktop behavior in [`app/teams/[slug]/ui.jsx`](app/teams/[slug]/ui.jsx).

**Forward work (typical)**

- **UI polish** — home copy/spacing [`app/page.jsx`](app/page.jsx); small team/admin tweaks after manual QA.
- **Production URLs** — set `NEXT_PUBLIC_SITE_URL` on Vercel; re-scrape OG debuggers.
- **Workflow vs Admin** — optionally align workflow `limit`/`concurrency` with `pool_settings` (needs auth story for reading settings in CI).
- **Sheet ↔ code** — CSV columns must match `normalizeParticipantRow` in [`app/api/sync-participants/route.js`](app/api/sync-participants/route.js).

**Risks / product constraints**

- Single shared **`ADMIN_PASSWORD`**.
- `GET /api/pool-settings` eligible arrays may not re-intersect bracket until next **Save**.
- NHL / Cloudflare throttling; bracket shape [`lib/nhl/playoff-bracket-teams.js`](lib/nhl/playoff-bracket-teams.js).

**Open TODOs in code**

- No systematic `TODO`/`FIXME` markers in `app/` / `lib/` (last grep clean); treat backlog as product list above.

---

## 10. Session delta

- **Doc update:** Documented **make picks** gate — [`GET /api/check-pick-page`](app/api/check-pick-page/route.js), **six-digit** path rule on [`app/picks/[pick_page_id]/page.jsx`](app/picks/[pick_page_id]/page.jsx), smoke + API table + frontend map.

---

## 11. New / modified files (this session)

- **`CLAUDE.md`** only.

---

## Game rules (short)

- Pool **round 3** = NHL R3+R4 points ([`lib/scoring.js`](lib/scoring.js)).
- Roster: 12 players — 3F/2D/1G per conference; salary cap **`PICK_SALARY_CAP` = 30** ([`lib/pick-roster-rules.js`](lib/pick-roster-rules.js)); 3 stars (one per F/D/G group).
- Scoring: goal/assist 1; goalie win 2, shutout 1; star doubles that pick’s pool-round points.

---

## NHL API (in code)

Base: `https://api-web.nhle.com/v1/` — [`lib/nhl/api.js`](lib/nhl/api.js).

- `/playoff-bracket/{year}` — teams  
- `/standings/{yyyy-mm-dd}` — conferences (`{year}-04-01`)  
- `/roster/{abbrev}/{season}` — players  
- `/player/{id}/game-log/{season}/3` — playoff (stats sync)  
- `/player/{id}/game-log/{season}/2` — regular season  

Playoff **game id** (stats): length 10; `gameId.slice(4,6) === "03"`; round = `Number(gameId.slice(6,8))` (see [`app/api/sync-stats/route.js`](app/api/sync-stats/route.js)).

---

## Commissioner

**David Tucker** (`dftucker@gmail.com`). Participants from a **Google Sheet**; salaries editable in Supabase. Casual friends pool.

---

### Start here

1. **`npm run dev`** → **`http://localhost:3000`**
2. **Shell layout:** [`app/layout.jsx`](app/layout.jsx) + [`app/globals.css`](app/globals.css)
3. **API:** nine handlers under [`app/api/`](app/api/) (see §6; includes [`check-pick-page`](app/api/check-pick-page/route.js))
4. **Supabase:** [`lib/supabase/server.js`](lib/supabase/server.js) — tables **`participants`**, **`players`**, **`picks`**, **`stats`**, **`pool_settings`**; DDL helpers in [`sql/`](sql/)
