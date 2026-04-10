export const metadata = {
  title: "Standings | V Chill Pool",
};

import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeStandingsRows } from "@/lib/scoring";

export default async function StandingsPage() {
  const supabase = createServerSupabaseClient();
  const { data: participants } = await supabase
    .from("participants")
    .select("id,name,slug")
    .order("name", { ascending: true });

  const { data: seasonRows } = await supabase
    .from("players")
    .select("season")
    .order("season", { ascending: false })
    .limit(1);

  const seasonRaw = seasonRows?.[0]?.season ?? null;
  const season =
    seasonRaw != null && seasonRaw !== "" ? String(seasonRaw) : null;

  const [{ data: players }, { data: statsRows }, { data: picks }] = season
    ? await Promise.all([
        supabase.from("players").select("id,nhl_id").eq("season", season),
        supabase.from("stats").select("*").eq("season", season),
        supabase
          .from("picks")
          .select("participant_id,player_id,round,is_star")
          .eq("season", season),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const rows = computeStandingsRows({
    participants: participants ?? [],
    season,
    picks: picks ?? [],
    players: players ?? [],
    statsRows: statsRows ?? [],
  });

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <h1 className="font-display text-center text-[32px] leading-[1.0] font-bold text-[#163a59]">
          Team Standings
        </h1>

        <div className="mt-10 overflow-x-auto rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-zinc-900">
                <th className="px-2 py-2.5 text-left text-xs font-bold">Team</th>
                <th className="px-2 py-2.5 text-right text-xs font-bold">R1</th>
                <th className="px-2 py-2.5 text-right text-xs font-bold">R2</th>
                <th className="px-2 py-2.5 text-right text-xs font-bold">R3+4</th>
                <th className="px-2 py-2.5 text-right text-xs font-bold">Total</th>
              </tr>
            </thead>
            <tbody className="text-zinc-900">
              {rows.map((r) => (
                <tr key={r.slug ?? r.name} className="border-b border-zinc-200">
                  <td className="px-2 py-1.5">
                    {r.slug ? (
                      <Link className="hover:underline" href={`/teams/${r.slug}`}>
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.r1}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.r2}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.r34}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          {season ? `Season: ${season}` : "No season found yet — run player sync."}
        </p>
      </div>
    </main>
  );
}

