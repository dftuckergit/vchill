import Link from "next/link";
import MobileNavMenu from "./MobileNavMenu";

export function SiteHeader() {
  return (
    <header className="relative z-40 bg-[#193b5a]">
      <MobileNavMenu
        desktopNav={
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
        }
      >
        <Link
          className="shrink-0 text-[20px] font-black leading-tight text-white hover:underline"
          href="/"
        >
          The V Chill Playoff Pool <span aria-hidden>🤙</span>
        </Link>
      </MobileNavMenu>
    </header>
  );
}
