export function normalizeEligibleTeamsArray(v) {
  if (v == null) return null;
  if (!Array.isArray(v)) return null;
  const out = [
    ...new Set(v.map((x) => String(x).trim().toUpperCase()).filter(Boolean)),
  ];
  return out.length > 0 ? out : null;
}

function clampStatsSyncLimit(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 8;
  return Math.max(1, Math.min(100, Math.round(n)));
}

function clampStatsSyncConcurrency(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(10, Math.round(n)));
}

export function defaultPoolSettings(season) {
  return {
    season: season ?? null,
    current_round: 1,
    deadline_r1: null,
    deadline_r2: null,
    deadline_r3: null,
    payment_deadline_at: null,
    eligible_teams_r1: null,
    eligible_teams_r2: null,
    eligible_teams_r3: null,
    stats_sync_limit: 8,
    stats_sync_concurrency: 1,
    stats_last_sync_started_at: null,
    stats_last_sync_completed_at: null,
    stats_last_sync_total_players: null,
    stats_last_sync_processed_players: null,
    stats_last_sync_ok: null,
    stats_last_sync_error: null,
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
    payment_deadline_at: row.payment_deadline_at ?? null,
    eligible_teams_r1: normalizeEligibleTeamsArray(row.eligible_teams_r1),
    eligible_teams_r2: normalizeEligibleTeamsArray(row.eligible_teams_r2),
    eligible_teams_r3: normalizeEligibleTeamsArray(row.eligible_teams_r3),
    stats_sync_limit: clampStatsSyncLimit(
      row.stats_sync_limit != null ? row.stats_sync_limit : 8
    ),
    stats_sync_concurrency: clampStatsSyncConcurrency(
      row.stats_sync_concurrency != null ? row.stats_sync_concurrency : 1
    ),
    stats_last_sync_started_at: row.stats_last_sync_started_at ?? null,
    stats_last_sync_completed_at: row.stats_last_sync_completed_at ?? null,
    stats_last_sync_total_players:
      row.stats_last_sync_total_players != null
        ? Number(row.stats_last_sync_total_players)
        : null,
    stats_last_sync_processed_players:
      row.stats_last_sync_processed_players != null
        ? Number(row.stats_last_sync_processed_players)
        : null,
    stats_last_sync_ok:
      row.stats_last_sync_ok != null ? Boolean(row.stats_last_sync_ok) : null,
    stats_last_sync_error: row.stats_last_sync_error ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/** Merge stats sync defaults from PUT body; omitted keys keep existing values. */
export function mergeStatsSyncFromPut(body, existing) {
  const limit =
    body != null && Object.prototype.hasOwnProperty.call(body, "stats_sync_limit")
      ? clampStatsSyncLimit(body.stats_sync_limit)
      : clampStatsSyncLimit(existing.stats_sync_limit);
  const concurrency =
    body != null &&
    Object.prototype.hasOwnProperty.call(body, "stats_sync_concurrency")
      ? clampStatsSyncConcurrency(body.stats_sync_concurrency)
      : clampStatsSyncConcurrency(existing.stats_sync_concurrency);
  return { stats_sync_limit: limit, stats_sync_concurrency: concurrency };
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

/**
 * Standings / analysis / public scores for a pool round: every **prior** pool round must
 * have a **configured** deadline that has **passed**; this round must have a configured
 * deadline that has passed. A missing deadline counts as **not** public (and blocks
 * later rounds until earlier rounds are configured and closed).
 */
export function isRoundResultsPublic(settings, poolRound) {
  if (!settings) return true;
  if (![1, 2, 3].includes(poolRound)) return false;

  for (let r = 1; r < poolRound; r++) {
    const prev = deadlineForPoolRound(settings, r);
    if (!prev) return false;
    if (!isDeadlinePassed(prev)) return false;
  }

  const d = deadlineForPoolRound(settings, poolRound);
  if (!d) return false;
  return isDeadlinePassed(d);
}
