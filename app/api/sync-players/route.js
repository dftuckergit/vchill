import { createServerSupabaseClient } from "@/lib/supabase/server";
import { nhlFetch } from "@/lib/nhl/api";
import { conferenceForTeamAbbrev } from "@/lib/nhl/team-conference";
import { playoffYearToSeasonId } from "@/lib/nhl/season";
import { extractPlayoffTeamsFromBracket } from "@/lib/nhl/playoff-bracket-teams";

function getText(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && typeof v.default === "string") return v.default;
  return "";
}

function toConference(conferenceNameOrAbbrev) {
  const v = String(conferenceNameOrAbbrev || "").toLowerCase().trim();
  if (v === "e" || v === "eastern" || v.startsWith("east")) return "East";
  if (v === "w" || v === "western" || v.startsWith("west")) return "West";
  return "Unknown";
}

async function fetchTeamConferenceMap({ year }) {
  const date = `${year}-04-01`;
  const standings = await nhlFetch(`/standings/${date}`);
  const map = new Map();
  for (const row of standings.standings ?? []) {
    const abbrev = getText(row.teamAbbrev).toUpperCase();
    if (!abbrev) continue;
    map.set(
      abbrev,
      toConference(getText(row.conferenceName) || getText(row.conferenceAbbrev))
    );
  }
  return map;
}

function rosterToPlayerRows({ roster, teamAbbrev, teamName, season, conference }) {
  const out = [];

  for (const p of roster.forwards ?? []) {
    out.push({
      nhl_id: p.id,
      name: `${getText(p.firstName)} ${getText(p.lastName)}`.trim(),
      team: teamName,
      team_abbrev: teamAbbrev,
      position: "F",
      conference,
      salary: 0,
      season,
    });
  }

  for (const p of roster.defensemen ?? []) {
    out.push({
      nhl_id: p.id,
      name: `${getText(p.firstName)} ${getText(p.lastName)}`.trim(),
      team: teamName,
      team_abbrev: teamAbbrev,
      position: "D",
      conference,
      salary: 0,
      season,
    });
  }

  for (const p of roster.goalies ?? []) {
    out.push({
      nhl_id: p.id,
      name: `${getText(p.firstName)} ${getText(p.lastName)}`.trim(),
      team: teamName,
      team_abbrev: teamAbbrev,
      position: "G",
      conference,
      salary: 0,
      season,
    });
  }

  return out.filter((p) => p.nhl_id && p.name);
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get("year") || "2025");
    const season = playoffYearToSeasonId(year);

    const bracket = await nhlFetch(`/playoff-bracket/${year}`);
    const conferenceByTeam = await fetchTeamConferenceMap({ year });

    const teamMap = extractPlayoffTeamsFromBracket(bracket);
    const teams = Array.from(teamMap.values());
    if (teams.length === 0) {
      return Response.json(
        { ok: false, error: "No teams found in playoff bracket response." },
        { status: 500 }
      );
    }

    const allPlayers = [];
    for (const team of teams) {
      const abbrevUpper = team.abbrev;
      const roster = await nhlFetch(`/roster/${abbrevUpper}/${season}`);
      const fromStandings = conferenceByTeam.get(abbrevUpper);
      const conference =
        conferenceForTeamAbbrev(abbrevUpper) ??
        (fromStandings === "East" || fromStandings === "West"
          ? fromStandings
          : "Unknown");

      allPlayers.push(
        ...rosterToPlayerRows({
          roster,
          teamAbbrev: abbrevUpper,
          teamName: team.name,
          season,
          conference,
        })
      );
    }

    const supabase = createServerSupabaseClient();
    const { error: deleteError } = await supabase
      .from("players")
      .delete()
      .eq("season", season);

    if (deleteError) {
      return Response.json(
        { ok: false, step: "delete", error: deleteError.message },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from("players")
      .insert(allPlayers)
      .select("id,nhl_id,name,team_abbrev,position,season");

    if (error) {
      return Response.json(
        { ok: false, step: "insert", error: error.message },
        { status: 500 }
      );
    }

    const conferenceCounts = { East: 0, West: 0, Unknown: 0 };
    for (const p of allPlayers) {
      const c = p.conference || "Unknown";
      conferenceCounts[c] = (conferenceCounts[c] || 0) + 1;
    }

    return Response.json({
      ok: true,
      year,
      season,
      teams: teams.length,
      players: allPlayers.length,
      conferenceCounts,
      upserted: data?.length ?? 0,
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
