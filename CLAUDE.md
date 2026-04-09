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

- **Playoff bracket is the team allowlist** for both **player sync** and **eligible-team settings**: only clubs appearing in `GET /playoff-bracket/{year}` for the chosen playoff year are valid. Implemented in `lib/nhl/playoff-bracket-teams.js` (`extractPlayoffTeamsFromBracket`, `fetchPlayoffTeamsMap`, `restrictEligibleTeamsToPlayoffAbbrevs`).
- **`GET /api/sync-players`** deletes and reinserts `players` for the season using **bracket teams only** + `/roster/{abbrev}/{season}` — no extra teams from `pool_settings`.
- **`GET /api/playoff-teams?year=`** exposes the same bracket team list for Admin UI (`app/api/playoff-teams/route.js`).
- **`PUT /api/pool-settings`** fetches the bracket for `seasonIdToPlayoffYear(season)` (`lib/nhl/season.js`) and **intersects** every `eligible_teams_r*` before save; optional response key `eligible_teams_removed_not_in_playoffs`. Bracket fetch failure → **502** (deadlines cannot be saved without validation path).
- **Admin** (`app/admin/ui.jsx`) loads **`/api/pool-settings?season=`** and **`/api/playoff-teams?year=`** together (`useEffect` deps `[season, year]`); eligible checkboxes are **only playoff teams**, not all 32 NHL clubs. Stored selections are intersected with the bracket set on load.
- **`GET /api/pool-settings`** returns DB rows as normalized by `lib/pool-settings.js` — it does **not** re-filter eligible arrays against the bracket; stale non-playoff codes can exist until the next **Save** or manual fix.
- **Picks page** (`app/picks/[pick_page_id]/page.jsx`, `ui.jsx`): `current_round` chooses which `eligible_teams_r{1|2|3}` applies; amber copy explains the link. **`normalizePlayerConference`** (`lib/nhl/team-conference.js`) prefers static tri-code map over DB `conference`.
- **Deadlines**: Admin enters **US Eastern** wall time (`lib/deadline-timezone.js`); picks page shows viewer-local time via `app/picks/[pick_page_id]/DeadlineAtForViewer.jsx` — **`dateStyle` + `timeStyle` only** (no `timeZoneName` with those) to avoid Node `Intl` errors in RSC.
- **Submit** (`app/api/picks/submit/route.js` + `lib/pick-roster-rules.js`): **`PICK_SALARY_CAP` = 30**, slot counts, stars; pool round + deadline + optional eligible `team_abbrev` checks.

---

## 2. New / modified files (one-line purpose)

| Path | Purpose |
|------|---------|
| `app/api/playoff-teams/route.js` | `GET ?year=` → JSON `{ teams: [{ abbrev, name }] }` from NHL bracket |
| `lib/nhl/playoff-bracket-teams.js` | Parse bracket JSON; fetch map; restrict eligible team arrays to bracket abbrevs |
| `lib/nhl/season.js` | `playoffYearToSeasonId`, `seasonIdToPlayoffYear` (8-digit season ↔ playoff year) |
| `app/api/sync-players/route.js` | Bracket-only roster sync → `players` |
| `app/api/pool-settings/route.js` | `GET`/`PUT` `pool_settings`; PUT sanitizes eligible vs bracket |
| `app/admin/ui.jsx` | Admin client: sync buttons, pool form, bracket-only eligible UI |
| `app/picks/[pick_page_id]/page.jsx` | RSC: players, stats, pool settings, eligible filter, `pickerMeta` |
| `app/picks/[pick_page_id]/ui.jsx` | Client picker, conference tabs, submit, eligible filter hint |
| `app/picks/[pick_page_id]/DeadlineAtForViewer.jsx` | Client local deadline display; hydration-safe |
| `lib/deadline-timezone.js` | Eastern ↔ UTC for admin datetime-local |
| `lib/pool-settings.js` | `fetchPoolSettings`, `normalizePoolSettingsRow`, deadline/lock helpers |
| `lib/playoff-pick-eligibility.js` | `getEligibleTeamAbbrevsForPickList`, `filterPlayersByTeamAbbrevs` |
| `lib/pick-roster-rules.js` | `PICK_SALARY_CAP`, `validatePickRosterAndStars` |
| `lib/nhl/team-conference.js` | `TEAM_CONFERENCE`, `normalizePlayerConference`, `conferenceForTeamAbbrev` |
| `lib/nhl/team-abbrevs.js` | `NHL_TEAM_ABBREVS` (32 codes) — **not** used by Admin eligible UI currently |
| `sql/pool_settings.sql` | `CREATE TABLE pool_settings` + `eligible_teams_r1`–`r3` |
| `sql/pool_settings_eligible_teams.sql` | `ALTER` if table predates eligible columns |

