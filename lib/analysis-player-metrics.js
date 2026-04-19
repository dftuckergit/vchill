/**
 * Playoff stats → per-player R1–R4 totals (same formula as picks page / standings).
 */
export function aggregateStatsByNhlId(statsRows) {
  const statsByPlayer = new Map();
  for (const row of statsRows ?? []) {
    const nhlId = row.nhl_id;
    if (!nhlId) continue;
    const cur =
      statsByPlayer.get(nhlId) ?? { r1: 0, r2: 0, r3: 0, r4: 0, total: 0 };

    const wins =
      Number(row.goalie_wins ?? row.goalieWins ?? row.wins ?? 0) || 0;
    const shutouts =
      Number(row.goalie_shutout ?? row.goalie_shutouts ?? row.shutouts ?? 0) ||
      0;
    const goals = Number(row.goals ?? 0) || 0;
    const assists = Number(row.assists ?? 0) || 0;

    const points = goals + assists + wins * 2 + shutouts * 1;

    if (row.round === 1) cur.r1 += points;
    if (row.round === 2) cur.r2 += points;
    if (row.round === 3) cur.r3 += points;
    if (row.round === 4) cur.r4 += points;
    cur.total += points;

    statsByPlayer.set(nhlId, cur);
  }
  return statsByPlayer;
}

/** Fantasy points from stats for a pool round (R3+4 = NHL 3+4). */
export function poolRoundStatPoints(statsSlice, poolRound) {
  if (!statsSlice) return 0;
  if (poolRound === 1) return Number(statsSlice.r1 ?? 0) || 0;
  if (poolRound === 2) return Number(statsSlice.r2 ?? 0) || 0;
  if (poolRound === 3) {
    return (
      (Number(statsSlice.r3 ?? 0) || 0) + (Number(statsSlice.r4 ?? 0) || 0)
    );
  }
  return 0;
}

/**
 * Picks that count for a pool round (mirrors saved-picks logic for round 3 vs legacy 4).
 */
export function effectivePicksForPoolRound(picks, poolRound) {
  if (poolRound === 1) {
    return (picks ?? []).filter((p) => Number(p.round) === 1);
  }
  if (poolRound === 2) {
    return (picks ?? []).filter((p) => Number(p.round) === 2);
  }
  if (poolRound !== 3) return [];

  const byParticipant = new Map();
  for (const p of picks ?? []) {
    const r = Number(p.round);
    if (r !== 3 && r !== 4) continue;
    const pid = p.participant_id;
    if (pid == null) continue;
    if (!byParticipant.has(pid)) byParticipant.set(pid, []);
    byParticipant.get(pid).push(p);
  }

  const out = [];
  for (const [, list] of byParticipant) {
    const hasR3 = list.some((x) => Number(x.round) === 3);
    out.push(
      ...(hasR3
        ? list.filter((x) => Number(x.round) === 3)
        : list.filter((x) => Number(x.round) === 4)),
    );
  }
  return out;
}

/**
 * @returns {Map<string, { pickCount: number, pickers: { participant_id, name, slug, is_star }[] }>}
 * keyed by players.id
 */
export function buildRoundPickIndex(picks, poolRound, participantsById) {
  const effective = effectivePicksForPoolRound(picks, poolRound);
  const byPlayer = new Map();
  for (const pick of effective) {
    const plId = pick.player_id;
    if (!plId) continue;
    if (!byPlayer.has(plId)) byPlayer.set(plId, []);
    byPlayer.get(plId).push(pick);
  }

  const result = new Map();
  for (const [playerId, list] of byPlayer) {
    const seen = new Set();
    const pickers = [];
    for (const pick of list) {
      const partId = pick.participant_id;
      if (partId == null || seen.has(partId)) continue;
      seen.add(partId);
      const pt = participantsById.get(partId);
      pickers.push({
        participant_id: partId,
        name: pt?.name ?? "Unknown",
        slug: pt?.slug ?? "",
        is_star: Boolean(pick.is_star),
      });
    }
    pickers.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    result.set(playerId, { pickCount: pickers.length, pickers });
  }
  return result;
}

export function eligibleAbbrevsToJson(set) {
  if (!set || set.size === 0) return null;
  return [...set].map((a) => String(a).toUpperCase()).sort();
}

/**
 * `players.id` values that exactly one distinct participant picked in this pool
 * round (same effective-pick rules as Analysis / standings).
 * @returns {string[]}
 */
export function playerIdsWithSoloPickInRound(picks, poolRound) {
  const effective = effectivePicksForPoolRound(picks, poolRound);
  const byPlayer = new Map();
  for (const p of effective) {
    const plId = p.player_id;
    if (!plId) continue;
    const sid = p.participant_id;
    if (sid == null) continue;
    const set = byPlayer.get(plId) ?? new Set();
    set.add(sid);
    byPlayer.set(plId, set);
  }
  const out = [];
  for (const [playerId, set] of byPlayer) {
    if (set.size === 1) out.push(String(playerId));
  }
  return out;
}
