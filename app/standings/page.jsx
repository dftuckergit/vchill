export const metadata = {
  title: "Standings | V Chill Pool",
};

export const dynamic = "force-dynamic";

import Link from "next/link";
import { StandingsLastUpdated } from "../_components/StandingsLastUpdated";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  arePicksVisibleAfterDeadline,
  fetchPoolSettings,
} from "@/lib/pool-settings";
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

  /** Match team page: do not show a pool round’s points until that round’s pick deadline has passed (if set). */
  let poolSettings = null;
  if (season) {
    try {
      poolSettings = await fetchPoolSettings(supabase, season);
    } catch {
      poolSettings = null;
    }
  }
  const showR1 =
    !poolSettings || arePicksVisibleAfterDeadline(poolSettings, 1);
  const showR2 =
    !poolSettings || arePicksVisibleAfterDeadline(poolSettings, 2);
  const showR34 =
    !poolSettings || arePicksVisibleAfterDeadline(poolSettings, 3);

  const displayRows = rows
    .map((r) => {
      const r1 = showR1 ? r.r1 : 0;
      const r2 = showR2 ? r.r2 : 0;
      const r34 = showR34 ? r.r34 : 0;
      return { ...r, r1, r2, r34, total: r1 + r2 + r34 };
    })
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });

  /** Team column wider so names can wrap on mobile; R1–R3+4–Tot stay equal width. */
  const teamColHead =
    "w-[36%] min-w-0 px-2 py-2.5 text-left text-xs font-black align-middle";
  const teamColBody =
    "w-[36%] min-w-0 px-2 py-1.5 text-left align-top break-words [overflow-wrap:anywhere]";
  const numColHead =
    "w-[16%] min-w-0 px-2 py-2.5 text-xs font-black align-middle text-right";
  const numColBody =
    "w-[16%] min-w-0 px-2 py-1.5 align-top text-right tabular-nums";

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <h1 className="text-center text-[32px] leading-[1.0] font-black text-[#163a59]">
          Team Standings
        </h1>

        <div className="mt-10 overflow-x-auto rounded-md">
          <table className="w-full min-w-0 table-fixed text-sm sm:min-w-[28rem]">
            <thead>
              <tr className="border-b border-zinc-300 text-zinc-900">
                <th className={teamColHead}>Team</th>
                <th className={numColHead}>R1</th>
                <th className={numColHead}>R2</th>
                <th className={numColHead}>R3+4</th>
                <th className={numColHead}>Total</th>
              </tr>
            </thead>
            <tbody className="text-zinc-900">
              {displayRows.map((r) => (
                <tr key={r.slug ?? r.name} className="border-b border-zinc-200">
                  <td className={teamColBody}>
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
                  </td>
                  <td className={numColBody}>{r.r1}</td>
                  <td className={numColBody}>{r.r2}</td>
                  <td className={numColBody}>{r.r34}</td>
                  <td className={numColBody}>{r.total}</td>
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
