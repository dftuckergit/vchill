export const metadata = {
  title: "Standings | V Chill Pool",
};

export const dynamic = "force-dynamic";

import Link from "next/link";
import { StandingsLastUpdated } from "../_components/StandingsLastUpdated";
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

  const [playersRes, statsRes, picksRes, latestStatsRes] = season
    ? await Promise.all([
        supabase.from("players").select("id,nhl_id").eq("season", season),
        supabase.from("stats").select("*").eq("season", season),
        supabase
          .from("picks")
          .select("participant_id,player_id,round,is_star")
          .eq("season", season),
        supabase
          .from("stats")
          .select("created_at")
          .eq("season", season)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: null },
      ];

  const players = playersRes?.data ?? [];
  const statsRows = statsRes?.data ?? [];
  const picks = picksRes?.data ?? [];

  const statsLastWrittenAt =
    season && latestStatsRes?.data?.created_at
      ? String(latestStatsRes.data.created_at)
      : null;

  const rows = computeStandingsRows({
    participants: participants ?? [],
    season,
    picks: picks ?? [],
    players: players ?? [],
    statsRows: statsRows ?? [],
  });

  const colClass = "w-[20%] min-w-0 px-2 py-2.5 text-xs font-black";
  const colClassBody = "w-[20%] min-w-0 px-2 py-1.5";

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <h1 className="text-center text-[32px] leading-[1.0] font-black text-[#163a59]">
          Team Standings
        </h1>

        <div className="mt-10 overflow-x-auto rounded-md">
          <table className="w-full min-w-[28rem] table-fixed text-sm">
            <thead>
              <tr className="border-b border-zinc-300 text-zinc-900">
                <th className={`${colClass} text-left`}>Team</th>
                <th className={`${colClass} text-right`}>R1</th>
                <th className={`${colClass} text-right`}>R2</th>
                <th className={`${colClass} text-right`}>R3+4</th>
                <th className={`${colClass} text-right`}>Total</th>
              </tr>
            </thead>
            <tbody className="text-zinc-900">
              {rows.map((r) => (
                <tr key={r.slug ?? r.name} className="border-b border-zinc-200">
                  <td className={colClassBody}>
                    <div className="truncate">
                      {r.slug ? (
                        <Link
                          className="hover:underline"
                          href={`/teams/${r.slug}`}
                          title={r.name}
                        >
                          {r.name}
                        </Link>
                      ) : (
                        r.name
                      )}
                    </div>
                  </td>
                  <td className={`${colClassBody} text-right tabular-nums`}>
                    {r.r1}
                  </td>
                  <td className={`${colClassBody} text-right tabular-nums`}>
                    {r.r2}
                  </td>
                  <td className={`${colClassBody} text-right tabular-nums`}>
                    {r.r34}
                  </td>
                  <td className={`${colClassBody} text-right tabular-nums`}>
                    {r.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {season ? (
          <StandingsLastUpdated iso={statsLastWrittenAt} />
        ) : (
          <p className="mt-6 text-center text-xs text-zinc-400">
            No season found yet — run player sync.
          </p>
        )}
      </div>
    </main>
  );
}
