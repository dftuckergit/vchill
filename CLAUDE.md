@AGENTS.md

# VChill Fantasy Hockey Pool — Project Knowledge Base

Handoff doc for agents: **concrete paths, APIs, env vars, and Supabase shapes**. Verify behavior in code if something drifts.

## What this project is

Annual fantasy **NHL playoff** pool (“V Chill Pool”). Participants get `/picks/[pick_page_id]`, submit a **12-player** roster (East/West, salary cap, stars) per **pool** round; points from synced NHL playoff stats. UI should stay close to existing Framer look (`Work_Sans`, header `#163a59`).

## Tech stack (verified `package.json`)

- **Next.js** `16.2.2` — App Router, **JavaScript only** (`jsconfig.json` alias `@/*`)
- **React** `19.2.4`
- **Supabase** `@supabase/supabase-js` `^2.102.1`
- **Tailwind** `^4` — `app/globals.css`, PostCSS
- **NHL HTTP API** — `https://api-web.nhle.com/v1/` via `lib/nhl/api.js` (`nhlFetch`, 429 backoff)
- **Participants** — Google Sheet CSV URL `PARTICIPANTS_SHEET_URL` (`lib/participants/sheet.js`)

---

## 1. Session summary (high signal)

- **Playoff bracket = team allowlist** for `GET /api/sync-players`, Admin eligible teams, and `GET /api/playoff-teams`. Logic: `lib/nhl/playoff-bracket-teams.js`; season math: `lib/nhl/season.js` (`playoffYearToSeasonId`, `seasonIdToPlayoffYear`).
- **`PUT /api/pool-settings`** intersects `eligible_teams_r1`–`r3` with bracket teams; bracket failure → **502**. **`GET /api/pool-settings`** returns normalized rows only (stale non-playoff codes possible until next Save).
- **Season id as string:** `picks`, `pool_settings`, and `.eq("season", …)` use **8-digit text** (e.g. `20242025`). `app/picks/[pick_page_id]/page.jsx`, `app/standings/page.jsx`, `app/teams/[slug]/page.jsx` coerce `players.season` with `String(…)`; `lib/pool-settings.js` `fetchPoolSettings` stringifies the lookup key.
- **Picks page reliability:** `export const dynamic = "force-dynamic"` in `app/picks/[pick_page_id]/page.jsx`. Saved rows for **pool rounds 1–2** use the full query result (legacy bug had filtered to NHL rounds 3/4 only). Saved roster still shown when deadline passed (`showSavedRoster`); edits gated in `app/picks/[pick_page_id]/ui.jsx`. **`useEffect` + `savedIdsKey`** re-hydrates roster/stars when server saved IDs or lock state change (e.g. after `router.refresh()` post-submit).
- **Pool settings — stats sync defaults:** `pool_settings.stats_sync_limit` (clamped **1–100**, default **8**), `stats_sync_concurrency` (**1–10**, default **1**). Normalized in `lib/pool-settings.js`; persisted via **`PUT /api/pool-settings`** (omit keys → keep existing). Admin: presets + inputs in `app/admin/ui.jsx`; saved with **Save pool settings**. New DBs: `sql/pool_settings.sql`. Existing DBs: run **`sql/pool_settings_stats_sync_defaults.sql`** once in Supabase SQL Editor.
- **`GET /api/sync-stats` auth:** If **`SYNC_STATS_SECRET`** is set → require `Authorization: Bearer …`, or `x-sync-stats-secret`, or **`x-admin-password`** matching **`ADMIN_PASSWORD`**. If secret unset → route open. **`export const maxDuration = 60`** here and on other sync `GET` routes: `app/api/sync-players/route.js`, `app/api/sync-regular-season/route.js`, `app/api/sync-participants/route.js`.
- **Admin `run()`** (`app/admin/ui.jsx`): all sync **`GET`**s send **`x-admin-password`** when the password field is filled (so stats sync works when `SYNC_STATS_SECRET` is enabled).
- **GitHub Actions:** `.github/workflows/sync-playoff-stats.yml` chains `GET /api/sync-stats` with `offset` / `next_offset` until done. Repo secrets: **`STATS_SYNC_BASE_URL`**, **`SYNC_STATS_SECRET`**. Workflow **defaults** for `limit`/`concurrency` (**8** / **1**) are **not** read from `pool_settings` (change workflow or dispatch inputs to align with Admin).
- **`POST /api/picks/submit`:** Validates `pool_settings.current_round`, deadline, eligible teams, `lib/pick-roster-rules.js`. Pool round **3** deletes `.in("round", [3, 4])` then inserts **`round: 3`**.
- **Scoring / public pages:** `lib/scoring.js`; `/standings`, `/teams/[slug]`; team page loads all picks for summary (no r3/r4 display bug).

