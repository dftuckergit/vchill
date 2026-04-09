import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeParticipantSummary } from "@/lib/scoring";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const participant_id = Number(searchParams.get("participant_id"));
    const season = String(searchParams.get("season") || "");

    if (!Number.isFinite(participant_id)) {
      return Response.json(
        { ok: false, error: "Invalid participant_id" },
        { status: 400 }
      );
    }
    if (!season) {
      return Response.json({ ok: false, error: "Missing season" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient();

    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id,name,slug,pick_page_id")
      .eq("id", participant_id)
      .maybeSingle();

    if (participantError) {
      return Response.json(
        { ok: false, step: "participant_select", error: participantError.message },
        { status: 500 }
      );
    }
    if (!participant?.id) {
      return Response.json({ ok: false, error: "Participant not found" }, { status: 404 });
    }

    const { data: picks, error: picksError } = await supabase
      .from("picks")
      .select("player_id,round,is_star")
      .eq("participant_id", participant_id)
      .eq("season", season);

    if (picksError) {
      return Response.json(
        { ok: false, step: "picks_select", error: picksError.message },
        { status: 500 }
      );
    }

    const playerIds = Array.from(
      new Set((picks ?? []).map((p) => p.player_id).filter(Boolean))
    );

    const { data: players, error: playersError } = playerIds.length
      ? await supabase
          .from("players")
          .select("id,nhl_id,name,team_abbrev,position,conference")
          .eq("season", season)
          .in("id", playerIds)
      : { data: [], error: null };

    if (playersError) {
      return Response.json(
        { ok: false, step: "players_select", error: playersError.message },
        { status: 500 }
      );
    }

    const nhlIds = Array.from(
      new Set((players ?? []).map((p) => p.nhl_id).filter(Boolean))
    );

    const { data: statsRows, error: statsError } = await supabase
      .from("stats")
      .select("*")
      .eq("season", season)
      .in("nhl_id", nhlIds);

    if (statsError) {
      return Response.json(
        { ok: false, step: "stats_select", error: statsError.message },
        { status: 500 }
      );
    }

    const summary = computeParticipantSummary({
      participant,
      season,
      picks: (picks ?? []).map((p) => ({
        participant_id,
        player_id: p.player_id,
        round: p.round,
        is_star: p.is_star,
      })),
      players: players ?? [],
      statsRows: statsRows ?? [],
    });

    return Response.json({ ok: true, summary });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

