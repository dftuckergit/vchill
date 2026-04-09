/**
 * NHL club tri-code → "East" | "West" (current alignment).
 * Used when standings-based conference lookup fails so picks UI still gets East/West buckets.
 */

export const TEAM_CONFERENCE = {
  // Eastern — Atlantic
  BOS: "East",
  BUF: "East",
  DET: "East",
  FLA: "East",
  MTL: "East",
  OTT: "East",
  TBL: "East",
  TOR: "East",
  // Eastern — Metropolitan
  CAR: "East",
  CBJ: "East",
  NJD: "East",
  NYI: "East",
  NYR: "East",
  PHI: "East",
  PIT: "East",
  WSH: "East",
  // Western — Central
  CHI: "West",
  COL: "West",
  DAL: "West",
  MIN: "West",
  NSH: "West",
  STL: "West",
  WPG: "West",
  // Western — Pacific
  ANA: "West",
  CGY: "West",
  EDM: "West",
  LAK: "West",
  SJS: "West",
  SEA: "West",
  VAN: "West",
  VGK: "West",
  UTA: "West",
};

/** @returns {"East" | "West" | null} */
export function conferenceForTeamAbbrev(abbrev) {
  const k = String(abbrev || "").trim().toUpperCase();
  return TEAM_CONFERENCE[k] ?? null;
}

/**
 * @returns {"East" | "West" | "Unknown"}
 * Prefer tri-code map over DB `conference` so bad sync/standings data cannot
 * mislabel East teams as West (or vice versa).
 */
export function normalizePlayerConference(conference, teamAbbrev) {
  const fromAbbrev = conferenceForTeamAbbrev(teamAbbrev);
  if (fromAbbrev) return fromAbbrev;
  if (conference === "East" || conference === "West") return conference;
  return "Unknown";
}
