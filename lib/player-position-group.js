/** Group NHL position letter into picker tabs (matches pick table). */
export function groupPosition(pos) {
  if (pos === "F") return "Forwards";
  if (pos === "D") return "Defence";
  if (pos === "G") return "Goalies";
  return "Other";
}