---

## 2. New / modified files (one-line purpose)

| Path | Purpose |
|------|---------|
| `app/api/playoff-teams/route.js` | `GET ?year=` → `{ ok, year, season, teams: [{ abbrev, name }] }`; `year` required, ≥ 2000 |
| `app/api/sync-players/route.js` | `GET ?year=` → bracket-only roster → `players`; `maxDuration` 60 |
| `app/api/sync-stats/route.js` | `GET` batched playoff game logs → `stats`; optional auth; `maxDuration` 60 |
| `app/api/sync-regular-season/route.js` | `GET` → `players.season_points`; `maxDuration` 60 |
| `app/api/sync-participants/route.js` | `GET` → Sheet → `participants` upsert; `maxDuration` 60 |
| `app/api/pool-settings/route.js` | `GET` / `PUT` `pool_settings`; PUT bracket-intersection + stats sync fields |
| `app/api/picks/submit/route.js` | `POST` validate + replace picks for participant/season/round |
| `app/api/team-summary/route.js` | `GET ?participant_id=&season=` → scoring summary JSON |
| `app/admin/page.jsx` | Server shell for Admin |
| `app/admin/ui.jsx` | Admin client: sync buttons, pool form, eligible UI, stats limit/concurrency + presets |
| `app/picks/[pick_page_id]/page.jsx` | RSC picks page: `dynamic`, season string, saved picks, `pickerMeta` |
| `app/picks/[pick_page_id]/ui.jsx` | Client picker, submit, `savedIdsKey` re-hydration |
| `app/picks/[pick_page_id]/DeadlineAtForViewer.jsx` | Client deadline display |
| `app/standings/page.jsx` | Standings table; `String(season)` |
| `app/teams/[slug]/page.jsx` | Team page; `String(season)` |
| `app/_components/SiteHeader.jsx` | Nav; Teams from `participants` |
| `lib/nhl/playoff-bracket-teams.js` | Bracket parse, `fetchPlayoffTeamsMap`, eligible restriction |
| `lib/nhl/season.js` | Playoff year ↔ 8-digit season id |
| `lib/nhl/api.js` | `nhlFetch`, 429 backoff |
| `lib/nhl/team-conference.js` | Conference normalization for picks |
| `lib/nhl/team-abbrevs.js` | 32-team list (not used by Admin eligible UI) |
| `lib/pool-settings.js` | `fetchPoolSettings`, `normalizePoolSettingsRow`, `mergeStatsSyncFromPut`, deadlines/locks |
| `lib/playoff-pick-eligibility.js` | Eligible team sets + player filter |
| `lib/pick-roster-rules.js` | `PICK_SALARY_CAP`, roster validation |
| `lib/participants/sheet.js` | CSV fetch; `requireEnv("PARTICIPANTS_SHEET_URL")` |
| `lib/deadline-timezone.js` | Eastern ↔ UTC for admin inputs |
| `lib/scoring.js` | Standings + participant summaries |
| `lib/supabase/server.js` | Server Supabase client; `requireEnv` URL + publishable key |
| `lib/supabase/browser.js` | Browser client |
| `lib/env.js` | `requireEnv` |
| `lib/slugify.js` | Participant slug helper |
| `sql/pool_settings.sql` | `CREATE TABLE pool_settings` including `stats_sync_*` |
| `sql/pool_settings_eligible_teams.sql` | `ALTER` if table predates eligible arrays |
| `sql/pool_settings_stats_sync_defaults.sql` | `ALTER` if table predates `stats_sync_limit` / `stats_sync_concurrency` |
| `.github/workflows/sync-playoff-stats.yml` | Scheduled + manual chained `sync-stats` |

