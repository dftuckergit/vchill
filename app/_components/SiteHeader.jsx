import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function TeamsMenu({ teams }) {
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none select-none text-sm font-medium text-white/90 hover:text-white">
        Teams <span aria-hidden>▾</span>
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-xl bg-[#163a59] py-2 shadow-lg ring-1 ring-black/10">
        {teams.map((t) => (
          <Link
            key={t.slug}
            className="block px-4 py-1.5 text-sm font-semibold text-white/95 hover:bg-white/10"
            href={`/teams/${t.slug}`}
          >
            {t.name}
          </Link>
        ))}
      </div>
    </details>
  );
}

function MobileMenu({ teams }) {
  return (
    <details className="relative md:hidden">
      <summary
        aria-label="Open menu"
        className="cursor-pointer list-none select-none px-2 py-1 text-white/90 hover:text-white"
      >
        <span className="text-xl leading-none">≡</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl bg-[#163a59] py-2 shadow-lg ring-1 ring-black/10">
        <Link
          className="block px-4 py-2 text-sm font-semibold text-white/95 hover:bg-white/10"
          href="/standings"
        >
          Standings
        </Link>
        <Link
          className="block px-4 py-2 text-sm font-semibold text-white/95 hover:bg-white/10"
          href="/make-picks"
        >
          Make picks
        </Link>
        <div className="my-2 h-px bg-white/10" />
        {teams.map((t) => (
          <Link
            key={t.slug}
            className="block px-4 py-1.5 text-sm font-semibold text-white/95 hover:bg-white/10"
            href={`/teams/${t.slug}`}
          >
            {t.name}
          </Link>
        ))}
      </div>
    </details>
  );
}

export async function SiteHeader() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("participants")
    .select("name,slug")
    .order("name", { ascending: true });

  const teams =
    data?.filter((t) => t?.name && t?.slug).map((t) => ({ name: t.name, slug: t.slug })) ?? [];

  return (
    <header className="bg-[#193b5a]">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <Link className="text-sm font-semibold text-white" href="/">
            The V Chill Playoff Pool <span aria-hidden>🏒</span>
          </Link>
          <span className="text-xs text-white/70">
            powered by <span className="italic font-semibold">Searlenet</span>™
          </span>
        </div>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            className="text-sm font-medium text-white/90 hover:text-white"
            href="/standings"
          >
            Standings
          </Link>
          <Link
            className="text-sm font-medium text-white/90 hover:text-white"
            href="/make-picks"
          >
            Make picks
          </Link>
          <TeamsMenu teams={teams} />
        </nav>

        <MobileMenu teams={teams} />
      </div>
    </header>
  );
}

