export function normalizeEligibleTeamsArray(v) {
  if (v == null) return null;
  if (!Array.isArray(v)) return null;
  const out = [
    ...new Set(v.map((x) => String(x).trim().toUpperCase()).filter(Boolean)),
  ];
  return out.length > 0 ? out : null;
}

export function defaultPoolSettings(season) {
  return {
    season: season ?? null,
    current_round: 1,
    deadline_r1: null,
    deadline_r2: null,
    deadline_r3: null,
    eligible_teams_r1: null,
    eligible_teams_r2: null,
    eligible_teams_r3: null,
    updated_at: null,
  };
}

export function normalizePoolSettingsRow(row) {
  if (!row) return defaultPoolSettings(null);
  let cr = Number(row.current_round);
  if (![1, 2, 3].includes(cr)) cr = 1;
  return {
    season: row.season,
    current_round: cr,
    deadline_r1: row.deadline_r1 ?? null,
    deadline_r2: row.deadline_r2 ?? null,
    deadline_r3: row.deadline_r3 ?? null,
    eligible_teams_r1: normalizeEligibleTeamsArray(row.eligible_teams_r1),
    eligible_teams_r2: normalizeEligibleTeamsArray(row.eligible_teams_r2),
    eligible_teams_r3: normalizeEligibleTeamsArray(row.eligible_teams_r3),
    updated_at: row.updated_at ?? null,
  };
}

export async function fetchPoolSettings(supabase, season) {
  const key =
    season != null && String(season).trim() !== "" ? String(season) : null;
  if (!key) return defaultPoolSettings(null);
  const { data, error } = await supabase
    .from("pool_settings")
    .select("*")
    .eq("season", key)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...defaultPoolSettings(key), season: key };
  return normalizePoolSettingsRow(data);
}

export function deadlineForPoolRound(settings, poolRound) {
  if (poolRound === 1) return settings.deadline_r1;
  if (poolRound === 2) return settings.deadline_r2;
  if (poolRound === 3) return settings.deadline_r3;
  return null;
}

export function isDeadlinePassed(iso) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && Date.now() > t;
}

export function isSubmissionsLockedForRound(settings, poolRound) {
  return isDeadlinePassed(deadlineForPoolRound(settings, poolRound));
}

/** Public team page: show submitted rosters only after that pool round’s deadline (if set). */
export function arePicksVisibleAfterDeadline(settings, poolRound) {
  const d = deadlineForPoolRound(settings, poolRound);
  if (!d) return true;
  return isDeadlinePassed(d);
}
