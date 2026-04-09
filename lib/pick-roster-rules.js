/** Single source for pool roster rules (mirrors picks UI). */

export const PICK_SALARY_CAP = 30;

const SLOTS_PER_CONFERENCE = {
  Forwards: 3,
  Defence: 2,
  Goalies: 1,
};

export function positionToStarGroup(position) {
  if (position === "F") return "Forwards";
  if (position === "D") return "Defence";
  if (position === "G") return "Goalies";
  return null;
}

/**
 * @param {object} params
 * @param {number[]} params.nhlIds - exactly 12 NHL ids submitted
 * @param {Record<string, number>} params.stars - Forwards / Defence / Goalies → nhl_id
 * @param {Map<number, { nhl_id: number, position: string, conference: string, salary?: number }>} params.playersByNhlId
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validatePickRosterAndStars({ nhlIds, stars, playersByNhlId }) {
  if (new Set(nhlIds).size !== nhlIds.length) {
    return {
      ok: false,
      error: "Roster cannot include the same player twice.",
    };
  }

  const counts = {
    East: { Forwards: 0, Defence: 0, Goalies: 0 },
    West: { Forwards: 0, Defence: 0, Goalies: 0 },
  };

  let totalSalary = 0;

  for (const id of nhlIds) {
    const p = playersByNhlId.get(id);
    if (!p) {
      return { ok: false, error: "Some NHL IDs were not found in Supabase players table." };
    }
    const conf = p.conference;
    if (conf !== "East" && conf !== "West") {
      return {
        ok: false,
        error: "Roster includes a player that is not in the East or West conference.",
      };
    }
    const group = positionToStarGroup(p.position);
    if (!group) {
      return {
        ok: false,
        error: "Roster includes a player with an invalid position.",
      };
    }
    counts[conf][group]++;
    totalSalary += Number(p.salary || 0);
  }

  for (const conf of ["East", "West"]) {
    for (const group of ["Forwards", "Defence", "Goalies"]) {
      const need = SLOTS_PER_CONFERENCE[group];
      if (counts[conf][group] !== need) {
        const label =
          group === "Forwards"
            ? "forwards"
            : group === "Defence"
              ? "defencemen"
              : "goalies";
        return {
          ok: false,
          error: `Roster must have exactly ${need} ${label} from the ${conf} (${counts[conf][group]} submitted).`,
        };
      }
    }
  }

  if (totalSalary > PICK_SALARY_CAP) {
    return {
      ok: false,
      error: `Roster is over the $${PICK_SALARY_CAP} salary cap.`,
    };
  }

  const starKeys = ["Forwards", "Defence", "Goalies"];
  const resolvedStars = [];
  for (const key of starKeys) {
    const sid = Number(stars[key]);
    if (!Number.isFinite(sid)) {
      return {
        ok: false,
        error: "Must pick exactly 3 stars (Forwards/Defence/Goalies).",
      };
    }
    resolvedStars.push(sid);
  }

  if (new Set(resolvedStars).size !== 3) {
    return {
      ok: false,
      error: "Stars must be three distinct players (one forward, one defenceman, one goalie).",
    };
  }

  for (const key of starKeys) {
    const sid = Number(stars[key]);
    if (!nhlIds.includes(sid)) {
      return {
        ok: false,
        error: "Each star must be a player on your roster.",
      };
    }
    const p = playersByNhlId.get(sid);
    const g = positionToStarGroup(p.position);
    if (g !== key) {
      return {
        ok: false,
        error:
          key === "Forwards"
            ? "Star for forwards must be a forward."
            : key === "Defence"
              ? "Star for defence must be a defenceman."
              : "Star for goalies must be a goalie.",
      };
    }
  }

  return { ok: true };
}
