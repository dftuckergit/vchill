export const metadata = {
  title: "Analysis | V Chill Pool",
};

export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normalizePlayerConference } from "@/lib/nhl/team-conference";
import { getEligibleTeamAbbrevsForPickList } from "@/lib/playoff-pick-eligibility";
import {
  aggregateStatsByNhlId,
  poolRoundStatPoints,
  buildRoundPickIndex,
  eligibleAbbrevsToJson,
} from "@/lib/analysis-player-metrics";
import AnalysisClient from "./ui";

function serializeRoundIndex(map) {
  const o = {};
  for (const [k, v] of map) {
    o[String(k)] = v;
  }
  return o;
}

export default async function AnalysisPage() {
  const supabase = createServerSupabaseClient();

  const { data: seasonRows } = await supabase
    .from("players")
    .select("season")
    .order("season", { ascending: false })
    .limit(1);

  const seasonRaw = seasonRows?.[0]?.season ?? null;
  const season =
    seasonRaw != null && seasonRaw !== "" ? String(seasonRaw) : null;

  const { data: participants } = season
    ? await supabase
        .from("participants")
        .select("id,name,slug")
        .order("name", { ascending: true })
    : { data: [] };

  const participantsById = new Map(
    (participants ?? []).map((p) => [p.id, p]),
  );

  const [playersRes, statsRes, picksRes, e1, e2, e3] = season
    ? await Promise.all([
        supabase
          .from("players")
          .select(
            "id,nhl_id,name,team_abbrev,position,conference,season_points",
          )
          .eq("season", season),
        supabase.from("stats").select("*").eq("season", season),
        supabase
          .from("picks")
          .select("participant_id,player_id,round,is_star")
          .eq("season", season),
        getEligibleTeamAbbrevsForPickList(supabase, season, 1),
        getEligibleTeamAbbrevsForPickList(supabase, season, 2),
        getEligibleTeamAbbrevsForPickList(supabase, season, 3),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        null,
        null,
        null,
      ];

  const playersRaw = playersRes?.data ?? [];
  const statsRows = statsRes?.data ?? [];
  const picks = picksRes?.data ?? [];

  const statsByNhlId = aggregateStatsByNhlId(statsRows);

  const playersPayload = (playersRaw ?? []).map((p) => {
    const conference = normalizePlayerConference(
      p.conference,
      p.team_abbrev,
    );
    const st =
      statsByNhlId.get(p.nhl_id) ?? { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };
    return {
      id: p.id,
      nhl_id: p.nhl_id,
      name: p.name,
      team_abbrev: p.team_abbrev,
      position: p.position,
      conference,
      season_points: p.season_points,
      pts1: poolRoundStatPoints(st, 1),
      pts2: poolRoundStatPoints(st, 2),
      pts3: poolRoundStatPoints(st, 3),
    };
  });

  const roundPickData = {
    1: serializeRoundIndex(
      buildRoundPickIndex(picks, 1, participantsById),
    ),
    2: serializeRoundIndex(
      buildRoundPickIndex(picks, 2, participantsById),
    ),
    3: serializeRoundIndex(
      buildRoundPickIndex(picks, 3, participantsById),
    ),
  };

  const eligibleByRound = {
    1: eligibleAbbrevsToJson(e1),
    2: eligibleAbbrevsToJson(e2),
    3: eligibleAbbrevsToJson(e3),
  };

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-6xl">
        <h1 className="text-center text-[32px] leading-[1.0] font-black text-[#163a59]">
          Pick analysis
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-zinc-700">
          See who picked who, by round.
        </p>

        <AnalysisClient
          season={season}
          players={playersPayload}
          eligibleByRound={eligibleByRound}
          roundPickData={roundPickData}
        />
      </div>
    </main>
  );
}
