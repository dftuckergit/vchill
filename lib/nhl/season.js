export function playoffYearToSeasonId(playoffYear) {
  const y = Number(playoffYear);
  if (!Number.isFinite(y) || y < 1900) {
    throw new Error(`Invalid playoff year: ${playoffYear}`);
  }
  // NHL season id convention used by the NHL API:
  // 2025 playoffs correspond to season "20242025".
  return `${y - 1}${y}`;
}

/** Inverse of {@link playoffYearToSeasonId} (8-digit season string → playoff calendar year). */
export function seasonIdToPlayoffYear(seasonId) {
  const s = String(seasonId ?? "").trim();
  if (!/^\d{8}$/.test(s)) {
    throw new Error(`Invalid season id: ${seasonId}`);
  }
  const y = Number(s.slice(4, 8));
  if (!Number.isFinite(y) || y < 1900) {
    throw new Error(`Invalid season id: ${seasonId}`);
  }
  return y;
}