---

## 3. Behavior changes (user-visible → files)

- **Eligible teams in Admin** = NHL playoff bracket only for selected year — `app/admin/ui.jsx`, `app/api/playoff-teams/route.js`.
- **Save pool settings** may drop tri-codes not in bracket — `app/api/pool-settings/route.js` (`eligible_teams_removed_not_in_playoffs`).
- **Sync players** only bracket teams — `app/api/sync-players/route.js`.
- **Picks picker** filtered by `eligible_teams_r{current_pool_round}` when non-empty — `app/picks/[pick_page_id]/page.jsx`, `ui.jsx`, `lib/playoff-pick-eligibility.js`.
- **One eligible list active** = **Current pool round** — copy in `app/admin/ui.jsx`, `app/picks/[pick_page_id]/ui.jsx`.
- **Deadlines:** Admin Eastern; picks page viewer-local — `lib/deadline-timezone.js`, `DeadlineAtForViewer.jsx`.
- **Saved picks visible** after submit / reload / new tab (incl. rounds 1–2 and after lock); roster read-only when locked — `app/picks/[pick_page_id]/page.jsx`, `ui.jsx`.
- **Admin playoff stats:** limit/concurrency presets; values persist with **Save pool settings** — `app/admin/ui.jsx`, `PUT /api/pool-settings`.

---

## 4. API endpoints

Common error shapes: `{ ok: false, error: string }` or `{ ok: false, step: string, error: string }`.

### `GET /api/sync-participants`

- **Query:** none  
- **Side effects:** Reads CSV from `PARTICIPANTS_SHEET_URL`; upsert `participants` `onConflict: "pick_page_id"`  
- **Success:** `{ ok: true, count, participants }` (`participants` = selected rows from upsert)  
- **Failures:** `500` — missing env, sheet error, or Supabase upsert (needs unique `pick_page_id`)

### `GET /api/sync-players?year={number}`

- **Query:** `year` optional, default **`2025`** → internal `season` = `playoffYearToSeasonId(year)`  
- **Side effects:** `DELETE` `players` where `season`; insert roster rows from bracket + NHL `/roster/{abbrev}/{season}`  
- **Success:** `{ ok: true, year, season, teams, players, conferenceCounts, upserted }` — `teams` / `players` are **counts**; `upserted` = inserted row count from select  
- **Failures:** empty bracket, NHL errors, Supabase errors

### `GET /api/playoff-teams?year={number}`

- **Query:** **`year` required**, numeric **≥ 2000**  
- **Side effects:** none  
- **Success:** `{ ok: true, year, season, teams: [{ abbrev, name }] }`  
- **Failures:** `400` missing/invalid year; `502` NHL/bracket error

### `GET /api/sync-stats?year=&limit=&offset=&concurrency=`

- **Query:** `year` default `2025`; `offset` default `0`; `limit` optional (omit = all players from `offset` to end); `concurrency` optional, default **2**, clamped **1–10**  
- **Auth:** If **`SYNC_STATS_SECRET`** set: **`Authorization: Bearer <secret>`** or **`x-sync-stats-secret`** or **`x-admin-password: <ADMIN_PASSWORD>`**. If unset, no auth.  
- **Side effects:** If **`offset === 0`**, `DELETE` from `stats` where `season`; goalie column names via probe insert; per-player NHL `/player/{nhl_id}/game-log/{season}/3`  
- **Success:** `{ ok: true, year, season, offset, limit, concurrency, total_players, next_offset, players, stats_rows }`  
- **Completion:** repeat calls until **`next_offset >= total_players`**  
- **Failures:** **`401`** `{ ok: false, error: "Unauthorized" }` if secret required and missing/wrong; `500` NHL/insert errors; 429 handled inside `nhlFetch`

