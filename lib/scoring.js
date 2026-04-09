function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function pointsFromStatRow(row) {
  if (!row) return 0;
  const goals = toNumber(row.goals);
  const assists = toNumber(row.assists);
  const wins = toNumber(row.goalie_wins ?? row.goalieWins ?? row.wins);
  const shutouts = toNumber(
    row.goalie_shutout ?? row.goalie_shutouts ?? row.shutouts
  );
  return goals + assists + wins * 2 + shutouts;
}

/** DB picks.round: pool rounds 1–3 only. Legacy 4 treated as pool 3 (R3+4). */
export function poolRoundFromPickRound(pickRound) {
  const r = Number(pickRound);
  if (r === 4) return 3;
  if ([1, 2, 3].includes(r)) return r;
  return null;
}

function basePointsForPoolRound(nhlId, poolRound, statsByNhlIdRound) {
  if (!nhlId) return 0;
  if (poolRound === 1) return pointsFromStatRow(statsByNhlIdRound.get(`${nhlId}:1`));
  if (poolRound === 2) return pointsFromStatRow(statsByNhlIdRound.get(`${nhlId}:2`));
  if (poolRound === 3) {
    return (
      pointsFromStatRow(statsByNhlIdRound.get(`${nhlId}:3`)) +
      pointsFromStatRow(statsByNhlIdRound.get(`${nhlId}:4`))
    );
  }
  return 0;
}

export function pickPointsFromStats({ pick, nhlId, statsByNhlIdRound }) {
  const poolR = poolRoundFromPickRound(pick.round);
  if (!poolR) return 0;
  let pts = basePointsForPoolRound(nhlId, poolR, statsByNhlIdRound);
  if (pick.is_star) pts *= 2;
  return pts;
}

export function computeStandingsRows({
  participants = [],
  season,
  picks = [],
  players = [],
  statsRows = [],
}) {
  const nhlIdByPlayerId = new Map((players ?? []).map((p) => [p.id, p.nhl_id]));

  const statsByNhlIdRound = new Map();
  for (const s of statsRows ?? []) {
    const nhlId = s?.nhl_id;
    const round = s?.round;
    if (!nhlId || ![1, 2, 3, 4].includes(round)) continue;
    statsByNhlIdRound.set(`${nhlId}:${round}`, s);
  }

  const totalsByParticipantId = new Map();
  for (const p of participants ?? []) {
    totalsByParticipantId.set(p.id, { r1: 0, r2: 0, r34: 0 });
  }

  for (const pick of picks ?? []) {
    const participantId = pick?.participant_id;
    if (!totalsByParticipantId.has(participantId)) continue;

    const nhlId = nhlIdByPlayerId.get(pick.player_id);
    if (!nhlId) continue;

    const poolR = poolRoundFromPickRound(pick.round);
    if (!poolR) continue;

    const pts = pickPointsFromStats({ pick, nhlId, statsByNhlIdRound });
    const cur = totalsByParticipantId.get(participantId);
    if (poolR === 1) cur.r1 += pts;
    else if (poolR === 2) cur.r2 += pts;
    else cur.r34 += pts;
  }

  const rows = (participants ?? []).map((p) => {
    const cur = totalsByParticipantId.get(p.id) ?? { r1: 0, r2: 0, r34: 0 };
    const total = cur.r1 + cur.r2 + cur.r34;
    return {
      participant_id: p.id,
      name: p.name,
      slug: p.slug,
      season,
      r1: cur.r1,
      r2: cur.r2,
      r34: cur.r34,
      total,
    };
  });

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });

  return rows;
}

export function computeParticipantSummary({
  participant,
  season,
  picks = [],
  players = [],
  statsRows = [],
}) {
  const playersById = new Map((players ?? []).map((p) => [p.id, p]));

  const statsByNhlIdRound = new Map();
  for (const s of statsRows ?? []) {
    const nhlId = s?.nhl_id;
    const round = s?.round;
    if (!nhlId || ![1, 2, 3, 4].includes(round)) continue;
    statsByNhlIdRound.set(`${nhlId}:${round}`, s);
  }

  const rounds = {
    1: { picks: [], total: 0 },
    2: { picks: [], total: 0 },
    3: { picks: [], total: 0 },
  };

  for (const pick of picks ?? []) {
    const pl = playersById.get(pick.player_id);
    if (!pl?.nhl_id) continue;

    const poolR = poolRoundFromPickRound(pick.round);
    if (!poolR) continue;

    const pts = pickPointsFromStats({ pick, nhlId: pl.nhl_id, statsByNhlIdRound });

    rounds[poolR].picks.push({
      player_id: pick.player_id,
      nhl_id: pl.nhl_id,
      name: pl.name,
      team_abbrev: pl.team_abbrev,
      position: pl.position,
      conference: pl.conference,
      is_star: !!pick.is_star,
      points: pts,
      pool_round: poolR,
    });
    rounds[poolR].total += pts;
  }

  for (const r of [1, 2, 3]) {
    rounds[r].picks.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  const r34 = rounds[3].total;
  const total = rounds[1].total + rounds[2].total + r34;

  return {
    participant,
    season,
    rounds,
    totals: {
      r1: rounds[1].total,
      r2: rounds[2].total,
      r34,
      total,
    },
  };
}
