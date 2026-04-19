@AGENTS.md

# V Chill Pool — agent onboarding

Living doc: **verify in repo** if behavior drifts. Repo root: `vchill-pool/`. For Next.js 16 API surprises, see [`AGENTS.md`](AGENTS.md).

---

## 1. Product snapshot

**What it is:** A casual **NHL playoff** pool. Each **pool round** (1–3), participants build a **12-player** roster (East/West, salary cap **30**, three **stars**). Points come from **NHL stats** stored in **Supabase** (`stats` + `picks` + `lib/scoring.js`). A commissioner syncs NHL/participants/pool config in **`/admin`**; players use a **6-digit pick code** on **`/make-picks`**, then **`/picks/[pick_page_id]`** to submit; everyone views **`/standings`** and per-team **`/teams/[slug]`** (discover teams from standings links, not the header).

**Journeys → routes → primary files**

| Journey | Route(s) | Primary files |
|--------|----------|----------------|
| Home | `/` | [`app/page.jsx`](app/page.jsx), [`app/_components/HomePaymentDeadline.jsx`](app/_components/HomePaymentDeadline.jsx) (payment line from `pool_settings`) |
| Enter pick code | `/make-picks` | [`app/make-picks/page.jsx`](app/make-picks/page.jsx), [`app/make-picks/ui.jsx`](app/make-picks/ui.jsx) — digits only, **max 6**; then **`GET /api/check-pick-page?pick_page_id=`** → navigate to `/picks/{id}` |
| Build / submit roster | `/picks/[pick_page_id]` | [`app/picks/[pick_page_id]/page.jsx`](app/picks/[pick_page_id]/page.jsx) (`dynamic = "force-dynamic"`), [`ui.jsx`](app/picks/[pick_page_id]/ui.jsx), [`DeadlineAtForViewer.jsx`](app/picks/[pick_page_id]/DeadlineAtForViewer.jsx), [`ScoringExplainer.jsx`](app/picks/[pick_page_id]/ScoringExplainer.jsx) (RSC child into client `PicksClient`) |
| Standings | `/standings` | [`app/standings/page.jsx`](app/standings/page.jsx), [`lib/scoring.js`](lib/scoring.js), [`app/_components/StandingsLastUpdated.jsx`](app/_components/StandingsLastUpdated.jsx) |
| Pick submission grid (commissioner-style; **not in nav**) | `/status` | [`app/status/page.jsx`](app/status/page.jsx), [`lib/pick-submission-status.js`](lib/pick-submission-status.js), [`app/_components/StatusLastRefreshed.jsx`](app/_components/StatusLastRefreshed.jsx) |
| Team detail + compare | `/teams/[slug]` | [`app/teams/[slug]/page.jsx`](app/teams/[slug]/page.jsx), [`TeamBio.jsx`](app/teams/[slug]/TeamBio.jsx), [`ui.jsx`](app/teams/[slug]/ui.jsx) — compare uses **`GET /api/team-summary`** |
| Admin | `/admin` | [`app/admin/page.jsx`](app/admin/page.jsx), [`app/admin/ui.jsx`](app/admin/ui.jsx) |

**Rules (short):** Pool round **3** = NHL rounds **3+4** points ([`lib/scoring.js`](lib/scoring.js) `poolRoundFromPickRound`). Roster rules + cap: [`lib/pick-roster-rules.js`](lib/pick-roster-rules.js) (`PICK_SALARY_CAP`). Scoring: goal/assist **1**; goalie win **2**, shutout **1**; **star** doubles that pick’s pool-round points.

---

## 2. Stack & conventions