**Other core paths (unchanged role):** `app/standings/page.jsx`, `app/teams/[slug]/page.jsx`, `ui.jsx`, `app/api/sync-stats/route.js`, `app/api/sync-regular-season/route.js`, `app/api/sync-participants/route.js`, `app/api/picks/submit/route.js`, `app/api/team-summary/route.js`, `lib/scoring.js`, `lib/supabase/server.js`, `lib/env.js`.

---

## 3. Behavior changes (user-visible → files)

- **Eligible teams in Admin** = only teams in the **NHL playoff bracket** for the selected **Playoff year** — `app/admin/ui.jsx` + `app/api/playoff-teams/route.js`.
- **Saving pool settings** can drop tri-codes not in that bracket; response may list them — `app/api/pool-settings/route.js`.
- **Sync players** never imports non-bracket NHL teams — `app/api/sync-players/route.js`.
- **Picks list** filtered by `eligible_teams_r{current_round}` when that array is non-empty; subtitle shows filter hint — `app/picks/[pick_page_id]/page.jsx`, `ui.jsx`, `lib/playoff-pick-eligibility.js`.
- **Only one eligible list active** at a time: matches **Current pool round** in Admin — copy in `app/admin/ui.jsx` and picks `ui.jsx`.
- **Pick page deadline** shown in viewer locale; Admin deadlines are Eastern — `DeadlineAtForViewer.jsx`, `lib/deadline-timezone.js`, `app/admin/ui.jsx`.

---

## 4. API endpoints

Errors often: `{ ok: false, error: string }` or `{ ok: false, step: string, error: string }`.

### `GET /api/sync-participants`

- **Query:** none  
- **Side effects:** Reads CSV from `PARTICIPANTS_SHEET_URL`; `upsert` `participants` `onConflict: "pick_page_id"`  
- **Success:** `{ ok: true, count, participants }`  
- **Failures:** Missing env, sheet fetch error, Supabase error (needs unique on `pick_page_id`)

### `GET /api/sync-players?year={number}`

- **Query:** `year` (default `2025`) — season = `playoffYearToSeasonId(year)`  
- **Side effects:** `DELETE players WHERE season`; `INSERT` from bracket teams + `/roster/{abbrev}/{season}`  
- **Success:** `{ ok, year, season, teams, players, conferenceCounts, upserted }`  
- **Failures:** Empty bracket, NHL error, Supabase delete/insert

### `GET /api/playoff-teams?year={number}`

- **Query:** `year` required (numeric, ≥ 2000 in route)  
- **Side effects:** none  
- **Success:** `{ ok: true, year, season, teams: [{ abbrev, name }] }`  
- **Failures:** `400` invalid year; `502` NHL/bracket error

### `GET /api/sync-stats?year=&limit=&offset=&concurrency=`

- **Query:** `year` (default `2025`); `offset` (default `0`); `limit` **optional** — if omitted, batch is **all players from `offset` to end**; `concurrency` optional (default **2**, clamped **1–10**)  
- **Side effects:** If `offset===0`, `DELETE stats WHERE season`; probe insert detects goalie column names; `INSERT` per player from `/player/{nhl_id}/game-log/{season}/3`  
- **Success:** `{ ok, year, season, offset, limit, concurrency, total_players, next_offset, players, stats_rows }`  
- **Done:** repeat until `next_offset >= total_players`  
- **Failures:** 429/Cloudflare, insert errors

### `GET /api/sync-regular-season?year=&limit=&offset=&concurrency=`

- **Query:** `year`; `limit` default **25**; `offset` default **0**; `concurrency` default **1**, clamped **1–3**  
- **Side effects:** Updates `players.season_points` (`onConflict: "id"`)  
- **Success:** includes `updated`  
- **Failures:** Missing `season_points` column (hint in JSON), NHL errors

### `GET /api/pool-settings?season={string}`

