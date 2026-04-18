"use client";

import { useEffect, useState } from "react";
import { formatViewerLocalDateTimeWithZone } from "@/lib/deadline-timezone";

function formatRefreshedAt(iso) {
  if (!iso) return "";
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const long = formatViewerLocalDateTimeWithZone(iso);
  if (long) return long;
  return new Date(ms).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** UTC ISO from server at request time; formatted in the visitor’s local timezone after mount. */
export function StatusLastRefreshed({ iso }) {
  const [text, setText] = useState("");

  useEffect(() => {
    setText(formatRefreshedAt(iso));
  }, [iso]);

  return (
    <p className="mt-6 text-center text-xs text-zinc-400">
      Last refreshed:{" "}
      <span suppressHydrationWarning className="text-zinc-600 tabular-nums">
        {text || (iso ? "…" : "—")}
      </span>
    </p>
  );
}