### `GET /api/sync-regular-season?year=&limit=&offset=&concurrency=`

- **Query:** `year` default **`2025`**; `limit` default **25**; `offset` default **0**; `concurrency` default **1**, clamped **1–3**  
- **Side effects:** Updates `players.season_points` (`onConflict: "id"`)  
- **Success:** `{ ok: true, year, season, offset, limit, concurrency, updated }` — `updated` = rows in batch  
- **Failures:** missing column hints in JSON, NHL/Supabase errors

### `GET /api/pool-settings?season={string}`

- **Query:** **`season` required** (8-digit string e.g. `20242025`)  
- **Side effects:** none  
- **Success:** `{ ok: true, settings }` where `settings` includes `current_round`, `deadline_r1`–`r3`, `eligible_teams_r1`–`r3`, **`stats_sync_limit`**, **`stats_sync_concurrency`**, `updated_at` (via `lib/pool-settings.js` normalization)  
- **Failures:** `400` missing `season`; `500` Supabase

### `PUT /api/pool-settings`

- **Auth:** **`ADMIN_PASSWORD`** required in env; client sends **`x-admin-password`** header or body **`admin_password`**  
- **Body:** **`season`**, **`current_round`** (1–3), **`deadline_r1`–`r3`** (ISO strings or null). **`eligible_teams_r1`–`r3`**: arrays or null — **omit key** → keep existing for that key. Deadlines **always** taken from body (missing → null). Optional **`stats_sync_limit`** (1–100), **`stats_sync_concurrency`** (1–10) — **omit** → keep existing.  
- **Side effects:** Upsert row; eligible arrays intersected with playoff bracket  
- **Success:** `{ ok: true, settings }` + optional **`eligible_teams_removed_not_in_playoffs: string[]`**  
- **Failures:** `503` if `ADMIN_PASSWORD` unset; `401`; `400`; `502` bracket; `500` upsert

### `POST /api/picks/submit`

- **Body:** **`pick_page_id`** (number), **`season`** (string), **`round`** (pool 1|2|3), **`roster`** (length-12 NHL id array), **`stars`** `{ Forwards, Defence, Goalies }` (NHL ids)  
- **Side effects:** Validates round vs `pool_settings`, deadline, eligible teams, roster rules; delete prior picks for that participant+season (round 3 uses `.in("round", [3, 4])`); insert 12 rows  
- **Success:** `{ ok: true, participant_id, season, round, picks: 12, submitted_at }`  
- **Failures:** `400` validation; `403` wrong round / locked; `404` participant; `500` + `step`

### `GET /api/team-summary?participant_id=&season=`

- **Query:** both required; `participant_id` numeric; `season` string  
- **Side effects:** none  
- **Success:** `{ ok: true, summary }` from `computeParticipantSummary`  
- **Failures:** `400` bad ids; `404` participant; `500` + `step`

---

## 5. Data model / Supabase

**RLS:** No policies in repo `sql/`; confirm in Supabase dashboard.

| Table | Columns / usage |
|-------|------------------|
| `participants` | `id`, `name`, `slug`, `pick_page_id` — upsert on **`pick_page_id`** (unique) |
| `players` | `id`, `nhl_id`, `name`, `team`, `team_abbrev`, `position` (`F`/`D`/`G`), `conference`, `salary`, `season`, `season_points` |
| `picks` | `participant_id`, `player_id`, `round` (pool **1–3** in app), `season` (text), `is_star`, `submitted_at` |
| `stats` | `nhl_id`, `season`, `round` (NHL **1–4**), `goals`, `assists`, + goalie columns (see below) |
| `pool_settings` | **PK** `season` (text); `current_round` 1–3; `deadline_r1`–`r3` timestamptz; `eligible_teams_r1`–`r3` `text[]` null; **`stats_sync_limit`** int default 8; **`stats_sync_concurrency`** int default 1; `updated_at` |