- **Next.js** `16.2.2`, **App Router**, **React** `19.2.4` — [`package.json`](package.json). **JavaScript only:** [`jsconfig.json`](jsconfig.json) path alias `@/*` (no `tsconfig`).
- **No Server Actions:** no `"use server"` in `*.js` / `*.jsx`. Mutations = **`app/api/**/route.js`** only.
- **Supabase** `@supabase/supabase-js` — [`lib/supabase/server.js`](lib/supabase/server.js) (RSC + route handlers), [`lib/supabase/browser.js`](lib/supabase/browser.js). Env: [`lib/env.js`](lib/env.js) `requireEnv`.
- **Tailwind v4** — [`app/globals.css`](app/globals.css) (`@import "tailwindcss"`). **Light-only UI:** `html { color-scheme: light; }` in globals; [`app/layout.jsx`](app/layout.jsx) `body` uses `bg-white text-zinc-900`; `metadata.colorScheme: "light"` (Next may warn to move to `viewport` — build-time only).
- **Fonts / brand:** Work Sans in [`app/layout.jsx`](app/layout.jsx); headings `font-black` in globals; navy **`#163a59`**, header **`#193b5a`**; team colors [`lib/nhl/team-primary-colors.js`](lib/nhl/team-primary-colors.js).
- **NHL HTTP:** `https://api-web.nhle.com/v1/` — [`lib/nhl/api.js`](lib/nhl/api.js) `nhlFetch` (429 backoff).
- **Pool year in app:** [`lib/current-pool.js`](lib/current-pool.js) `CURRENT_POOL_PLAYOFF_YEAR` (**2026** today) → `currentPoolSeasonId()` for season string **`20252026`**. Admin UI imports this for sync URLs and copy.

**Where things live**

- **Routes:** `app/**/page.jsx`, layouts [`app/layout.jsx`](app/layout.jsx).
- **Shared UI:** `app/_components/` — e.g. [`SiteHeader.jsx`](app/_components/SiteHeader.jsx), [`MobileNavMenu.jsx`](app/_components/MobileNavMenu.jsx) (mobile overlay menu; **Make picks** + **Standings** only).
- **Domain logic:** `lib/` — scoring, pool settings, pick rules, NHL, eligibility, [`lib/roster-slot-order.js`](lib/roster-slot-order.js).

---

## 3. Local dev & verification

**Scripts** ([`package.json`](package.json))

