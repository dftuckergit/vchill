"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const CLOSE_DELAY_MS = 120;

export function TeamsMenuClient({ teams }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef(null);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimer.current = window.setTimeout(() => {
      setOpen(false);
      closeTimer.current = null;
    }, CLOSE_DELAY_MS);
  }, [cancelScheduledClose]);

  const handleEnter = useCallback(() => {
    cancelScheduledClose();
    setOpen(true);
  }, [cancelScheduledClose]);

  useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose]);

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-sm font-black text-white/90 hover:text-white hover:underline"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
      >
        Teams
        <svg
          aria-hidden
          className={`h-3.5 w-3.5 shrink-0 text-white/90 transition-transform duration-200 ease-out ${
            open ? "rotate-90" : ""
          }`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 7.5 10 12.5 15 7.5" fill="none" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 pt-2">
          <div className="min-w-[14rem] overflow-hidden rounded-lg bg-[#163a59] py-1.5 shadow-md ring-1 ring-black/10">
            {teams.map((t) => (
              <Link
                key={t.slug}
                className="block px-4 py-2 text-sm font-black text-white/95 hover:bg-white/10"
                href={`/teams/${t.slug}`}
              >
                {t.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
