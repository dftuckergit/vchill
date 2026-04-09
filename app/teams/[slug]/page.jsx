export const metadata = {
  title: "Team | V Chill Pool",
};

import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  arePicksVisibleAfterDeadline,
  fetchPoolSettings,
} from "@/lib/pool-settings";
import { computeParticipantSummary } from "@/lib/scoring";
import TeamClient from "./ui";

export default async function TeamPage({ params }) {
  const { slug } = await params;
  const supabase = createServerSupabaseClient();
  const { data: participant } = await supabase
    .from("participants")
    .select("id,name,slug,pick_page_id")
    .eq("slug", slug)
    .maybeSingle();

  const displayName =
    participant?.name ??
    slug
      .split("-")
      .map((p) => p.slice(0, 1).toUpperCase() + p.slice(1))
      .join(" ");

  const { data: teams } = await supabase
    .from("participants")
    .select("id,name,slug")
    .order("name", { ascending: true });

  const { data: seasonRows } = await supabase
    .from("players")
    .select("season")
    .order("season", { ascending: false })
    .limit(1);

  const season = seasonRows?.[0]?.season ?? null;

  let poolSettings = null;
  let currentPoolRound = 1;
  try {
    if (season) {
      poolSettings = await fetchPoolSettings(supabase, season);
      currentPoolRound = poolSettings.current_round;
    }
  } catch {
    poolSettings = null;
    currentPoolRound = 1;
  }

  const picksRevealedByRound = poolSettings
    ? {
        1: arePicksVisibleAfterDeadline(poolSettings, 1),
        2: arePicksVisibleAfterDeadline(poolSettings, 2),
        3: arePicksVisibleAfterDeadline(poolSettings, 3),
      }
    : { 1: true, 2: true, 3: true };

  const meSummary =
    participant?.id && season
      ? await (async () => {
          const { data: picks } = await supabase
            .from("picks")
            .select("player_id,round,is_star")
            .eq("participant_id", participant.id)
            .eq("season", season);

          const playerIds = Array.from(
            new Set((picks ?? []).map((p) => p.player_id).filter(Boolean))
          );

          const { data: players } = playerIds.length
            ? await supabase
                .from("players")
                .select("id,nhl_id,name,team_abbrev,position,conference")
                .eq("season", season)
                .in("id", playerIds)
            : { data: [] };

          const nhlIds = Array.from(
            new Set((players ?? []).map((p) => p.nhl_id).filter(Boolean))
          );

          const { data: statsRows } = nhlIds.length
            ? await supabase
                .from("stats")
                .select("*")
                .eq("season", season)
                .in("nhl_id", nhlIds)
            : { data: [] };

          return computeParticipantSummary({
            participant,
            season,
            picks: (picks ?? []).map((p) => ({
              participant_id: participant.id,
              player_id: p.player_id,
              round: p.round,
              is_star: p.is_star,
            })),
            players: players ?? [],
            statsRows: statsRows ?? [],
          });
        })()
      : computeParticipantSummary({
          participant: participant ?? { id: null, name: displayName, slug },
          season,
          picks: [],
          players: [],
          statsRows: [],
        });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-3xl text-center">
        <h1 className="text-[32px] leading-[1.0] font-semibold text-[#163a59]">
          {displayName}
        </h1>
        <p className="mt-3 text-[16px] leading-[1.2] text-zinc-800">
          Lives in Berlin
          <br />
          wears Flames pyjamas
          <br />
          learn more <span className="underline">here</span>.
        </p>

        {participant?.pick_page_id ? (
          <p className="mt-4 text-sm text-zinc-700">
            Picks page:{" "}
            <Link
              className="font-mono underline"
              href={`/picks/${participant.pick_page_id}`}
            >
              /picks/{participant.pick_page_id}
            </Link>
          </p>
        ) : null}

        <TeamClient
          season={season}
          currentPoolRound={currentPoolRound}
          picksRevealedByRound={picksRevealedByRound}
          meSummary={meSummary}
          teams={teams ?? []}
        />
      </div>
    </main>
  );
}

