export const metadata = {
  title: "Picks | V Chill Pool",
};

/** Always read fresh picks + pool state (avoid CDN/stale RSC after submit). */
export const dynamic = "force-dynamic";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  filterPlayersByTeamAbbrevs,
  getEligibleTeamAbbrevsForPickList,
} from "@/lib/playoff-pick-eligibility";
import { normalizePlayerConference } from "@/lib/nhl/team-conference";
import {
  deadlineForPoolRound,
  fetchPoolSettings,
  isSubmissionsLockedForRound,
} from "@/lib/pool-settings";
import DeadlineAtForViewer from "./DeadlineAtForViewer";
import PicksClient from "./ui";

function poolRoundTitle(r) {
  if (r === 1) return "Round 1";
  if (r === 2) return "Round 2";
  return "Rounds 3 + 4";
}

export default async function PicksPage({ params }) {
  const { pick_page_id } = await params;

  const supabase = createServerSupabaseClient();
  const pickPageId = Number(pick_page_id);

  const { data: participant } = Number.isFinite(pickPageId)
    ? await supabase
        .from("participants")
        .select("id,name,slug,pick_page_id")
        .eq("pick_page_id", pickPageId)
        .maybeSingle()
    : { data: null };

  const { data: seasonRows } = await supabase
    .from("players")
    .select("season")
    .order("season", { ascending: false })
    .limit(1);

  // Align with submit route (String) so pool_settings / picks .eq("season", …) always match DB text.
  const seasonRaw = seasonRows?.[0]?.season ?? null;
  const season =
    seasonRaw != null && seasonRaw !== "" ? String(seasonRaw) : null;

  let poolSettings = null;
  try {
    poolSettings = season ? await fetchPoolSettings(supabase, season) : null;
  } catch {
    poolSettings = season
      ? {
          season,
          current_round: 1,
          deadline_r1: null,
          deadline_r2: null,
          deadline_r3: null,
        }
      : null;
  }

  const currentPoolRound = poolSettings?.current_round ?? 1;
  const deadlineAt = poolSettings
    ? deadlineForPoolRound(poolSettings, currentPoolRound)
    : null;
  const submissionsLocked = poolSettings
    ? isSubmissionsLockedForRound(poolSettings, currentPoolRound)
    : false;

  const { data: players } = season
    ? await supabase
        .from("players")
        .select(
          "nhl_id,name,team_abbrev,position,conference,salary,season_points"
        )
        .eq("season", season)
    : { data: [] };

  const { data: statsRows } = season
    ? await supabase.from("stats").select("*").eq("season", season)
    : { data: [] };

  const statsByPlayer = new Map();
  for (const row of statsRows ?? []) {
    const nhlId = row.nhl_id;
    if (!nhlId) continue;
    const cur =
      statsByPlayer.get(nhlId) ?? { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };

    const wins =
      Number(row.goalie_wins ?? row.goalieWins ?? row.wins ?? 0) || 0;
    const shutouts =
      Number(row.goalie_shutout ?? row.goalie_shutouts ?? row.shutouts ?? 0) ||
      0;
    const goals = Number(row.goals ?? 0) || 0;
    const assists = Number(row.assists ?? 0) || 0;

    const points = goals + assists + wins * 2 + shutouts * 1;

    if (row.round === 1) cur.r1 += points;
    if (row.round === 2) cur.r2 += points;
    if (row.round === 3) cur.r3 += points;
    if (row.round === 4) cur.r4 += points;
    cur.total += points;

    statsByPlayer.set(nhlId, cur);
  }

  const playersWithStats = (players ?? []).map((p) => ({
    ...p,
    conference: normalizePlayerConference(p.conference, p.team_abbrev),
    stats: statsByPlayer.get(p.nhl_id) ?? {
      r1: 0,
      r2: 0,
      r3: 0,
      r4: 0,
      total: 0,
    },
  }));

  let eligibleAbbrevs = null;
  try {
    eligibleAbbrevs = await getEligibleTeamAbbrevsForPickList(
      supabase,
      season,
      currentPoolRound
    );
  } catch {
    eligibleAbbrevs = null;
  }

  let playersForPicker = filterPlayersByTeamAbbrevs(
    playersWithStats,
    eligibleAbbrevs
  );

  const eligibleTeamFilterActive = Boolean(
    eligibleAbbrevs && eligibleAbbrevs.size > 0
  );
  const eligibleTeamAbbrevsSorted =
    eligibleAbbrevs && eligibleAbbrevs.size > 0
      ? [...eligibleAbbrevs].sort()
      : null;
  const totalPlayersInSeason = playersWithStats.length;

  let savedPicks = [];
  if (participant?.id && season) {
    const roundFilter =
      currentPoolRound === 3 ? [3, 4] : [currentPoolRound];
    const { data: allSaved } = await supabase
      .from("picks")
      .select("player_id,is_star,round")
      .eq("participant_id", participant.id)
      .eq("season", season)
      .in("round", roundFilter);

    const list = allSaved ?? [];
    // Pool rounds 1–2: rows are already filtered to that round. Only R3+4 window uses legacy round 4 fallback.
    if (currentPoolRound === 3) {
      const r3 = list.filter((p) => Number(p.round) === 3);
      savedPicks = r3.length
        ? r3
        : list.filter((p) => Number(p.round) === 4);
    } else {
      savedPicks = list;
    }
  }

  const savedPlayerIds = (savedPicks ?? [])
    .map((p) => p.player_id)
    .filter(Boolean);

  const { data: savedPlayers } =
    savedPlayerIds.length && season
      ? await supabase
          .from("players")
          .select("id,nhl_id")
          .eq("season", season)
          .in("id", savedPlayerIds)
      : { data: [] };

  const nhlIdByPlayerId = new Map(
    (savedPlayers ?? []).map((p) => [p.id, p.nhl_id])
  );

  const savedNhlIds = (savedPicks ?? [])
    .map((p) => nhlIdByPlayerId.get(p.player_id))
    .filter(Boolean);

  const savedStarIds = (savedPicks ?? [])
    .filter((p) => p.is_star)
    .map((p) => nhlIdByPlayerId.get(p.player_id))
    .filter(Boolean);

  const roundTitle = poolRoundTitle(currentPoolRound);

  // Show saved roster whenever DB has picks for this round (edits still gated by submissionsLocked in the client).
  const showSavedRoster = savedNhlIds.length > 0;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-6xl">
        <h1 className="font-display text-center text-[32px] leading-[1.0] font-bold text-[#163a59]">
          {participant?.name?.trim() || `Pick page ${pick_page_id}`}
        </h1>

        <p className="mt-4 text-center text-[16px] leading-[1.2] text-zinc-800">
          Submit your team for <span className="font-semibold">{roundTitle}</span>
          {deadlineAt ? (
            <>
              {" "}
              before <DeadlineAtForViewer iso={deadlineAt} />
            </>
          ) : null}
        </p>

        <PicksClient
          key={`${currentPoolRound}-${submissionsLocked ? "locked" : "open"}`}
          pickPageId={pickPageId}
          season={season}
          currentPoolRound={currentPoolRound}
          deadlineAt={deadlineAt}
          submissionsLocked={submissionsLocked}
          initialPlayers={playersForPicker}
          initialSelectedNhlIds={showSavedRoster ? savedNhlIds : []}
          initialStarNhlIds={showSavedRoster ? savedStarIds : []}
          pickerMeta={{
            season,
            totalPlayersInSeason,
            totalInPicker: playersForPicker.length,
            eligibleTeamFilterActive,
            eligibleFilterPoolRound: eligibleTeamFilterActive
              ? currentPoolRound
              : null,
            eligibleTeamAbbrevsSorted,
          }}
        />

        <div className="mt-10 text-center text-xs text-zinc-700">
          🔄 refresh the page to confirm you team below
          <br />
          📸 then screenshot your team and send it to the Chill Commish
        </div>
      </div>
    </main>
  );
}
