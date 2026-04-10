import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  fetchPoolSettings,
  mergeStatsSyncFromPut,
  normalizePoolSettingsRow,
} from "@/lib/pool-settings";
import { seasonIdToPlayoffYear } from "@/lib/nhl/season";
import {
  fetchPlayoffTeamsMap,
  restrictEligibleTeamsToPlayoffAbbrevs,
} from "@/lib/nhl/playoff-bracket-teams";

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const season = String(searchParams.get("season") || "");
    if (!season) {
      return Response.json({ ok: false, error: "Missing season" }, { status: 400 });
    }
    const supabase = createServerSupabaseClient();
    const settings = await fetchPoolSettings(supabase, season);
    return Response.json({ ok: true, settings });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const adminPw = getAdminPassword();
    if (!adminPw) {
      return Response.json(
        {
          ok: false,
          error: "ADMIN_PASSWORD is not set; refusing to update pool settings.",
        },
        { status: 503 }
      );
    }

    const headerPw = req.headers.get("x-admin-password");
    const body = await req.json().catch(() => null);
    const provided = headerPw || body?.admin_password || "";
    if (provided !== adminPw) {
      return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const season = String(body?.season || "");
    if (!season) {
      return Response.json({ ok: false, error: "Missing season" }, { status: 400 });
    }

    let current_round = Number(body?.current_round ?? 1);
    if (![1, 2, 3].includes(current_round)) {
      return Response.json(
        { ok: false, error: "current_round must be 1, 2, or 3" },
        { status: 400 }
      );
    }

    function parseDeadline(v) {
      if (v == null || v === "") return null;
      const s = String(v);
      const d = new Date(s);
      if (!Number.isFinite(d.getTime())) return null;
      return d.toISOString();
    }

    const deadline_r1 = parseDeadline(body?.deadline_r1);
    const deadline_r2 = parseDeadline(body?.deadline_r2);
    const deadline_r3 = parseDeadline(body?.deadline_r3);

    const supabase = createServerSupabaseClient();
    const existing = await fetchPoolSettings(supabase, season);

    let playoffYear;
    try {
      playoffYear = seasonIdToPlayoffYear(season);
    } catch {
      return Response.json(
        { ok: false, error: "Invalid season id (expected 8-digit NHL season string)" },
        { status: 400 }
      );
    }

    let playoffAbbrevSet;
    try {
      const playoffMap = await fetchPlayoffTeamsMap(playoffYear);
      playoffAbbrevSet = new Set(playoffMap.keys());
    } catch (e) {
      return Response.json(
        {
          ok: false,
          error: `Could not load playoff bracket for ${playoffYear}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        },
        { status: 502 }
      );
    }

    if (playoffAbbrevSet.size === 0) {
      return Response.json(
        { ok: false, error: "Playoff bracket returned no teams for that year." },
        { status: 502 }
      );
    }

    function resolveEligible(field) {
      const raw =
        body && Object.prototype.hasOwnProperty.call(body, field)
          ? body[field]
          : existing[field];
      return restrictEligibleTeamsToPlayoffAbbrevs(raw, playoffAbbrevSet);
    }

    const r1 = resolveEligible("eligible_teams_r1");
    const r2 = resolveEligible("eligible_teams_r2");
    const r3 = resolveEligible("eligible_teams_r3");

    const eligible_teams_r1 = r1.value;
    const eligible_teams_r2 = r2.value;
    const eligible_teams_r3 = r3.value;

    const removedEligible = [
      ...new Set([...r1.removed, ...r2.removed, ...r3.removed]),
    ];

    const { stats_sync_limit, stats_sync_concurrency } = mergeStatsSyncFromPut(
      body,
      existing
    );

    const now = new Date().toISOString();
    const row = {
      season,
      current_round,
      deadline_r1,
      deadline_r2,
      deadline_r3,
      eligible_teams_r1,
      eligible_teams_r2,
      eligible_teams_r3,
      stats_sync_limit,
      stats_sync_concurrency,
      updated_at: now,
    };

    const { data, error } = await supabase
      .from("pool_settings")
      .upsert(row, { onConflict: "season" })
      .select("*")
      .single();

    if (error) {
      return Response.json(
        { ok: false, step: "upsert", error: error.message },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      settings: normalizePoolSettingsRow(data ?? row),
      ...(removedEligible.length > 0
        ? {
            eligible_teams_removed_not_in_playoffs: removedEligible,
          }
        : {}),
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
