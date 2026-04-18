/** Must match `POST /api/picks/submit` (12 roster slots per pool round). */
const REQUIRED_PICKS_PER_ROUND = 12;

/**
 * Count pick rows for one participant / season in a pool round bucket.
 * Pool round 3 includes legacy DB `round` 4 (R3+4 window).
 *
 * @param {Array<{ participant_id?: unknown, season?: unknown, round?: unknown }>} picks
 * @param {string|number} participantId
 * @param {string|null|undefined} season
 * @param {1|2|3} poolRound
 */
export function countPicksForPoolRound(picks, participantId, season, poolRound) {
  const sid = season != null && season !== "" ? String(season) : "";
  const pid = participantId;
  if (!sid) return 0;

  let n = 0;
  for (const p of picks ?? []) {
    if (p.participant_id !== pid) continue;
    if (String(p.season ?? "") !== sid) continue;
    const r = Number(p.round);
    if (poolRound === 1 && r === 1) n++;
    else if (poolRound === 2 && r === 2) n++;
    else if (poolRound === 3 && (r === 3 || r === 4)) n++;
  }
  return n;
}

/**
 * @param {number} count
 * @returns {"submitted" | "none"}
 */
export function pickSubmissionLabel(count) {
  return count >= REQUIRED_PICKS_PER_ROUND ? "submitted" : "none";
}
