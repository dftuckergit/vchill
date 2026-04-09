/**
 * Pool deadlines are edited in US Eastern Time (America/New_York — EST/EDT).
 * Stored values are UTC ISO strings (timestamptz) everywhere else.
 */

export const DEADLINE_ADMIN_TIMEZONE = "America/New_York";

function zonedCivilParts(utcMs, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(new Date(utcMs));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    y: Number(get("year")),
    mo: Number(get("month")),
    d: Number(get("day")),
    h: Number(get("hour")),
    mi: Number(get("minute")),
  };
}

function civilEqual(a, b) {
  return (
    a.y === b.y &&
    a.mo === b.mo &&
    a.d === b.d &&
    a.h === b.h &&
    a.mi === b.mi
  );
}

const pad2 = (n) => String(n).padStart(2, "0");

/** UTC ISO from DB → `YYYY-MM-DDTHH:mm` for <input type="datetime-local"> (Eastern wall time). */
export function utcIsoToEasternDatetimeLocalInput(iso, timeZone = DEADLINE_ADMIN_TIMEZONE) {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const p = zonedCivilParts(ms, timeZone);
  return `${p.y}-${pad2(p.mo)}-${pad2(p.d)}T${pad2(p.h)}:${pad2(p.mi)}`;
}

/**
 * Value from <input type="datetime-local"> interpreted as Eastern wall time → UTC ISO for API/DB.
 * Scans a window around the calendar day to handle DST (and picks the first match on ambiguous fold).
 */
export function easternDatetimeLocalInputToUtcIso(
  localStr,
  timeZone = DEADLINE_ADMIN_TIMEZONE
) {
  if (!localStr) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localStr.trim());
  if (!m) return null;
  const target = {
    y: Number(m[1]),
    mo: Number(m[2]),
    d: Number(m[3]),
    h: Number(m[4]),
    mi: Number(m[5]),
  };
  if (![target.y, target.mo, target.d, target.h, target.mi].every(Number.isFinite)) {
    return null;
  }

  const dayStart = Date.UTC(target.y, target.mo - 1, target.d, 0, 0, 0);
  const scanStart = dayStart - 12 * 60 * 60 * 1000;
  const scanEnd = dayStart + 36 * 60 * 60 * 1000;
  const step = 60 * 1000;

  for (let ms = scanStart; ms <= scanEnd; ms += step) {
    if (civilEqual(zonedCivilParts(ms, timeZone), target)) {
      return new Date(ms).toISOString();
    }
  }
  return null;
}
