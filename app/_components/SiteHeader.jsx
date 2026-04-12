import Link from "next/link";

function MobileMenu() {
  return (
    <details className="relative md:hidden">
      <summary
        aria-label="Open menu"
        className="cursor-pointer list-none select-none px-2 py-1 text-white/90 hover:text-white hover:underline"
      >
        <span className="text-xl leading-none">≡</span>
      </summary>
      <div className="absolute right-0 z-20 mt-1.5 w-64 overflow-hidden rounded-lg bg-[#163a59] py-1.5 shadow-md ring-1 ring-black/10">
        <Link
          className="block px-4 py-2 text-sm font-black text-white/95 hover:bg-white/10 hover:underline"
          href="/make-picks"
        >
          Make picks
        </Link>
        <Link
          className="block px-4 py-2 text-sm font-black text-white/95 hover:bg-white/10 hover:underline"
          href="/standings"
        >
          Standings
        </Link>
      </div>
    </details>
  );
}

export async function SiteHeader() {
  return (
    <header className="bg-[#193b5a]">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-4 px-6">
        <Link
          className="shrink-0 text-sm font-black text-white hover:underline"
          href="/"
        >
          The V Chill Playoff Pool <span aria-hidden>🤙</span>
        </Link>

        <div className="min-w-0 flex-1" aria-hidden="true" />

        <div className="flex shrink-0 items-center gap-6">
          <nav className="hidden items-center gap-6 md:flex">
            <Link
              className="text-sm font-black text-white/90 hover:text-white hover:underline"
              href="/make-picks"
            >
              Make picks
            </Link>
            <Link
              className="text-sm font-black text-white/90 hover:text-white hover:underline"
              href="/standings"
            >
              Standings
            </Link>
          </nav>

          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