| Command | Purpose |
|---------|---------|
| `npm run dev` | `next dev` (default **http://localhost:3000**) |
| `npm run build` | Production build |
| `npm run start` | Serve `.next` after `build` |
| `npm run lint` | ESLint |
| `npm run seed:demo-picks -- --slug-a=… --slug-b=…` | Dev seed two participants’ picks — [`scripts/seed-demo-picks.mjs`](scripts/seed-demo-picks.mjs) (uses `node --env-file=.env.local`) |
| `npm run reset:season-picks` | Clears **`picks`** for latest season; resets `pool_settings.current_round` → **1** if row exists — [`scripts/reset-season-picks.mjs`](scripts/reset-season-picks.mjs) |
| `npm run assign:salaries` | [`scripts/assign-player-salaries.mjs`](scripts/assign-player-salaries.mjs) |
| `npm run prune:old-seasons` | [`scripts/prune-noncurrent-player-seasons.mjs`](scripts/prune-noncurrent-player-seasons.mjs) (`--dry-run` / `--execute`) |

**Smoke (manual)**

- `/` — home + header.
- `/make-picks` — invalid code → inline error; valid → `/api/check-pick-page` → `/picks/{code}`.
- `/picks/123456` — param must match **`/^\d{6}$/`** else `notFound()` ([`app/picks/[pick_page_id]/page.jsx`](app/picks/[pick_page_id]/page.jsx)).
- `/standings`, `/teams/[slug]`, `/admin`, `/status` — need **`.env.local`** + Supabase data; watch **terminal** + browser **Network** for `/api/*`.
- **Supabase dashboard:** Table Editor + logs for failed writes / RLS.

**Automated tests**

- **None** — no Jest/Vitest/Playwright in repo; no `*.test.*` / `*.spec.*`. QA = **`npm run lint`** + **`npm run build`** + manual paths above.

**Dev quirks**

- Flaky HMR: delete **`.next`**, restart `dev`. **`EMFILE`:** `npm run build && npm run start`.

---

## 4. Environment variables

| Name | Required? | Read in | Purpose |
|------|------------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (app boot) | [`lib/supabase/server.js`](lib/supabase/server.js), [`lib/supabase/browser.js`](lib/supabase/browser.js) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Yes | same | Publishable key (**not** named `ANON_KEY`) |
| `PARTICIPANTS_SHEET_URL` | For participant sync | [`lib/participants/sheet.js`](lib/participants/sheet.js) | Public CSV URL (`fetch`, `cache: "no-store"`) |
| `ADMIN_PASSWORD` | For `PUT /api/pool-settings` | [`app/api/pool-settings/route.js`](app/api/pool-settings/route.js) | Missing → **503** on PUT |
| `ADMIN_PASSWORD` | Optional auth for `GET /api/sync-stats` | [`app/api/sync-stats/route.js`](app/api/sync-stats/route.js) | When `SYNC_STATS_SECRET` set: header `x-admin-password` must match |
| `SYNC_STATS_SECRET` | Optional | [`app/api/sync-stats/route.js`](app/api/sync-stats/route.js) | If set: `GET /api/sync-stats` requires Bearer, `x-sync-stats-secret`, or matching `x-admin-password` |
| `NEXT_PUBLIC_SITE_URL` | Optional | [`app/layout.jsx`](app/layout.jsx) | `metadataBase` for OG/Twitter |
| `VERCEL_URL` | On Vercel | [`app/layout.jsx`](app/layout.jsx) | Fallback host for `metadataBase` |

**GitHub Actions:** repo secrets **`STATS_SYNC_BASE_URL`**, **`SYNC_STATS_SECRET`** — [`.github/workflows/sync-playoff-stats.yml`](.github/workflows/sync-playoff-stats.yml).

Do **not** commit `.env*`.

---

## 5. Data model / Supabase

**RLS:** No policy SQL in repo. Assume **RLS off** or policies only in Supabase dashboard.

**Tables used in code (representative columns)**

| Table | Usage |
|-------|--------|
| `participants` | `id`, `name`, `slug`, `pick_page_id` (unique), `location`, `fav`, `linkedin` — sync [`app/api/sync-participants/route.js`](app/api/sync-participants/route.js) upsert `onConflict: pick_page_id` (**does not delete** rows removed from sheet). |
| `players` | `id`, `nhl_id`, `name`, `team`, `team_abbrev`, `position`, `conference`, `salary`, `season`, `season_points` — sync, picker, FK from `picks.player_id`. |
| `picks` | `participant_id`, `player_id`, `round` (1–3; legacy **4** = pool round 3), `season` (8-char **text**), `is_star`, `submitted_at`. |
| `stats` | `nhl_id`, `season`, `round` (NHL 1–4), goals/assists + goalie columns (names probed in sync-stats). `created_at` used for “last updated” on standings — see [`sql/stats_created_at.sql`](sql/stats_created_at.sql) if column missing. |
| `pool_settings` | PK `season`; `current_round` 1–3; `deadline_r1`–`deadline_r3`; `payment_deadline_at`; `eligible_teams_r1`–`r3` (`text[]`); `stats_sync_limit`, `stats_sync_concurrency`; `updated_at` — [`lib/pool-settings.js`](lib/pool-settings.js). |

**SQL helpers (no `supabase/migrations` in repo):** run in Supabase SQL editor as needed — [`sql/pool_settings.sql`](sql/pool_settings.sql), [`sql/pool_settings_eligible_teams.sql`](sql/pool_settings_eligible_teams.sql), [`sql/pool_settings_stats_sync_defaults.sql`](sql/pool_settings_stats_sync_defaults.sql), [`sql/pool_settings_payment_deadline.sql`](sql/pool_settings_payment_deadline.sql), [`sql/participants_bio_columns.sql`](sql/participants_bio_columns.sql), [`sql/stats_created_at.sql`](sql/stats_created_at.sql).

**Gotchas**

- **`GET /api/sync-stats?offset=0`:** deletes **all** `stats` for that `season`, then imports.
- **`sync-players`:** delete/re-insert `players` for season; preserves **`salary`** by `nhl_id` when same player returns.

---

## 6. API (route handlers only)

All under **`app/api/**/route.js`**. **`export const maxDuration = 300`** on: `sync-participants`, `sync-players`, `sync-stats`, `sync-regular-season` — not on shorter routes.

Common errors: JSON `{ ok: false, error }` or `{ ok: false, step, error }`.

| Method | Path | Auth | Query / body | Success / side effects | Typical errors |
|--------|------|------|----------------|-------------------------|----------------|
| `GET` | `/api/sync-participants` | None | — | CSV → upsert `participants` | `500` (URL/sheet/DB) |
| `GET` | `/api/sync-players` | None | `year` (default **`2025`** in code if omitted), `extra_teams` | Replace `players` for bracket season + extras | `500` |
| `GET` | `/api/playoff-teams` | None | **`year`** required | `{ ok, year, season, teams }` | `400`, `502` |
| `GET` | `/api/sync-stats` | If `SYNC_STATS_SECRET`: Bearer / `x-sync-stats-secret` / `x-admin-password` | `year` (default **`2025`** in code if omitted), `limit`, `offset` (default `0`), `concurrency` (default **`2`**, clamp 1–10) | Batch insert `stats`; **`offset=0`** wipes season `stats` | `401`, `500` |
| `GET` | `/api/sync-regular-season` | None | `year`, `limit`, `offset`, `concurrency` (see route) | Updates `players.season_points` | `500` |
| `GET` | `/api/pool-settings` | None | **`season`** required | `{ ok, settings }` | `400`, `500` |
| `PUT` | `/api/pool-settings` | `ADMIN_PASSWORD` via `x-admin-password` or body `admin_password` | JSON: `season`, `current_round`, `deadline_r1`–`r3`, optional `payment_deadline_at`, `eligible_teams_r*`, `stats_sync_*` | Upsert `pool_settings`; eligible lists ∩ bracket | `503`, `401`, `400`, `502`, `500` |
| `POST` | `/api/picks/submit` | None (public) | JSON: `pick_page_id`, `season`, `round` (1–3), `roster` (12 NHL ids), `stars` | Validates round vs `current_round`, deadlines, eligibility, [`lib/pick-roster-rules.js`](lib/pick-roster-rules.js); delete+insert picks for that participant/season/round (pool 3 deletes `round IN (3,4)`) | `400`, `403`, `404`, `500` |
| `GET` | `/api/team-summary` | None | **`participant_id`**, **`season`** | `{ ok, summary }` from [`computeParticipantSummary`](lib/scoring.js) | `400`, `404`, `500` |
| `GET` | `/api/check-pick-page` | None | **`pick_page_id`** — must match **`/^\d{6}$/`** | `{ ok: true }` if participant exists | `400`, `404`, `500` |

**Admin UI** ([`app/admin/ui.jsx`](app/admin/ui.jsx)): sync buttons send `x-admin-password` when the password field is filled (needed for stats when `SYNC_STATS_SECRET` is set).

**Note:** Admin passes **`year=CURRENT_POOL_PLAYOFF_YEAR`** (2026) into sync URLs. **`/api/sync-players`** and **`/api/sync-stats`** still default to **`year=2025`** if the query param is omitted (e.g. raw `curl`). GitHub scheduled workflow defaults **`year=2026`** — [`.github/workflows/sync-playoff-stats.yml`](.github/workflows/sync-playoff-stats.yml).

---

## 7. Frontend map

| Screen | Files | Notes |
|--------|-------|--------|
| Shell | [`app/layout.jsx`](app/layout.jsx), [`app/globals.css`](app/globals.css) | `SiteHeader`; `metadataBase`; `colorScheme: "light"` |
| Home | [`app/page.jsx`](app/page.jsx) | Dynamic; payment deadline from Supabase |
| Make picks | [`app/make-picks/page.jsx`](app/make-picks/page.jsx), [`ui.jsx`](app/make-picks/ui.jsx) | Client UI for code entry |
| Picks | [`app/picks/[pick_page_id]/page.jsx`](app/picks/[pick_page_id]/page.jsx), [`ui.jsx`](app/picks/[pick_page_id]/ui.jsx) | Client picker + roster; `ScoringExplainer` passed as **RSC `children`** into `PicksClient` to avoid hydration mismatch with scoring block |
| Standings | [`app/standings/page.jsx`](app/standings/page.jsx) | Table column widths; team → `/teams/[slug]` |
| Status | [`app/status/page.jsx`](app/status/page.jsx) | Table; `StatusLastRefreshed` uses **`useEffect`** for local time display |
| Teams | [`app/teams/[slug]/page.jsx`](app/teams/[slug]/page.jsx), [`ui.jsx`](app/teams/[slug]/ui.jsx) | Compare panel fetches `/api/team-summary` |
| Admin | [`app/admin/page.jsx`](app/admin/page.jsx), [`ui.jsx`](app/admin/ui.jsx) | Client; sync + pool form |

**Gotchas**

- Picks: **`suppressHydrationWarning`** on deadline / countdown UI ([`DeadlineAtForViewer.jsx`](app/picks/[pick_page_id]/DeadlineAtForViewer.jsx), [`ui.jsx`](app/picks/[pick_page_id]/ui.jsx)).
- **`pool_settings` deadlines:** `null` deadline ⇒ submissions not locked for that round; restoring a past deadline locks again ([`lib/pool-settings.js`](lib/pool-settings.js)).

---

## 8. Operational notes

- **Vercel:** Long sync routes use `maxDuration = 300`. Keep **`sync-stats`** batches modest; **`offset=0`** full refresh is destructive for `stats`.
- **GitHub cron:** [`.github/workflows/sync-playoff-stats.yml`](.github/workflows/sync-playoff-stats.yml) — **`0 11 * * *` UTC** (~6 AM Eastern per comment); chains **`GET /api/sync-stats`** until `next_offset >= total_players`; defaults **`year=2026`**, **`limit=8`**, **`concurrency=1`** (workflow script; **not** read from `pool_settings`). **Off-season:** disable workflow so `offset=0` does not run daily.
- **NHL:** [`lib/nhl/api.js`](lib/nhl/api.js); [`app/api/sync-stats/route.js`](app/api/sync-stats/route.js) uses **`maxRetries: 8`**, **`baseDelayMs: 1500`** on game-log fetches.
- **NHL endpoints (in code):** bracket `/playoff-bracket/{year}`, standings `/standings/{yyyy}-04-01`, roster `/roster/{abbrev}/{season}`, game logs `/player/{id}/game-log/{season}/3` (playoff) and `/2` (regular season) — see [`lib/nhl/api.js`](lib/nhl/api.js) call sites.

---

## 9. Project status

**Stable (daily use)**

- Participant CSV → Supabase; picks → standings / teams / scoring; Admin syncs + pool settings; optional **GitHub** stats workflow.
- Picks, standings, teams, admin, status page, mobile nav overlay, light-only theme.

**Risks / constraints**

- Single shared **`ADMIN_PASSWORD`**.
- **`GET /api/sync-stats` + `offset=0`:** wipes **`stats`** for the season for that run.
- Participant sync **upsert only** — removing someone from the sheet does **not** delete their `participants` row.
- **`GET /api/pool-settings`** eligible arrays vs bracket intersection nuances — see code / Admin save flow.
- NHL / Cloudflare throttling — [`lib/nhl/playoff-bracket-teams.js`](lib/nhl/playoff-bracket-teams.js) for bracket shape.

**Suggested next tasks (small)**

1. **QA pass:** `/make-picks` → picks submit → standings / team / `/status` after real data changes.
2. **UI polish:** copy/spacing on [`app/page.jsx`](app/page.jsx); any nits on [`app/standings/page.jsx`](app/standings/page.jsx) / [`app/admin/ui.jsx`](app/admin/ui.jsx).
3. **Optional:** align **default `year`** in [`app/api/sync-stats/route.js`](app/api/sync-stats/route.js) and [`app/api/sync-players/route.js`](app/api/sync-players/route.js) with [`lib/current-pool.js`](lib/current-pool.js) so raw `curl` without `year=` matches pool year (today: **2026**).
4. **Optional:** move `metadata.colorScheme` to `generateViewport` per Next 16 warning.
5. **Sheet ↔ code:** CSV headers must match `normalizeParticipantRow` in [`app/api/sync-participants/route.js`](app/api/sync-participants/route.js).

**Open TODOs in repo**

- No `TODO` / `FIXME` grep hits in `app/` / `lib/` (last check).

---

## 10. Session delta

- **Doc-only refresh:** merged and updated `CLAUDE.md` for current routes, APIs, env, SQL list, nav, `/status`, GitHub workflow defaults, and known code vs. operator `year` defaults.

---

## 11. New / modified files (this session)

- **`CLAUDE.md` only** (this edit).

---

## Commissioner (contact)

**David Tucker** (`dftucker@gmail.com`). Participants from a **Google Sheet**; salaries editable in Supabase.

---

### Start here

1. **`npm run dev`** → **http://localhost:3000**
2. **Shell:** [`app/layout.jsx`](app/layout.jsx) + [`app/globals.css`](app/globals.css)
3. **API:** nine handlers under [`app/api/`](app/api/) (see §6)
4. **Supabase:** [`lib/supabase/server.js`](lib/supabase/server.js) — tables **`participants`**, **`players`**, **`picks`**, **`stats`**, **`pool_settings`**; DDL/helpers in [`sql/`](sql/)