**Stats goalie column detection** (`app/api/sync-stats/route.js`): probe insert tries wins (`goalie_wins` \| `goalieWins` \| `wins`) and shutouts (`goalie_shutout` \| `goalie_shutouts` \| `shutouts`).

**Playoff game id** (`sync-stats` `parseRoundFromGameId`): length 10, chars 4–6 = `03`, round = digits 6–8.

---

## 6. Environment variables

| Variable | Read in | Role |
|----------|---------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/server.js`, `lib/supabase/browser.js` | Required (`requireEnv`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | same | Required (name is **not** `ANON_KEY`) |
| `PARTICIPANTS_SHEET_URL` | `lib/participants/sheet.js` | Required for `GET /api/sync-participants` |
| `ADMIN_PASSWORD` | `app/api/pool-settings/route.js` (`PUT`); `app/api/sync-stats/route.js` (bypass when `SYNC_STATS_SECRET` set) | Pool **`PUT`** → **503** if unset; stats auth accepts `x-admin-password` when secret enabled |
| `SYNC_STATS_SECRET` | `app/api/sync-stats/route.js` | Optional; if set, stats `GET` requires Bearer / `x-sync-stats-secret` / valid `x-admin-password` |

**Vercel:** Set production (and preview if needed) env vars to match local `.env.local` pattern (do not commit `.env*`).

**GitHub Actions:** Repository secrets **`STATS_SYNC_BASE_URL`** (origin only, e.g. `https://vchill.vercel.app`), **`SYNC_STATS_SECRET`** (same value as Vercel if route is locked).

---

## 7. Operational notes

- **Vercel Hobby:** Function **`maxDuration = 60`** on sync routes (see §2). Prefer **small `limit`** + **low `concurrency`** for `sync-stats` so each request finishes under the cap.  
- **`sync-stats` first batch:** **`offset=0`** **deletes** all `stats` for that **`season`** before importing — full chained run is safe; a **single** batch after delete leaves partial data until the chain completes.  
- **GitHub workflow:** `.github/workflows/sync-playoff-stats.yml` — `timeout-minutes: 360`, `concurrency: cancel-in-progress` on branch group. **Off-season:** disable workflow or remove `schedule` so daily `offset=0` does not run. **Defaults** `year=2025`, `limit=8`, `concurrency=1` in `workflow_dispatch`; scheduled runs use shell fallbacks when inputs empty.  
- **Rate limits:** `nhlFetch` retries 429 (`lib/nhl/api.js`); stats fetches use `maxRetries: 8`, `baseDelayMs: 1500`.  
- **Regular season sync:** advance **`offset`** until entire `players` list covered.  
- **Pool year:** Admin playoff year must match `pool_settings.season` / synced `players.season` (`playoffYearToSeasonId`).  
- **Schema migration:** Run **`sql/pool_settings_stats_sync_defaults.sql`** once if `pool_settings` predates `stats_sync_*` columns (otherwise Admin save / upsert errors).  
- **Dev:** Hydration issues after HMR → delete `.next`, restart `npm run dev`. **`EMFILE`** on watcher → `npm run build && npm run start`.  
- **Picks:** `PicksClient` **`key={`${currentPoolRound}-${submissionsLocked ? "locked" : "open"}`}`** resets client state on round/lock change (`app/picks/[pick_page_id]/page.jsx`).  
- **Deadline / countdown:** `suppressHydrationWarning` where locale strings differ (`DeadlineAtForViewer.jsx`, `ui.jsx`).  
- **Next.js:** See `AGENTS.md` / `node_modules/next/dist/docs/` for version-specific APIs.

