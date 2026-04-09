import { fetchPoolSettings } from "@/lib/pool-settings";

/**
 * Pick list restriction from `pool_settings.eligible_teams_r{1,2,3}`.
 * Returns `null` when unset or empty → show all synced playoff players.
 */

export async function getEligibleTeamAbbrevsForPickList(supabase, season, poolRound) {
  if (!season || ![1, 2, 3].includes(poolRound)) return null;

  const settings = await fetchPoolSettings(supabase, season);
  const key =
    poolRound === 1
      ? "eligible_teams_r1"
      : poolRound === 2
        ? "eligible_teams_r2"
        : "eligible_teams_r3";
  const arr = settings[key];
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return new Set(arr);
}

export function filterPlayersByTeamAbbrevs(players, eligibleAbbrevs) {
  if (!eligibleAbbrevs || eligibleAbbrevs.size === 0) return players ?? [];
  return (players ?? []).filter((p) =>
    eligibleAbbrevs.has(String(p.team_abbrev || "").toUpperCase())
  );
}
