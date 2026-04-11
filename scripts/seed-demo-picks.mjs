/**
 * Dev-only: seed or remove demo picks for two participants (all 3 pool rounds).
 *
 * REPLACES all picks for the given participants + season. Do not run against
 * production unless you intend to wipe those rows.
 *
 * Run (Node 20+):
 *   cd vchill-pool
 *   node --env-file=.env.local scripts/seed-demo-picks.mjs --slug-a=YOUR_SLUG --slug-b=OTHER_SLUG
 *   node --env-file=.env.local scripts/seed-demo-picks.mjs --slug-a=... --slug-b=... --season=20242025
 *   npm run seed:demo-picks -- --slug-a=YOUR_SLUG --slug-b=OTHER_SLUG
 *
 * Cleanup:
 *   node --env-file=.env.local scripts/seed-demo-picks.mjs --slug-a=... --slug-b=... --undo
 *
 * After a successful seed (not --undo), if a pool_settings row exists for this
 * season, deadline_r1–r3 are cleared so Round 1 and compare totals are visible
 * (see lib/pool-settings.js). Pass --keep-deadlines to skip that update.
 *
 * Node may warn about lib/*.js module type when importing pick-roster-rules; safe to ignore.
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { validatePickRosterAndStars } from "../lib/pick-roster-rules.js";
import { normalizePlayerConference } from "../lib/nhl/team-conference.js";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

function parseArgs() {
  const out = { undo: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--undo") {
      out.undo = true;
      continue;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        const key = a.slice(2, eq);
        const val = a.slice(eq + 1);
        out[key.replace(/-/g, "_")] = val;
      } else {
        const key = a.slice(2).replace(/-/g, "_");
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          out[key] = next;
          i++;
        } else {
          out[key] = true;
        }
      }
    }
  }
  return out;
}

function hashSeed(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function partitionPlayers(rows) {
  const buckets = {
    East: { F: [], D: [], G: [] },
    West: { F: [], D: [], G: [] },
  };
  for (const row of rows) {
    const conf = normalizePlayerConference(row.conference, row.team_abbrev);
    if (conf !== "East" && conf !== "West") continue;
    const pos = String(row.position || "").toUpperCase();
    if (pos === "F") buckets[conf].F.push(row);
    else if (pos === "D") buckets[conf].D.push(row);
    else if (pos === "G") buckets[conf].G.push(row);
  }
  return buckets;
}

/**
 * @param {object} buckets from partitionPlayers
 * @param {number} baseSeed
 * @returns {{ nhlIds: number[], stars: Record<string, number> } | null}
 */
function findValidRoster(buckets, baseSeed) {
  const { East, West } = buckets;
  const minCounts =
    East.F.length >= 3 &&
    East.D.length >= 2 &&
    East.G.length >= 1 &&
    West.F.length >= 3 &&
    West.D.length >= 2 &&
    West.G.length >= 1;
  if (!minCounts) return null;

  for (let attempt = 0; attempt < 80000; attempt++) {
    const rand = mulberry32((baseSeed + attempt) >>> 0);
    const eF = shuffle(East.F, rand).slice(0, 3);
    const eD = shuffle(East.D, rand).slice(0, 2);
    const eG = shuffle(East.G, rand).slice(0, 1);
    const wF = shuffle(West.F, rand).slice(0, 3);
    const wD = shuffle(West.D, rand).slice(0, 2);
    const wG = shuffle(West.G, rand).slice(0, 1);
    const picked = [...eF, ...eD, ...eG, ...wF, ...wD, ...wG];
    const nhlIds = picked.map((p) => p.nhl_id);
    if (new Set(nhlIds).size !== 12) continue;

    const playersByNhlId = new Map(
      picked.map((p) => [
        p.nhl_id,
        {
          nhl_id: p.nhl_id,
          position: p.position,
          conference: normalizePlayerConference(p.conference, p.team_abbrev),
          salary: p.salary,
        },
      ])
    );
    const stars = {
      Forwards: eF[0].nhl_id,
      Defence: eD[0].nhl_id,
      Goalies: eG[0].nhl_id,
    };
    const v = validatePickRosterAndStars({ nhlIds, stars, playersByNhlId });
    if (v.ok) return { nhlIds, stars };
  }
  return null;
}

async function resolveSeason(supabase, seasonArg) {
  if (seasonArg) return String(seasonArg).trim();
  const { data, error } = await supabase
    .from("players")
    .select("season")
    .order("season", { ascending: false })
    .limit(1);
  if (error) throw error;
  const s = data?.[0]?.season;
  if (s == null || s === "") {
    throw new Error("No players.season found; sync players or pass --season=");
  }
  return String(s);
}

