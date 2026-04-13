/**
 * Remove Supabase rows for NHL seasons other than the current pool season
 * (default: 20252026 = 2026 playoffs). Deletes in FK-safe order: picks → stats
 * → players, then optional pool_settings for other seasons.
 *
 * Run from `vchill-pool/`:
 *   node --env-file=.env.local scripts/prune-noncurrent-player-seasons.mjs --dry-run
 *   node --env-file=.env.local scripts/prune-noncurrent-player-seasons.mjs --execute
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
 */

import { createClient } from "@supabase/supabase-js";

const DEFAULT_PLAYOFF_YEAR = 2026;

/** Same rule as `lib/nhl/season.js` playoffYearToSeasonId */
function playoffYearToSeasonId(y) {
  const n = Number(y);
  if (!Number.isFinite(n) || n < 1900) throw new Error(`Invalid playoff year: ${y}`);
  return `${n - 1}${n}`;
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env: ${name}`);
    process.exit(1);
  }
  return v;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    dry_run: !argv.includes("--execute"),
    playoff_year: (() => {
      const raw = argv.find((a) => a.startsWith("--playoff-year="));
      if (!raw) return DEFAULT_PLAYOFF_YEAR;
      const n = Number(raw.slice("--playoff-year=".length));
      return Number.isFinite(n) ? n : DEFAULT_PLAYOFF_YEAR;
    })(),
  };
}

async function countWhereNot(supabase, table, seasonCol, keep) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .neq(seasonCol, keep);
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

async function main() {
  const { dry_run, playoff_year } = parseArgs();
  const keepSeason = playoffYearToSeasonId(playoff_year);

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY");
  const supabase = createClient(url, key);

  console.log(
    dry_run
      ? "DRY RUN (no writes). Pass --execute to delete.\n"
      : "EXECUTING deletes…\n"
  );
  console.log(`Keeping season=${keepSeason} (playoff year ${playoff_year})\n`);

  const tables = [
    ["picks", "season"],
    ["stats", "season"],
    ["players", "season"],
    ["pool_settings", "season"],
  ];

  for (const [table, col] of tables) {
    const n = await countWhereNot(supabase, table, col, keepSeason);
    console.log(`${table}: ${n} row(s) where ${col} != ${keepSeason}`);
  }

  if (dry_run) {
    console.log("\nDone (dry run).");
    return;
  }

  for (const [table, col] of tables) {
    const { error } = await supabase.from(table).delete().neq(col, keepSeason);
    if (error) {
      console.error(`Delete ${table} failed: ${error.message}`);
      process.exit(1);
    }
    console.log(`Deleted from ${table}.`);
  }

  console.log("\nPrune complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
