"use client";

import { useMemo } from "react";
import { formatViewerLocalDateTimeWithZone } from "@/lib/deadline-timezone";

/** UTC ISO from `stats.created_at`; formats in the visitor’s local timezone after hydration. */
export function StandingsLastUpdated({ iso }) {
  const text = useMemo(() => {
    if (!iso) return "";
    if (typeof window === "undefined") return "";
    return formatViewerLocalDateTimeWithZone(iso);
  }, [iso]);

  return (
    <p className="mt-6 text-center text-xs text-zinc-400">
      Last updated:{" "}
      {iso ? (
        <span suppressHydrationWarning className="text-zinc-600 tabular-nums">
          {text || "\u00A0"}
        </span>
      ) : (
        <span className="text-zinc-500">—</span>
      )}
    </p>
  );
}
