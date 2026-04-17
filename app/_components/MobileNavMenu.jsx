"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function MobileNavMenu({ children, desktopNav }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const mobileLinkClass =
    "block py-2.5 text-base font-black text-white hover:underline";

  return (
    <div className="relative w-full">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-3 px-6 md:gap-4">
        <div className="min-w-0 flex-1">{children}</div>
        <div className="hidden min-w-0 flex-1 md:block" aria-hidden="true" />
        {desktopNav}
        <button
          type="button"
          className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/10 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav-dropdown"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? (
            <span className="relative block h-5 w-5 shrink-0" aria-hidden>
              <span className="absolute left-1/2 top-1/2 block h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-sm bg-white" />
              <span className="absolute left-1/2 top-1/2 block h-0.5 w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-sm bg-white" />
            </span>
          ) : (
            <span className="flex flex-col gap-[5px]" aria-hidden>
              <span className="h-0.5 w-6 rounded-sm bg-white" />
              <span className="h-0.5 w-6 rounded-sm bg-white" />
            </span>
          )}
        </button>
      </div>

      {open ? (
        <div
          id="mobile-nav-dropdown"
          className="absolute left-0 right-0 top-full z-50 w-full border-t border-white bg-[#193b5a] md:hidden"
          role="navigation"
          aria-label="Mobile"
        >
          <nav className="mx-auto w-full max-w-6xl px-6 py-8">
            <Link
              href="/make-picks"
              className={mobileLinkClass}
              onClick={() => setOpen(false)}
            >
              Make picks
            </Link>
            <Link
              href="/standings"
              className={mobileLinkClass}
              onClick={() => setOpen(false)}
            >
              Standings
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
