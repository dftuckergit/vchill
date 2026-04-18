export const metadata = {
  title: "Status | V Chill Pool",
};

export const dynamic = "force-dynamic";

import Link from "next/link";
import { StatusLastRefreshed } from "../_components/StatusLastRefreshed";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchPoolSettings } from "@/lib/pool-settings";
import { currentPoolSeasonId } from "@/lib/current-pool";
import {
  countPicksForPoolRound,
  pickSubmissionLabel,
} from "@/lib/pick-submission-status";

function poolRoundTitle(r) {
  if (r === 1) return "Round 1";
  if (r === 2) return "Round 2";
  return "Rounds 3 + 4";
}

function StatusCell({ count }) {
  const label = pickSubmissionLabel(count);
  if (label === "submitted") {
    return (
      <span className="font-semibold text-emerald-700">submitted</span>
    );
  }
  return <>none</>;
}

export default async function StatusPage() {
  const refreshedAtIso = new Date().toISOString();
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

  let poolSettings = null;
  const seasonForSettings = season ?? currentPoolSeasonId();
  try {
    poolSettings = await fetchPoolSettings(supabase, seasonForSettings);
  } catch {
    poolSettings = null;
  }

  const currentPoolRound = poolSettings?.current_round ?? 1;

  const { data: picks } = season
    ? await supabase
        .from("picks")
        .select("participant_id,round,season")
        .eq("season", season)
    : { data: [] };

  const pickList = picks ?? [];

  const teamColHead =
    "w-[36%] min-w-0 px-2 py-2.5 text-left text-xs font-black align-middle";
  const teamColBody =
    "w-[36%] min-w-0 px-2 py-1.5 text-left align-top break-words [overflow-wrap:anywhere]";
  const statusColHead =
    "w-[21.33%] min-w-0 px-2 py-2.5 text-xs font-black align-middle text-center";
  const statusColBody =
    "w-[21.33%] min-w-0 px-2 py-1.5 align-top text-center text-sm font-semibold text-zinc-800";

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-3xl">
        <h1 className="text-center text-[32px] leading-[1.0] font-black text-[#163a59]">
          Pick status
        </h1>
        <p className="mt-3 text-center text-[16px] leading-[1.2] text-zinc-800">
          Each pool round is <span className="font-semibold">submitted</span> when
          a team has 12 picks saved for that round. Otherwise it shows{" "}
          <span className="font-semibold">none</span>.
        </p>
        {season ? (
          <p className="mt-2 text-center text-xs text-zinc-500">
            Season <span className="font-mono">{season}</span>
            {" · "}
            Current pool round in settings:{" "}
            <span className="font-semibold">{poolRoundTitle(currentPoolRound)}</span>
          </p>
        ) : null}

        <div className="mt-10 overflow-x-auto rounded-md">
          <table className="w-full min-w-0 table-fixed text-sm sm:min-w-[28rem]">
            <thead>
              <tr className="border-b border-zinc-300 text-zinc-900">
                <th className={teamColHead}>Participant</th>
                <th className={statusColHead}>{poolRoundTitle(1)}</th>
                <th className={statusColHead}>{poolRoundTitle(2)}</th>
                <th className={statusColHead}>{poolRoundTitle(3)}</th>
              </tr>
            </thead>
            <tbody className="text-zinc-900">
              {(participants ?? []).map((p) => {
                const c1 = countPicksForPoolRound(pickList, p.id, season, 1);
                const c2 = countPicksForPoolRound(pickList, p.id, season, 2);
                const c3 = countPicksForPoolRound(pickList, p.id, season, 3);
                return (
                  <tr key={p.id} className="border-b border-zinc-200">
                    <td className={teamColBody}>
                      {p.slug ? (
                        <Link
                          className="hover:underline"
                          href={`/teams/${p.slug}`}
                          title={p.name}
                        >
                          {p.name}
                        </Link>
                      ) : (
                        p.name
                      )}
                    </td>
                    <td className={statusColBody}>
                      <StatusCell count={c1} />
                    </td>
                    <td className={statusColBody}>
                      <StatusCell count={c2} />
                    </td>
                    <td className={statusColBody}>
                      <StatusCell count={c3} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!season ? (
          <p className="mt-6 text-center text-xs text-zinc-400">
            No season found yet — run player sync.
          </p>
        ) : null}

        <StatusLastRefreshed iso={refreshedAtIso} />
      </div>
    </main>
  );
}
