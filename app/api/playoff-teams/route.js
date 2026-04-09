import { playoffYearToSeasonId } from "@/lib/nhl/season";
import { fetchPlayoffTeamsMap } from "@/lib/nhl/playoff-bracket-teams";

export async function GET(req) {
  try {
    const year = Number(new URL(req.url).searchParams.get("year") || "");
    if (!Number.isFinite(year) || year < 2000) {
      return Response.json(
        { ok: false, error: "Missing or invalid year" },
        { status: 400 }
      );
    }
    const map = await fetchPlayoffTeamsMap(year);
    const teams = [...map.values()].sort((a, b) =>
      a.abbrev.localeCompare(b.abbrev)
    );
    return Response.json({
      ok: true,
      year,
      season: playoffYearToSeasonId(year),
      teams,
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
