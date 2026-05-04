import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizePoolSettingsRow } from "@/lib/pool-settings";

function parseSeasonFromUrl(req) {
  const { searchParams } = new URL(req.url);
  const season = String(searchParams.get("season") || "").trim();
  return season || null;
}

function clampInt(v, { min = 0, max = 1_000_000 } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return Math.max(min, Math.min(max, i));
}

export async function GET(req) {
  try {
    const season = parseSeasonFromUrl(req);
    if (!season) {
      return Response.json({ ok: false, error: "Missing season" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("pool_settings")
      .select("*")
      .eq("season", season)
      .maybeSingle();

    if (error) {
      return Response.json({ ok: false, error: error.message }, { status: 500 });
    }

    const settings = normalizePoolSettingsRow(data ?? { season });
    const total = Number(settings.stats_last_sync_total_players);
    const processed = Number(settings.stats_last_sync_processed_players);
    const percent =
      Number.isFinite(total) && total > 0 && Number.isFinite(processed)
        ? Math.max(0, Math.min(1, processed / total))
        : null;

    return Response.json({
      ok: true,
      season,
      status: {
        stats_last_sync_started_at: settings.stats_last_sync_started_at,
        stats_last_sync_completed_at: settings.stats_last_sync_completed_at,
        stats_last_sync_total_players: settings.stats_last_sync_total_players,
        stats_last_sync_processed_players: settings.stats_last_sync_processed_players,
        stats_last_sync_ok: settings.stats_last_sync_ok,
        stats_last_sync_error: settings.stats_last_sync_error,
        percent_processed: percent,
      },
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const body = await req.json().catch(() => null);
    const season = String(body?.season || "").trim();
    if (!season) {
      return Response.json({ ok: false, error: "Missing season" }, { status: 400 });
    }

    const row = {
      season,
      stats_last_sync_started_at:
        body?.stats_last_sync_started_at != null
          ? String(body.stats_last_sync_started_at)
          : null,
      stats_last_sync_completed_at:
        body?.stats_last_sync_completed_at != null
          ? String(body.stats_last_sync_completed_at)
          : null,
      stats_last_sync_total_players: clampInt(body?.stats_last_sync_total_players, {
        min: 0,
        max: 100_000,
      }),
      stats_last_sync_processed_players: clampInt(
        body?.stats_last_sync_processed_players,
        { min: 0, max: 100_000 }
      ),
      stats_last_sync_ok:
        body?.stats_last_sync_ok == null ? null : Boolean(body.stats_last_sync_ok),
      stats_last_sync_error:
        body?.stats_last_sync_error != null
          ? String(body.stats_last_sync_error)
          : null,
    };

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("pool_settings")
      .upsert(row, { onConflict: "season" })
      .select("*")
      .single();

    if (error) {
      const msg = error.message || "Unknown database error";
      const missingColumnHint =
        msg.toLowerCase().includes("column") && msg.toLowerCase().includes("does not exist")
          ? "Your Supabase `pool_settings` table is missing the new stats sync status columns. Run `sql/pool_settings_stats_sync_status.sql` in the Supabase SQL editor, then retry."
          : null;
      return Response.json(
        { ok: false, error: msg, ...(missingColumnHint ? { hint: missingColumnHint } : {}) },
        { status: 500 }
      );
    }

    const settings = normalizePoolSettingsRow(data ?? row);
    return Response.json({ ok: true, season, status: settings });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

