import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getEligibleTeamAbbrevsForPickList } from "@/lib/playoff-pick-eligibility";
import { normalizePlayerConference } from "@/lib/nhl/team-conference";
import { validatePickRosterAndStars } from "@/lib/pick-roster-rules";
import {
  fetchPoolSettings,
  isSubmissionsLockedForRound,
} from "@/lib/pool-settings";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    const pick_page_id = Number(body?.pick_page_id);
    const season = String(body?.season || "");
    const round = Number(body?.round || 1);
    const roster = Array.isArray(body?.roster) ? body.roster : [];
    const stars = body?.stars && typeof body.stars === "object" ? body.stars : {};

    if (!Number.isFinite(pick_page_id)) {
      return Response.json({ ok: false, error: "Invalid pick_page_id" }, { status: 400 });
    }
    if (!season) {
      return Response.json({ ok: false, error: "Missing season" }, { status: 400 });
    }
    if (![1, 2, 3].includes(round)) {
      return Response.json(
        { ok: false, error: "Invalid round (must be pool round 1, 2, or 3)." },
        { status: 400 }
      );
    }

    const nhlIds = roster.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    if (nhlIds.length !== 12) {
      return Response.json(
        { ok: false, error: "Roster must contain exactly 12 players." },
        { status: 400 }
      );
    }
    if (new Set(nhlIds).size !== 12) {
      return Response.json(
        { ok: false, error: "Roster cannot include the same player twice." },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    const poolSettings = await fetchPoolSettings(supabase, season);
    if (round !== poolSettings.current_round) {
      return Response.json(
        {
          ok: false,
          error: `Submissions are only open for pool round ${poolSettings.current_round}.`,
        },
        { status: 403 }
      );
    }
    if (isSubmissionsLockedForRound(poolSettings, round)) {
      return Response.json(
        { ok: false, error: "The deadline for this round has passed." },
        { status: 403 }
      );
    }

    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id,pick_page_id")
      .eq("pick_page_id", pick_page_id)
      .maybeSingle();

    if (participantError) {
      return Response.json(
        { ok: false, step: "participant_select", error: participantError.message },
        { status: 500 }
      );
    }
    if (!participant?.id) {
      return Response.json({ ok: false, error: "Participant not found." }, { status: 404 });
    }

    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id,nhl_id,team_abbrev,position,conference,salary")
      .eq("season", season)
      .in("nhl_id", nhlIds);

    if (playersError) {
      return Response.json(
        { ok: false, step: "players_select", error: playersError.message },
        { status: 500 }
      );
    }

    const normalizedPlayers = (players ?? []).map((p) => ({
      ...p,
      conference: normalizePlayerConference(p.conference, p.team_abbrev),
    }));

    const playerIdByNhlId = new Map(normalizedPlayers.map((p) => [p.nhl_id, p.id]));
    if (playerIdByNhlId.size !== nhlIds.length) {
      return Response.json(
        { ok: false, error: "Some NHL IDs were not found in Supabase players table." },
        { status: 400 }
      );
    }

    const playersByNhlId = new Map(normalizedPlayers.map((p) => [p.nhl_id, p]));
    const rules = validatePickRosterAndStars({ nhlIds, stars, playersByNhlId });
    if (!rules.ok) {
      return Response.json({ ok: false, error: rules.error }, { status: 400 });
    }

    const starIds = ["Forwards", "Defence", "Goalies"].map((k) => Number(stars[k]));

    let eligibleAbbrevs = null;
    try {
      eligibleAbbrevs = await getEligibleTeamAbbrevsForPickList(
        supabase,
        season,
        round
      );
    } catch {
      eligibleAbbrevs = null;
    }
    if (eligibleAbbrevs) {
      for (const p of normalizedPlayers) {
        if (!eligibleAbbrevs.has(String(p.team_abbrev || "").toUpperCase())) {
          return Response.json(
            {
              ok: false,
              error:
                "Roster includes a player whose team is not eligible for this pool round (eliminated or stats not synced yet).",
            },
            { status: 400 }
          );
        }
      }
    }

    const now = new Date().toISOString();
    const rows = nhlIds.map((nhlId) => ({
      participant_id: participant.id,
      player_id: playerIdByNhlId.get(nhlId),
      round,
      season,
      is_star: starIds.includes(nhlId),
      submitted_at: now,
    }));

    // Replace existing picks for that participant/season for this pool round
    const deleteQuery = supabase
      .from("picks")
      .delete()
      .eq("participant_id", participant.id)
      .eq("season", season);
    const { error: deleteError } =
      round === 3
        ? await deleteQuery.in("round", [3, 4])
        : await deleteQuery.eq("round", round);

    if (deleteError) {
      return Response.json(
        { ok: false, step: "picks_delete", error: deleteError.message },
        { status: 500 }
      );
    }

    const { error: insertError } = await supabase.from("picks").insert(rows);
    if (insertError) {
      return Response.json(
        { ok: false, step: "picks_insert", error: insertError.message },
        { status: 500 }
      );
    }

    return Response.json({
      ok: true,
      participant_id: participant.id,
      season,
      round,
      picks: rows.length,
      submitted_at: now,
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

