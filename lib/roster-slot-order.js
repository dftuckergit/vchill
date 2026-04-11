import { normalizePlayerConference } from "./nhl/team-conference.js";

/** Matches picks column order in app/picks/[pick_page_id]/ui.jsx (East, then West). */
const CONFERENCE_ORDER = ["East", "West"];
const GROUP_ORDER = ["Forwards", "Defence", "Goalies"];
const MAX_PER_GROUP = { Forwards: 3, Defence: 2, Goalies: 1 };

function positionToGroup(position) {
  const p = String(position || "").toUpperCase();
  if (p === "F") return "Forwards";
  if (p === "D") return "Defence";
  if (p === "G") return "Goalies";
  return null;
}

/** @returns {string[]} 12 labels: "East F" ×3, "East D" ×2, "East G", "West F" ×3, … */
export function rosterSlotLabelsPicksPageOrder() {
  const labels = [];
  for (const conf of CONFERENCE_ORDER) {
    for (let i = 0; i < 3; i++) labels.push(`${conf} F`);
    for (let i = 0; i < 2; i++) labels.push(`${conf} D`);
    labels.push(`${conf} G`);
  }
  return labels;
}

/**
 * Map submitted picks into fixed 12 slots (picks page order). Extra picks in a
 * bucket are dropped; missing slots are null.
 * @param {Array<{ conference?: string, team_abbrev?: string, position?: string, [k: string]: unknown }>} picks
 * @returns {(typeof picks[0] | null)[]}
 */
export function orderPicksIntoSlots(picks) {
  const buckets = {
    East: { Forwards: [], Defence: [], Goalies: [] },
    West: { Forwards: [], Defence: [], Goalies: [] },
  };

  for (const pick of picks ?? []) {
    const conf = normalizePlayerConference(pick.conference, pick.team_abbrev);
    const group = positionToGroup(pick.position);
    if (conf !== "East" && conf !== "West") continue;
    if (!group) continue;
    buckets[conf][group].push(pick);
  }

  const sortWithin = (arr) =>
    arr.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  for (const conf of CONFERENCE_ORDER) {
    for (const g of GROUP_ORDER) {
      sortWithin(buckets[conf][g]);
    }
  }

  const out = [];
  for (const conf of CONFERENCE_ORDER) {
    for (const g of GROUP_ORDER) {
      const max = MAX_PER_GROUP[g];
      const arr = buckets[conf][g];
      for (let i = 0; i < max; i++) {
        out.push(arr[i] ?? null);
      }
    }
  }
  return out;
}
