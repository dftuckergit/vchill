"use client";

import { useMemo } from "react";
import { formatPaymentDeadlineViewerLocal } from "@/lib/deadline-timezone";

/**
 * Renders pay-by in the visitor’s local timezone (admin stores UTC; Eastern in admin UI).
 * Empty on the server; formats on the client (suppressHydrationWarning avoids a mismatch).
 */
export function HomePaymentDeadline({ iso }) {
  const text = useMemo(() => {
    if (!iso) return "";
    if (typeof window === "undefined") return "";
    return formatPaymentDeadlineViewerLocal(iso);
  }, [iso]);

  if (!iso) return null;

  return (
    <>
      {" "}
      by{" "}
      <strong
        suppressHydrationWarning
        className="font-semibold text-[#163a59]"
      >
        {text || "\u00A0"}
      </strong>
    </>
  );
}
