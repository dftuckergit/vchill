import { createServerSupabaseClient } from "@/lib/supabase/server";
import { nhlFetch } from "@/lib/nhl/api";
import { playoffYearToSeasonId } from "@/lib/nhl/season";

/** Vercel: allow batched NHL fetches + 429 backoff without 504 (Hobby max 300s). */
export const maxDuration = 300;

/**
 * When SYNC_STATS_SECRET is set, require either:
 * - Authorization: Bearer <secret> (GitHub Actions, curl), or
 * - x-admin-password: <ADMIN_PASSWORD> (Admin UI sync buttons).
 * If SYNC_STATS_SECRET is unset, the route stays open (local dev / trusted networks).
 */
function isSyncStatsAuthorized(req) {
  const syncSecret = process.env.SYNC_STATS_SECRET;
  if (!syncSecret) return true;

  const auth = req.headers.get("authorization");
  const bearer =
    auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  if (bearer === syncSecret) return true;

  const headerSecret = req.headers.get("x-sync-stats-secret");
  if (headerSecret === syncSecret) return true;

  const adminPassword = process.env.ADMIN_PASSWORD || "";
  if (adminPassword) {
    const adminHeader = req.headers.get("x-admin-password");
    if (adminHeader === adminPassword) return true;
  }

  return false;
}

function parseRoundFromGameId(gameId) {
  // Observed playoff format: YYYY 03 RR GG (e.g. 2024030217 => round 2)
  const s = String(gameId || "");
  if (s.length !== 10) return null;
  const gameType = s.slice(4, 6);
  if (gameType !== "03") return null;
  const round = Number(s.slice(6, 8));
  return Number.isFinite(round) && round >= 1 && round <= 4 ? round : null;
}

function isGoalieStatLine(g) {
  // Goalies tend to have decision fields (win/loss/ot) or saves/shotsAgainst.
  return (
    typeof g.goalieWins === "number" ||
    typeof g.shutouts === "number" ||
    typeof g.saves === "number" ||
    typeof g.shotsAgainst === "number" ||
    typeof g.decision === "string"
  );
}

function aggregateGameLog(gameLog) {
  const byRound = new Map();

  for (const g of gameLog ?? []) {
    const round = parseRoundFromGameId(g.gameId);
    if (!round) continue;

    const cur =
      byRound.get(round) ??
      {
        goals: 0,
        assists: 0,
        goalie_wins: 0,
        goalie_shutout: 0,
      };

    cur.goals += Number(g.goals || 0);
    cur.assists += Number(g.assists || 0);

    // The NHL endpoint varies; for goalies we’ll approximate:
    if (isGoalieStatLine(g)) {
      if (String(g.decision || "").toUpperCase() === "W") cur.goalie_wins += 1;
      if (Number(g.shutouts || 0) > 0) cur.goalie_shutout += 1;
    }

    byRound.set(round, cur);
  }

  return byRound;
}

async function detectStatsColumns(supabase) {
  // Try a tiny insert+delete to detect which goalie columns exist.
  // We keep this conservative and fall back to omitting optional columns.
  const winsCandidates = ["goalie_wins", "goalieWins", "wins"];
  const shutoutCandidates = ["goalie_shutout", "goalie_shutouts", "shutouts"];

  const base = {
    nhl_id: 0,
    season: "00000000",
    round: 1,
    goals: 0,
    assists: 0,
  };

  // Prefer real column names first: (null,null) often succeeds on nullable schemas and
  // would skip goalie columns entirely, so wins/shutouts never get written or scored.
  for (const winsField of [...winsCandidates, null]) {
    for (const shutoutField of [...shutoutCandidates, null]) {
      const row = { ...base };
      if (winsField) row[winsField] = 0;
      if (shutoutField) row[shutoutField] = 0;

      const { error } = await supabase.from("stats").insert([row]).select("id");
      if (!error) {
        // Clean up the probe row
        await supabase.from("stats").delete().eq("season", base.season);
        return { winsField, shutoutField };
      }
    }
  }

  return { winsField: null, shutoutField: null };
}

export async function GET(req) {
  if (!isSyncStatsAuthorized(req)) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year") || "2025");
    const limit = searchParams.get("limit")
      ? Number(searchParams.get("limit"))
      : null;
    const offset = searchParams.get("offset")
      ? Number(searchParams.get("offset"))
      : 0;
    const concurrencyParam = searchParams.get("concurrency")
      ? Number(searchParams.get("concurrency"))
      : null;
    const season = playoffYearToSeasonId(year);

    const supabase = createServerSupabaseClient();
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("nhl_id,season")
      .eq("season", season);

    if (playersError) {
      return Response.json(
        { ok: false, step: "players_select", error: playersError.message },
        { status: 500 }
      );
    }

    // Only clear stats on the first batch (offset=0) to avoid nuking progress.
    if (!offset) {
      const { error: deleteError } = await supabase
        .from("stats")
        .delete()
        .eq("season", season);

      if (deleteError) {
        return Response.json(
          { ok: false, step: "stats_delete", error: deleteError.message },
          { status: 500 }
        );
      }
    }

    const { winsField, shutoutField } = await detectStatsColumns(supabase);

    const sliceStart = Number.isFinite(offset) && offset > 0 ? offset : 0;
    const sliceEnd =
      limit && Number.isFinite(limit) ? sliceStart + limit : undefined;
    const allPlayers = players ?? [];
    const selectedPlayers = allPlayers.slice(sliceStart, sliceEnd);

    // Default low to avoid Cloudflare bans; can override via query param.
    const concurrency =
      concurrencyParam && Number.isFinite(concurrencyParam)
        ? Math.max(1, Math.min(10, concurrencyParam))
        : 2;
    let idx = 0;
    let inserted = 0;

    /** One timestamp per sync request for `stats.created_at` (standings “last updated”). */
    const statsWriteAt = new Date().toISOString();

    async function worker() {
      while (idx < selectedPlayers.length) {
        const i = idx++;
        const p = selectedPlayers[i];

        const log = await nhlFetch(`/player/${p.nhl_id}/game-log/${season}/3`, {
          maxRetries: 8,
          baseDelayMs: 1500,
        });
        const byRound = aggregateGameLog(log.gameLog);

        const rows = [];
        for (const [round, agg] of byRound.entries()) {
          const row = {
            nhl_id: p.nhl_id,
            season,
            round,
            goals: agg.goals,
            assists: agg.assists,
            created_at: statsWriteAt,
          };
          if (winsField) row[winsField] = agg.goalie_wins;
          if (shutoutField) row[shutoutField] = agg.goalie_shutout;
          rows.push(row);
        }

        if (rows.length) {
          const { error: insertError, data } = await supabase
            .from("stats")
            .insert(rows)
            .select("id");
          if (insertError) {
            throw new Error(insertError.message);
          }
          inserted += data?.length ?? rows.length;
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    return Response.json({
      ok: true,
      year,
      season,
      offset: sliceStart,
      limit: limit && Number.isFinite(limit) ? limit : null,
      concurrency,
      total_players: allPlayers.length,
      next_offset: sliceStart + selectedPlayers.length,
      players: selectedPlayers?.length ?? 0,
      stats_rows: inserted,
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