async function main() {
  const args = parseArgs();
  const slugA = args.slug_a;
  const slugB = args.slug_b;
  if (!slugA || !slugB) {
    console.error(
      "Usage: node --env-file=.env.local scripts/seed-demo-picks.mjs --slug-a=SLUG --slug-b=SLUG [--season=ID] [--undo] [--keep-deadlines]"
    );
    process.exit(1);
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const season = await resolveSeason(supabase, args.season);

  const { data: participants, error: pErr } = await supabase
    .from("participants")
    .select("id,slug,name")
    .in("slug", [slugA, slugB]);
  if (pErr) throw pErr;
  const bySlug = new Map((participants ?? []).map((p) => [p.slug, p]));
  const missing = [slugA, slugB].filter((s) => !bySlug.has(s));
  if (missing.length) {
    console.error("Unknown slug(s):", missing.join(", "));
    process.exit(1);
  }
  if (bySlug.get(slugA).id === bySlug.get(slugB).id) {
    console.error("slug-a and slug-b must be two different participants.");
    process.exit(1);
  }

  const ids = [bySlug.get(slugA).id, bySlug.get(slugB).id];

  if (args.undo) {
    const { error: delErr } = await supabase
      .from("picks")
      .delete()
      .eq("season", season)
      .in("participant_id", ids);
    if (delErr) throw delErr;
    console.log(`Removed all picks for season ${season} for slugs: ${slugA}, ${slugB}`);
    return;
  }

  const { data: playerRows, error: plErr } = await supabase
    .from("players")
    .select("id,nhl_id,team_abbrev,position,conference,salary")
    .eq("season", season);
  if (plErr) throw plErr;
  if (!playerRows?.length) {
    console.error(`No players for season ${season}. Sync players first.`);
    process.exit(1);
  }

  const buckets = partitionPlayers(playerRows);
  const nhlToPlayerId = new Map(playerRows.map((p) => [p.nhl_id, p.id]));

  const rowsToInsert = [];
  const now = new Date().toISOString();

  for (const [idx, slug] of [slugA, slugB].entries()) {
    const participant = bySlug.get(slug);
    for (const round of [1, 2, 3]) {
      const baseSeed = hashSeed(`${slug}:${season}:r${round}:p${idx}`) + idx * 7919 + round * 131071;
      const roster = findValidRoster(buckets, baseSeed);
      if (!roster) {
        console.error(
          `Could not build a valid roster for ${slug} round ${round} (salary/position pools).`
        );
        process.exit(1);
      }
      const starSet = new Set([
        roster.stars.Forwards,
        roster.stars.Defence,
        roster.stars.Goalies,
      ]);
      for (const nhlId of roster.nhlIds) {
        const playerId = nhlToPlayerId.get(nhlId);
        if (playerId == null) {
          console.error("Internal: missing player_id for nhl_id", nhlId);
          process.exit(1);
        }
        rowsToInsert.push({
          participant_id: participant.id,
          player_id: playerId,
          round,
          season,
          is_star: starSet.has(nhlId),
          submitted_at: now,
        });
      }
    }
  }

  const { error: delErr } = await supabase
    .from("picks")
    .delete()
    .eq("season", season)
    .in("participant_id", ids);
  if (delErr) throw delErr;

  const { error: insErr } = await supabase.from("picks").insert(rowsToInsert);
  if (insErr) throw insErr;

  console.log(
    `Inserted ${rowsToInsert.length} picks (${slugA}, ${slugB}) for season ${season} (3 rounds × 12 each).`
  );
  console.log("Open /teams/<slug> and use compare. Points stay 0 until stats rows exist for those NHL IDs.");

  if (!args.keep_deadlines) {
    const { data: settingsRow, error: settingsErr } = await supabase
      .from("pool_settings")
      .select("season")
      .eq("season", season)
      .maybeSingle();
    if (settingsErr) throw settingsErr;
    if (settingsRow) {
      const { error: clearErr } = await supabase
        .from("pool_settings")
        .update({
          deadline_r1: null,
          deadline_r2: null,
          deadline_r3: null,
          updated_at: new Date().toISOString(),
        })
        .eq("season", season);
      if (clearErr) throw clearErr;
      console.log(
        `Cleared pool_settings deadline_r1–r3 for season ${season} so all rounds and compare totals show. Use --keep-deadlines to leave deadlines unchanged.`
      );
    } else {
      console.log(
        `No pool_settings row for ${season}; deadlines already unset by default.`
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