- **Query:** `season` required (e.g. `20242025`)  
- **Side effects:** none  
- **Success:** `{ ok: true, settings }` — `current_round` 1–3, `deadline_r1`–`r3` ISO or null, `eligible_teams_r1`–`r3` array or null, `updated_at`  
- **Failures:** missing `season`, Supabase error

### `PUT /api/pool-settings`

- **Auth:** `ADMIN_PASSWORD`; match `x-admin-password` header **or** body `admin_password`  
- **Body:** `season`, `current_round` (1–3), `deadline_r1`–`r3` (ISO or null). `eligible_teams_r1`–`r3`: array or null. **Omit** eligible key → keep existing from DB for that key; deadlines **always** from body (missing → null).  
- **Side effects:** `upsert` on `season`; eligible arrays **intersected** with bracket for `seasonIdToPlayoffYear(season)`  
- **Success:** `{ ok: true, settings }` + optional `eligible_teams_removed_not_in_playoffs: string[]`  
- **Failures:** `503` no `ADMIN_PASSWORD`; `401`; `400` invalid `season` / round; `502` bracket empty/unavailable; `500` upsert

### `POST /api/picks/submit`

- **Body:** `pick_page_id`, `season`, `round` (pool **1|2|3**), `roster` (12 NHL ids), `stars` `{ Forwards, Defence, Goalies }`  
- **Side effects:** Validates round vs `pool_settings.current_round`, deadline, eligible teams, `lib/pick-roster-rules.js`; deletes prior picks for that participant/season — pool round **3** uses `.in("round", [3, 4])` then inserts new rows with **`round: 3`** (clears legacy `picks.round === 4` rows)  
- **Success:** `{ ok: true, participant_id, season, round, picks: 12, submitted_at }`  
- **Failures:** `400` validation; `403` wrong round or locked; `404` participant; `500` + `step`

### `GET /api/team-summary?participant_id=&season=`

- **Query:** both required  
- **Side effects:** none  
- **Success:** `{ ok: true, summary }` (`lib/scoring.js` `computeParticipantSummary`)  
- **Failures:** `400` / `404` / `500`

---

## 5. Data model / Supabase

**RLS:** No policies in repo `sql/`; confirm in Supabase dashboard if tables are locked down.

| Table | Columns / usage |
|-------|------------------|
| `participants` | `id`, `name`, `slug`, `pick_page_id` — upsert on `pick_page_id` (unique required) |
| `players` | `id`, `nhl_id`, `name`, `team`, `team_abbrev`, `position` (`F`/`D`/`G`), `conference`, `salary`, `season`, `season_points` (reg-season sync) |
| `picks` | `participant_id`, `player_id`, `round` (pool 1–3), `season`, `is_star`, `submitted_at` |
| `stats` | `nhl_id`, `season`, `round` (NHL 1–4), `goals`, `assists`, + goalie fields per probe |
| `pool_settings` | **PK** `season`; `current_round` CHECK 1–3; `deadline_r1`–`r3` timestamptz; `eligible_teams_r1`–`r3` `text[]` null; `updated_at` |

**Stats goalie column detection** (`app/api/sync-stats/route.js`): tries insert combinations of wins (`goalie_wins` \| `goalieWins` \| `wins`) and shutouts (`goalie_shutout` \| `goalie_shutouts` \| `shutouts`).

**Playoff game id** (`parseRoundFromGameId` in `sync-stats`): length 10, chars 4–6 = `03` (playoffs), round = digits at 6–8.

---

## 6. Environment variables

