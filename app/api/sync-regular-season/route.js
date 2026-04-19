import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CURRENT_POOL_PLAYOFF_YEAR } from "@/lib/current-pool";
import { nhlFetch } from "@/lib/nhl/api";
import { playoffYearToSeasonId } from "@/lib/nhl/season";

export const maxDuration = 300;

function parseRoundFromGameId(gameId) {
  const s = String(gameId || "");
  if (s.length !== 10) return null;
  const gameType = s.slice(4, 6);
  if (gameType !== "02") return null;
  return true;
}

function isGoalieStatLine(g) {
  return (
    typeof g.shutouts === "number" ||
    typeof g.saves === "number" ||
    typeof g.shotsAgainst === "number" ||
    typeof g.decision === "string"
  );
}

function regularSeasonPointsFromGameLog(gameLog) {
  let goals = 0;
  let assists = 0;
  let goalieWins = 0;
  let goalieShutouts = 0;

  for (const g of gameLog ?? []) {
    // Defensive: skip non-regular-season game ids if present
    if (!parseRoundFromGameId(g.gameId)) continue;

    goals += Number(g.goals || 0);
    assists += Number(g.assists || 0);

    if (isGoalieStatLine(g)) {
      if (String(g.decision || "").toUpperCase() === "W") goalieWins += 1;
      if (Number(g.shutouts || 0) > 0) goalieShutouts += 1;
    }
  }

  return goals + assists + goalieWins * 2 + goalieShutouts * 1;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const year = Number(
      searchParams.get("year") || String(CURRENT_POOL_PLAYOFF_YEAR),
    );
    const season = playoffYearToSeasonId(year);
    const limit = searchParams.get("limit")
      ? Number(searchParams.get("limit"))
      : 25;
    const offset = searchParams.get("offset")
      ? Number(searchParams.get("offset"))
      : 0;
    const concurrency = searchParams.get("concurrency")
      ? Number(searchParams.get("concurrency"))
      : 1;

    const supabase = createServerSupabaseClient();

    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id,nhl_id,season")
      .eq("season", season)
      .order("nhl_id", { ascending: true });

    if (playersError) {
      return Response.json(
        { ok: false, step: "players_select", error: playersError.message },
        { status: 500 }
      );
    }

    const selected = (players ?? []).slice(offset, offset + limit);

    let idx = 0;
    const updates = [];

    async function worker() {
      while (idx < selected.length) {
        const i = idx++;
        const p = selected[i];
        const log = await nhlFetch(`/player/${p.nhl_id}/game-log/${season}/2`, {
          maxRetries: 8,
          baseDelayMs: 1500,
        });
        const seasonPoints = regularSeasonPointsFromGameLog(log.gameLog);
        updates.push({ id: p.id, season_points: seasonPoints });
      }
    }

    await Promise.all(
      Array.from({ length: Math.max(1, Math.min(3, concurrency)) }, () => worker())
    );

    // Write back to Supabase. Requires `players.season_points` column.
    const { error: upsertError } = await supabase.from("players").upsert(updates, {
      onConflict: "id",
    });

    if (upsertError) {
      return Response.json(
        {
          ok: false,
          step: "players_upsert",
          error: upsertError.message,
          hint:
            "You likely need to add a numeric column `season_points` to the `players` table in Supabase.",
        },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      year,
      season,
      offset,
      limit,
      concurrency: Math.max(1, Math.min(3, concurrency)),
      updated: updates.length,
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

