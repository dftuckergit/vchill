import { playoffYearToSeasonId } from "./nhl/season";

/** Single source for this deployment’s playoff year (admin, home copy, sync URLs). */
export const CURRENT_POOL_PLAYOFF_YEAR = 2026;

export function currentPoolSeasonId() {
  return playoffYearToSeasonId(CURRENT_POOL_PLAYOFF_YEAR);
}
