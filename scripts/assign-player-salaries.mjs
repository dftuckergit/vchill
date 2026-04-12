/**
 * One-shot: assign `players.salary` (1–4) from `season_points` + position.
 * After `sync-players` preserves salaries by `nhl_id`, you normally run this
 * only when seeding values (then tweak in Supabase).
 *
 * Run from repo `vchill-pool/`:
 *   node --env-file=.env.local scripts/assign-player-salaries.mjs --season=20252026 --dry-run
 *   npm run assign:salaries -- --season=20252026
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY
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
  const out = { dry_run: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") {
      out.dry_run = true;
      continue;
    }
    if (a.startsWith("--")) {
      const eq = a.indexOf("=");
      if (eq !== -1) {
        const key = a.slice(2, eq).replace(/-/g, "_");
        const val = a.slice(eq + 1);
        out[key] = val;
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

function pts(p) {
  return Number(p.season_points) || 0;
}

function initialSalaryForward(p, min4) {
  const x = pts(p);
  if (x > min4) return 4;
  if (x > 72) return 3;
  if (x > 48) return 2;
  return 1;
}

function initialSalaryDefense(p, min4) {
  const x = pts(p);
  if (x > min4) return 4;
  if (x > 38) return 3;
  if (x > 22) return 2;
  return 1;
}

/** idx 0 = highest points among goalies */
function salaryGoalieByRank(idx, n) {
  if (n <= 0) return 1;
  const t = idx / n;
  if (t < 0.15) return 4;
  if (t < 0.4) return 3;
  if (t < 0.7) return 2;
  return 1;
}

function countBySalary(rows) {
  const c = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const r of rows) {
    const s = Number(r.salary);
    if (s >= 1 && s <= 4) c[s]++;
  }
  return c;
}

function enforceFewerFoursThanOnes(working) {
  while (true) {
    const c = countBySalary(working);
    if (c[4] < c[1]) break;
    const fours = working.filter((p) => p.salary === 4);
    if (fours.length === 0) break;
    let victim = fours[0];
    let minPts = pts(victim);
    for (const p of fours) {
      const t = pts(p);
      if (t < minPts) {
        minPts = t;
        victim = p;
      }
    }
    victim.salary = 3;
  }
}

function main() {
  const args = parseArgs();
  const season = String(args.season || "").trim();
  if (!/^\d{8}$/.test(season)) {
    console.error("Pass --season=######## (8-digit NHL season id, e.g. 20252026)");
    process.exit(1);
  }

  const min4F = Number(args.min_4_forward_points ?? 90);
  const min4D = Number(args.min_4_defense_points ?? 50);
  if (!Number.isFinite(min4F) || !Number.isFinite(min4D)) {
    console.error("Invalid min_4_* thresholds");
    process.exit(1);
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY");
  const supabase = createClient(url, key);

  return (async () => {
    const { data: rows, error } = await supabase
      .from("players")
      .select("id,nhl_id,position,season_points,salary")
      .eq("season", season);

    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    if (!rows?.length) {
      console.error(`No players for season ${season}`);
      process.exit(1);
    }

    const goalies = rows.filter((p) => p.position === "G");
    goalies.sort((a, b) => pts(b) - pts(a));
    const goalieRankById = new Map();
    goalies.forEach((g, idx) => goalieRankById.set(g.id, idx));

    const working = rows.map((p) => {
      let salary;
      if (p.position === "F") salary = initialSalaryForward(p, min4F);
      else if (p.position === "D") salary = initialSalaryDefense(p, min4D);
      else if (p.position === "G") {
        const idx = goalieRankById.get(p.id) ?? 0;
        salary = salaryGoalieByRank(idx, goalies.length);
      } else {
        salary = 1;
      }
      return { ...p, salary };
    });

    enforceFewerFoursThanOnes(working);

    const c = countBySalary(working);
    console.log(`Season ${season} — ${working.length} players`);
    console.log("Salary counts:", c);
    console.log(`Constraint count(4) < count(1): ${c[4] < c[1]} (${c[4]} vs ${c[1]})`);

    if (args.dry_run) {
      console.log("--dry-run: no database writes");
      return;
    }

    const updates = working.map((p) => ({ id: p.id, salary: p.salary }));
    const BATCH = 40;
    for (let i = 0; i < updates.length; i += BATCH) {
      const slice = updates.slice(i, i + BATCH);
      const results = await Promise.all(
        slice.map(({ id, salary }) =>
          supabase.from("players").update({ salary }).eq("id", id)
        )
      );
      const bad = results.find((r) => r.error);
      if (bad?.error) {
        console.error(bad.error.message);
        process.exit(1);
      }
    }
    console.log(`Updated ${updates.length} rows.`);
  })();
}

main();
