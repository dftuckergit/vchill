/**
 * Primary brand hex for NHL tri-codes (picker / team page abbrev color).
 * Fallback: callers use default text color when missing.
 */
export const TEAM_PRIMARY_HEX = {
  ANA: "#B9976B",
  BOS: "#000000",
  BUF: "#003087",
  CAR: "#000000",
  CBJ: "#002654",
  CGY: "#C8102E",
  CHI: "#CF0A2C",
  COL: "#6F263D",
  DAL: "#00843D",
  DET: "#CE1126",
  EDM: "#FF4C00",
  FLA: "#C8102E",
  LAK: "#A2AAAD",
  MIN: "#154734",
  MTL: "#AF1E2D",
  NJD: "#CE1126",
  NSH: "#FFB81C",
  NYI: "#00539B",
  NYR: "#0038A8",
  OTT: "#E31837",
  PHI: "#F74902",
  PIT: "#000000",
  SEA: "#001628",
  SJS: "#006D75",
  STL: "#002F87",
  TBL: "#002868",
  TOR: "#00205B",
  UTA: "#6CACE4",
  VAN: "#00205B",
  VGK: "#B4975A",
  WPG: "#041E41",
  WSH: "#C8102E",
};

export function teamPrimaryHex(abbrev) {
  if (!abbrev) return null;
  return TEAM_PRIMARY_HEX[String(abbrev).toUpperCase()] ?? null;
}
