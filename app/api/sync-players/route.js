import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CURRENT_POOL_PLAYOFF_YEAR } from "@/lib/current-pool";
import { nhlFetch } from "@/lib/nhl/api";
import { conferenceForTeamAbbrev } from "@/lib/nhl/team-conference";
import { playoffYearToSeasonId } from "@/lib/nhl/season";
import { extractPlayoffTeamsFromBracket } from "@/lib/nhl/playoff-bracket-teams";

/** Hobby / Pro: roster sync hits many NHL endpoints. */
export const maxDuration = 300;

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

async function fetchStandingsTeamMaps({ year }) {
  const date = `${year}-04-01`;
  const standings = await nhlFetch(`/standings/${date}`);
  const conferenceByTeam = new Map();
  const teamNameByAbbrev = new Map();
  for (const row of standings.standings ?? []) {
    const abbrev = getText(row.teamAbbrev).toUpperCase();
    if (!abbrev) continue;
    conferenceByTeam.set(
      abbrev,
      toConference(getText(row.conferenceName) || getText(row.conferenceAbbrev))
    );
    const name =
      getText(row.placeName?.default) ||
      getText(row.teamName?.default) ||
      getText(row.teamCommonName?.default) ||
      abbrev;
    teamNameByAbbrev.set(abbrev, name.trim() || abbrev);
  }
  return { conferenceByTeam, teamNameByAbbrev };
}

/** Comma-separated tri-codes, e.g. "CBJ,NSH" → ["CBJ","NSH"] */
function parseExtraTeamsParam(raw) {
  if (!raw || typeof raw !== "string") return [];
  const out = [];
  for (const part of raw.split(",")) {
    const a = String(part).trim().toUpperCase();
    if (/^[A-Z]{2,4}$/.test(a)) out.push(a);
  }
  return [...new Set(out)];
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
      season,
    });
  }

  return out.filter((p) => p.nhl_id && p.name);
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const year = Number(
      searchParams.get("year") || String(CURRENT_POOL_PLAYOFF_YEAR),
    );
    const season = playoffYearToSeasonId(year);
    const extraAbbrevs = parseExtraTeamsParam(searchParams.get("extra_teams") || "");

    const bracket = await nhlFetch(`/playoff-bracket/${year}`);
    const { conferenceByTeam, teamNameByAbbrev } = await fetchStandingsTeamMaps({
      year,
    });

    const teamMap = new Map(extractPlayoffTeamsFromBracket(bracket));
    const teamsFromBracket = teamMap.size;
    let extraTeamsAdded = 0;
    for (const abbrev of extraAbbrevs) {
      if (!teamMap.has(abbrev)) {
        teamMap.set(abbrev, {
          abbrev,
          name: teamNameByAbbrev.get(abbrev) || abbrev,
        });
        extraTeamsAdded++;
      }
    }

    const teams = Array.from(teamMap.values());
    if (teams.length === 0) {
      return Response.json(
        { ok: false, error: "No teams found in playoff bracket response." },
        { status: 500 }
      );
    }

    const playerByNhlId = new Map();
    for (const team of teams) {
      const abbrevUpper = team.abbrev;
      const roster = await nhlFetch(`/roster/${abbrevUpper}/${season}`);
      const fromStandings = conferenceByTeam.get(abbrevUpper);
      const conference =
        conferenceForTeamAbbrev(abbrevUpper) ??
        (fromStandings === "East" || fromStandings === "West"
          ? fromStandings
          : "Unknown");

      const rows = rosterToPlayerRows({
        roster,
        teamAbbrev: abbrevUpper,
        teamName: team.name,
        season,
        conference,
      });
      for (const row of rows) {
        if (!playerByNhlId.has(row.nhl_id)) {
          playerByNhlId.set(row.nhl_id, row);
        }
      }
    }

    const supabase = createServerSupabaseClient();

    const { data: existingPlayers, error: existingError } = await supabase
      .from("players")
      .select("nhl_id,salary")
      .eq("season", season);

    if (existingError) {
      return Response.json(
        { ok: false, step: "select_existing_salaries", error: existingError.message },
        { status: 500 }
      );
    }

    const salaryByNhlId = new Map();
    for (const r of existingPlayers ?? []) {
      const id = Number(r.nhl_id);
      if (!Number.isFinite(id)) continue;
      salaryByNhlId.set(id, Number(r.salary) || 0);
    }

    const allPlayers = [...playerByNhlId.values()].map((row) => ({
      ...row,
      salary: salaryByNhlId.has(row.nhl_id)
        ? Number(salaryByNhlId.get(row.nhl_id)) || 0
        : 0,
    }));

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
      .select("id,nhl_id,name,team_abbrev,position,season,salary");

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

    let salariesNonZeroCarried = 0;
    let salariesAnyCarried = 0;
    for (const p of allPlayers) {
      if (!salaryByNhlId.has(p.nhl_id)) continue;
      salariesAnyCarried++;
      if ((Number(salaryByNhlId.get(p.nhl_id)) || 0) > 0) salariesNonZeroCarried++;
    }

    return Response.json({
      ok: true,
      year,
      season,
      teams: teams.length,
      teams_from_bracket: teamsFromBracket,
      extra_teams_query: extraAbbrevs.length,
      extra_teams_added: extraTeamsAdded,
      players: allPlayers.length,
      salaries_matched_prior_nhl_ids: salariesAnyCarried,
      salaries_preserved_nonzero: salariesNonZeroCarried,
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
