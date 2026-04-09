import { nhlFetch } from "@/lib/nhl/api";
import { normalizeEligibleTeamsArray } from "@/lib/pool-settings";

function getText(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "object" && typeof v.default === "string") return v.default;
  return "";
}

/**
 * Teams that appear in the NHL playoff bracket payload (typically 16 for a full field).
 * @returns {Map<string, { abbrev: string, name: string }>}
 */
export function extractPlayoffTeamsFromBracket(bracket) {
  const teamMap = new Map();
  for (const s of bracket?.series ?? []) {
    for (const t of [s.topSeedTeam, s.bottomSeedTeam]) {
      if (!t?.abbrev) continue;
      const abbrevUpper = String(t.abbrev).toUpperCase();
      teamMap.set(abbrevUpper, {
        abbrev: abbrevUpper,
        name: getText(t.commonName) || getText(t.name) || abbrevUpper,
      });
    }
  }
  return teamMap;
}

export async function fetchPlayoffTeamsMap(playoffYear) {
  const y = Number(playoffYear);
  if (!Number.isFinite(y) || y < 2000) {
    throw new Error(`Invalid playoff year: ${playoffYear}`);
  }
  const bracket = await nhlFetch(`/playoff-bracket/${y}`);
  return extractPlayoffTeamsFromBracket(bracket);
}

/**
 * Keep only tri-codes that appear in that season’s playoff bracket.
 * @param {unknown} arr
 * @param {Set<string>} playoffAbbrevSet uppercase abbrevs
 * @returns {{ value: string[] | null, removed: string[] }}
 */
export function restrictEligibleTeamsToPlayoffAbbrevs(arr, playoffAbbrevSet) {
  if (arr == null || !Array.isArray(arr)) {
    return { value: null, removed: [] };
  }
  const normalized = normalizeEligibleTeamsArray(arr);
  if (!normalized) {
    return { value: null, removed: [] };
  }
  const kept = normalized.filter((a) => playoffAbbrevSet.has(a));
  const removed = normalized.filter((a) => !playoffAbbrevSet.has(a));
  return {
    value: kept.length > 0 ? kept : null,
    removed,
  };
}