---

## 8. Project status

### Completed (major)

- App Router: `/`, `/standings`, `/make-picks`, `/picks/[pick_page_id]`, `/teams/[slug]`, `/admin`  
- NHL sync: participants, players (bracket-only), stats (batched), regular-season points  
- Pool rounds, Eastern deadlines, bracket-aligned eligible teams, picks + server validation  
- Scoring: pool R1 / R2 / R3+4 (`lib/scoring.js`)  
- Vercel-oriented **`maxDuration`** on sync APIs  
- Optional **`SYNC_STATS_SECRET`** + Admin **`x-admin-password`** on sync GETs  
- **GitHub Actions** chained playoff stats sync  
- **`pool_settings.stats_sync_*`** + Admin presets/persistence  

### In progress / weak spots

- Admin auth = single shared **`ADMIN_PASSWORD`** only  
- **`GET /api/pool-settings`** may return pre-save eligible arrays not re-intersected with current bracket  

### Known risks

- NHL / Cloudflare throttling  
- `stats` column name drift (mitigated by probe inserts in `sync-stats`)  
- Playoff **bracket JSON** shape changes (`lib/nhl/playoff-bracket-teams.js`)  
- **`player_id` on `picks`** invalid if `players` rows are replaced with new `id` values after a full re-sync (rare operational hazard)  

### Next tasks (ordered, file pointers)

1. **Optional:** Teach **`.github/workflows/sync-playoff-stats.yml`** to read **`stats_sync_limit` / `stats_sync_concurrency`** from **`GET /api/pool-settings?season=…`** (needs auth strategy) so automation matches Admin.  
2. **Out of scope (by design):** prior-round pick history on picks page (team pages hold history).  
3. **Out of scope (by design):** stronger admin auth than shared password.  

---

## Routes (quick map)

| Path | Files |
|------|--------|
| `/` | `app/page.jsx` |
| `/standings` | `app/standings/page.jsx`, `lib/scoring.js` |
| `/teams/[slug]` | `app/teams/[slug]/page.jsx`, `ui.jsx` |
| `/make-picks` | `app/make-picks/page.jsx`, `ui.jsx` |
| `/picks/[pick_page_id]` | `app/picks/[pick_page_id]/page.jsx`, `ui.jsx`, `DeadlineAtForViewer.jsx` |
| `/admin` | `app/admin/page.jsx`, `ui.jsx` |

**Header:** `app/_components/SiteHeader.jsx` — Teams menu from `participants`.

---

## Game rules (summary)

- **Pool rounds:** 1 = NHL R1 stats; 2 = NHL R2; 3 = one window, points = NHL **R3 + R4** (`lib/scoring.js`).  
- **Roster:** 12 players — 3F/2D/1G per conference (East + West); **`PICK_SALARY_CAP` = 30**; 3 stars (one per F/D/G group).  
- **Scoring:** goal/assist 1 pt; goalie win 2, shutout 1; star doubles that pick’s points for the pool round.

---

## NHL API paths used in code

- `/playoff-bracket/{year}` — bracket teams  
- `/standings/{yyyy-mm-dd}` — conference map for sync-players (`{year}-04-01`)  
- `/roster/{abbrev}/{season}` — player rows  
- `/player/{id}/game-log/{season}/3` — playoff log (stats sync)  
- `/player/{id}/game-log/{season}/2` — regular season (`sync-regular-season`)

Base: `https://api-web.nhle.com/v1/` (`lib/nhl/api.js`).

---

## Code conventions

- JavaScript only; API routes: `app/api/*/route.js`; Tailwind (`app/globals.css`).

## Commissioners notes

- Commissioner: David Tucker (`dftucker@gmail.com`).  
- Participants from Google Sheet; salaries edited in Supabase; casual friends-pool tone.  
- Match Framer look where screenshots exist.
