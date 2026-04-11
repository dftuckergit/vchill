/**
 * Remove all picks for a season and set pool_settings.current_round to 1.
 * Uses the same Supabase env as the app.
 *
 *   node --env-file=.env.local scripts/reset-season-picks.mjs
 *   node --env-file=.env.local scripts/reset-season-picks.mjs --season=20252026
 */

import { createClient } from "@supabase/supabase-js";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

function parseArgs() {
  const out = {};
  for (const a of process.argv.slice(2)) {
    const eq = a.indexOf("=");
    if (eq !== -1 && a.startsWith("--")) {
      out[a.slice(2, eq).replace(/-/g, "_")] = a.slice(eq + 1);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let season = args.season?.trim();
  if (!season) {
    const { data, error } = await supabase
      .from("players")
      .select("season")
      .order("season", { ascending: false })
      .limit(1);
    if (error) throw error;
    season = data?.[0]?.season;
    if (!season) {
      console.error("No players.season found; pass --season=");
      process.exit(1);
    }
    season = String(season);
  }

  const { error: delErr } = await supabase
    .from("picks")
    .delete()
    .eq("season", season);
  if (delErr) throw delErr;

  const { data: settingsRow, error: selErr } = await supabase
    .from("pool_settings")
    .select("season")
    .eq("season", season)
    .maybeSingle();
  if (selErr) throw selErr;

  if (settingsRow) {
    const { error: updErr } = await supabase
      .from("pool_settings")
      .update({
        current_round: 1,
        updated_at: new Date().toISOString(),
      })
      .eq("season", season);
    if (updErr) throw updErr;
    console.log(`Updated pool_settings for ${season}: current_round = 1`);
  } else {
    console.log(`No pool_settings row for ${season} (skipped current_round update)`);
  }

  console.log(`Deleted all picks for season ${season}. Pool is clear; round is 1 when settings exist.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