| Variable | Read in | Role |
|----------|---------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/server.js`, `lib/supabase/browser.js` | Required (`requireEnv`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | same | Required — note name is **not** `ANON_KEY` |
| `PARTICIPANTS_SHEET_URL` | `lib/participants/sheet.js` | Required for sync-participants |
| `ADMIN_PASSWORD` | `app/api/pool-settings/route.js` | Required for `PUT`; missing → **503** |

**Vercel (Production / Preview):** Add the same variables in the project **Settings → Environment Variables**. Use **Production** for the live site; add **Preview** if you want preview deploys to hit real Supabase (or use placeholders and accept broken previews).

---

## 7. Operational notes

- **Vercel Hobby (free tier):** Import the GitHub repo; framework **Next.js**; defaults `npm run build` / `next build` are fine. **Functions** default to **10s** timeout, configurable up to **60s** per route (`export const maxDuration = 60` in `app/api/.../route.js` if needed). **Cron Jobs** are available on Hobby; schedule is **not guaranteed to the minute** (may run any time within the scheduled hour). **`/api/sync-stats`** can exceed 60s if `limit` is large — use a small `limit` + low `concurrency` for cron-sized chunks. A **full** stats run still requires **chaining** `offset` until `next_offset >= total_players` (see §8); one cron invocation only does **one** batch, and **`offset=0` deletes** that season’s `stats` first — plan automation accordingly (e.g. **GitHub Actions** `schedule` + a script that loops `curl` with `next_offset`, or manual Admin batches). Optional hardening: set **`CRON_SECRET`** in Vercel and validate `Authorization: Bearer …` on a dedicated cron path (Vercel sends this header on cron requests when `CRON_SECRET` is set).  
- **Rate limits:** Use **low concurrency** on stats/reg-season sync; `nhlFetch` retries 429 with backoff (`lib/nhl/api.js`). Stats route uses `maxRetries: 8`, `baseDelayMs: 1500` on game-log fetches.  
- **Stats sync:** If `limit` omitted, one call processes **remaining** players from `offset` through end — still advance `next_offset` until `>= total_players`.  
- **Regular season:** Batch until all `players` rows updated.  
- **Pool year alignment:** Admin **Playoff year** must match the season you store in `pool_settings` (`playoffYearToSeasonId(year)`). Bracket + eligible validation use **`seasonIdToPlayoffYear(season)`**.  
- **Dev quirks:** Hydration issues after HMR → delete `.next`, restart `npm run dev`. **`EMFILE`** on file watcher → try `npm run build && npm run start` for smoke tests.  
- **Picks remount key:** `app/picks/[pick_page_id]/page.jsx` — `key={\`${currentPoolRound}-${submissionsLocked ? "locked" : "open"}\`}` on `PicksClient` so client state resets on round/lock change.  
- **Deadline display:** `suppressHydrationWarning` on deadline/countdown spans where server/client locale strings differ (`DeadlineAtForViewer.jsx`, `ui.jsx`).  
- **Next.js docs:** see `AGENTS.md` / local `node_modules/next/dist/docs/` for version-specific APIs.

---

## 8. Project status

### Completed (major)

- App Router shell, standings, team pages, compare, deadline-gated public rosters  
- Participant / players / stats / regular-season sync  
- Pool rounds, Eastern deadlines, bracket-aligned eligible teams, picks + server validation  
- Scoring: pool R1 / R2 / R3+4 (NHL 3+4 combined)

### In progress / weak spots

- Admin auth = single shared password only  
- `GET /api/pool-settings` may return pre-migration eligible values until saved again through `PUT`

### Known risks

- NHL / Cloudflare throttling  
- `stats` schema drift (mitigated by probe inserts)  
- Bracket API shape changes (team extraction in `lib/nhl/playoff-bracket-teams.js`)

### Next tasks (ordered, file pointers)

1. **Vercel Cron** (or similar) for `GET /api/sync-stats` — must loop `offset` until `next_offset >= total_players`; **`offset=0` wipes** that season’s `stats`. Optional secret header if route is public. (`app/api/sync-stats/route.js`; add `vercel.json` cron config when ready.)  
2. **Out of scope (by design):** prior-round pick history on the picks page — roster history belongs on team pages only.  
3. **Out of scope (by design):** stronger admin auth — shared `ADMIN_PASSWORD` is sufficient for this pool.

---

## Routes (quick map)

| Path | Files |
|------|--------|
| `/` | `app/page.jsx` |
| `/standings` | `app/standings/page.jsx`, `lib/scoring.js` |
| `/teams/[slug]` | `app/teams/[slug]/page.jsx`, `ui.jsx` |
| `/make-picks` | `app/make-picks/page.jsx`, `ui.jsx` |
| `/picks/[pick_page_id]` | `app/picks/[pick_page_id]/page.jsx`, `ui.jsx` |
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

- JavaScript only; API routes: `app/api/*/route.js`; Tailwind for styling (`app/globals.css`).

## Commissioners notes

- Commissioner: David Tucker (`dftucker@gmail.com`).  
- Participants from Google Sheet; salaries edited in Supabase; casual friends-pool tone.  
- Match Framer look where screenshots exist.
