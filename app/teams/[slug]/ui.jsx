"use client";

import { useMemo, useState } from "react";
import { teamPrimaryHex } from "@/lib/nhl/team-primary-colors";
import { rosterSlotLabelsPicksPageOrder } from "@/lib/roster-slot-order";

const SLOT_LABELS = rosterSlotLabelsPicksPageOrder();

function compareRoundTitle(poolRound) {
  if (poolRound === 1) return "ROUND 1";
  if (poolRound === 2) return "ROUND 2";
  return "ROUND 3 + 4";
}

/** One “screen” of round content when horizontally scrolling on small viewports. */
const ROUND_COL_MIN_MOBILE =
  "max-md:min-w-[min(22rem,calc(100vw-3.75rem))] md:min-w-0";

function PointsWithStar({ pointsText, showStar, muted }) {
  const tone = muted ? "text-zinc-400" : "text-zinc-900";
  /** Tight group: 8px only between star and score. (A wide min on the score column was pushing digits away from the star.) */
  return (
    <span
      className={`inline-flex shrink-0 items-baseline gap-x-[8px] tabular-nums ${tone}`}
    >
      <span className="inline-flex w-[1em] shrink-0 justify-end text-xs leading-none">
        {showStar ? (
          <span aria-label="Star pick">⭐</span>
        ) : null}
      </span>
      <span className="text-sm font-bold">{pointsText}</span>
    </span>
  );
}

function PickCell({ pick, picksRevealed }) {
  if (!picksRevealed) {
    return (
      <div className="flex min-w-0 items-baseline text-sm">
        <span className="min-w-0 flex-1 truncate text-left text-zinc-400">
          —
        </span>
        <PointsWithStar pointsText="—" showStar={false} muted />
      </div>
    );
  }
  if (!pick) {
    return (
      <div className="flex min-w-0 items-baseline text-sm">
        <span className="min-w-0 flex-1 truncate text-left text-zinc-400">
          —
        </span>
        <PointsWithStar pointsText="—" showStar={false} muted />
      </div>
    );
  }
  const hex = teamPrimaryHex(pick.team_abbrev);
  return (
    <div className="flex min-w-0 items-baseline text-sm">
      <span className="min-w-0 flex-1 truncate text-zinc-900">
        <span
          className="font-bold"
          style={hex ? { color: hex } : { color: "#18181b" }}
        >
          {pick.team_abbrev}
        </span>{" "}
        <span className="font-normal">{pick.name}</span>
      </span>
      <PointsWithStar
        pointsText={pick.points}
        showStar={!!pick.is_star}
        muted={false}
      />
    </div>
  );
}

function RoundsSummaryTable({ meSummary, picksRevealedByRound }) {
  const roundDefs = [
    { key: 1, title: "ROUND 1", revealed: picksRevealedByRound[1] !== false },
    { key: 2, title: "ROUND 2", revealed: picksRevealedByRound[2] !== false },
    { key: 3, title: "ROUND 3 + 4", revealed: picksRevealedByRound[3] !== false },
  ];
  const byRound = [
    meSummary?.rounds?.[1]?.picks ?? [],
    meSummary?.rounds?.[2]?.picks ?? [],
    meSummary?.rounds?.[3]?.picks ?? [],
  ];

  return (
    <div className="mx-auto mt-10 w-full max-w-5xl max-md:-mx-6 max-md:px-6 md:mx-auto md:px-0">
      <div className="overflow-x-auto md:overflow-x-visible [-webkit-overflow-scrolling:touch]">
        <table className="w-full border-collapse text-left text-sm max-md:w-max md:table-fixed">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-[1] w-14 bg-white pb-3 pr-2 align-bottom text-xs font-black tracking-wide text-zinc-900 max-md:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.12)] md:static md:z-auto md:w-16 md:shadow-none"
              />
              {roundDefs.map((r, ri) => (
                <th
                  key={r.key}
                  scope="col"
                  className={`${ROUND_COL_MIN_MOBILE} pb-3 pl-2 align-bottom text-xs font-black tracking-wide text-zinc-900 md:pl-2 ${
                    ri < roundDefs.length - 1 ? "max-md:pr-4 md:pr-8" : "pr-2"
                  }`}
                >
                {r.title}
                {!r.revealed ? (
                  <div className="mt-1 max-w-[12rem] text-[10px] font-semibold leading-snug text-zinc-500">
                    Picks stay private until after this round&apos;s deadline.
                  </div>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOT_LABELS.map((label, i) => (
            <tr key={`slot-${i}`} className="border-b border-zinc-100">
              <th
                scope="row"
                className="sticky left-0 z-[1] bg-white py-2 pr-2 align-baseline text-left text-xs font-semibold text-zinc-500 max-md:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.12)] md:static md:z-auto md:shadow-none"
              >
                {label}
              </th>
              {roundDefs.map((r, ri) => (
                <td
                  key={r.key}
                  className={`${ROUND_COL_MIN_MOBILE} py-2 pl-2 align-baseline md:pl-2 ${
                    ri < roundDefs.length - 1 ? "max-md:pr-4 md:pr-8" : "pr-2"
                  }`}
                >
                  <PickCell
                    pick={byRound[ri][i] ?? null}
                    picksRevealed={r.revealed}
                  />
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-zinc-200">
            <th
              scope="row"
              className="sticky left-0 z-[1] bg-white pt-3 pr-2 text-left text-sm font-black text-zinc-900 max-md:shadow-[4px_0_12px_-4px_rgba(0,0,0,0.12)] md:static md:z-auto md:shadow-none"
            >
              TOTAL
            </th>
            {roundDefs.map((r, ri) => (
              <td
                key={r.key}
                className={`${ROUND_COL_MIN_MOBILE} pt-3 pl-2 text-right text-sm font-black tabular-nums text-zinc-900 md:pl-2 ${
                  ri < roundDefs.length - 1 ? "max-md:pr-4 md:pr-8" : "pr-2"
                }`}
              >
                {r.revealed
                  ? r.key === 1
                    ? (meSummary?.totals?.r1 ?? 0)
                    : r.key === 2
                      ? (meSummary?.totals?.r2 ?? 0)
                      : (meSummary?.totals?.r34 ?? 0)
                  : "—"}
              </td>
            ))}
          </tr>
        </tbody>
        </table>
      </div>
    </div>
  );
}

function CompareTable({
  season,
  currentPoolRound,
  picksRevealedByRound,
  meSummary,
  teams,
}) {
  const [compareId, setCompareId] = useState("");
  const [compareState, setCompareState] = useState({
    status: "idle",
    summary: null,
  });

  const compareOptions = useMemo(() => {
    const meId = meSummary?.participant?.id;
    return (teams ?? []).filter((t) => t.id && t.id !== meId);
  }, [teams, meSummary]);

  async function loadCompare(nextId) {
    setCompareId(String(nextId || ""));
    if (!nextId) {
      setCompareState({ status: "idle", summary: null });
      return;
    }
    setCompareState({ status: "loading", summary: null });
    try {
      const res = await fetch(
        `/api/team-summary?participant_id=${encodeURIComponent(nextId)}&season=${encodeURIComponent(
          season || ""
        )}`
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
      }
      setCompareState({ status: "loaded", summary: json.summary });
    } catch {
      setCompareState({ status: "error", summary: null });
    }
  }

  const roundKey = currentPoolRound;
  const compareRevealed = picksRevealedByRound[roundKey] !== false;
  const title = compareRoundTitle(currentPoolRound);

  const mePicks = meSummary?.rounds?.[roundKey]?.picks ?? [];
  const theirPicks =
    compareState.status === "loaded"
      ? (compareState.summary?.rounds?.[roundKey]?.picks ?? [])
      : [];

  const myTotal =
    currentPoolRound === 1
      ? (meSummary?.totals?.r1 ?? 0)
      : currentPoolRound === 2
        ? (meSummary?.totals?.r2 ?? 0)
        : (meSummary?.totals?.r34 ?? 0);

  const theirTotal =
    compareState.status === "loaded"
      ? currentPoolRound === 1
        ? (compareState.summary?.totals?.r1 ?? 0)
        : currentPoolRound === 2
          ? (compareState.summary?.totals?.r2 ?? 0)
          : (compareState.summary?.totals?.r34 ?? 0)
      : null;

  const meName = meSummary?.participant?.name ?? "You";
  const theirName =
    compareState.status === "loaded"
      ? (compareState.summary?.participant?.name ?? "Team")
      : compareState.status === "loading"
        ? "Loading…"
        : "Select a team";

  return (
    <>
      <h2 className="mt-14 text-center text-[32px] leading-[1.0] font-black text-[#163a59]">
        Compare to
      </h2>
      <div className="mx-auto mt-8 w-full max-w-5xl">
        <div className="mb-4 flex justify-end">
          <select
            className="w-full max-w-xs rounded-full border border-zinc-300 bg-zinc-100 py-2.5 pl-4 pr-11 text-sm text-zinc-900"
            value={compareId}
            onChange={(e) => loadCompare(e.target.value)}
          >
            <option value="">Select a team…</option>
            {compareOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="max-md:overflow-x-visible md:overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm max-md:table-auto md:table-fixed md:min-w-[560px]">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="w-14 pb-3 pr-2 align-bottom text-xs font-black tracking-wide text-zinc-900 md:w-16"
                />
                <th
                  scope="col"
                  className="hidden pb-3 pl-2 align-bottom text-xs font-black tracking-wide text-zinc-900 md:table-cell md:pr-8"
                >
                  {title}
                  <div className="mt-1 text-[11px] font-semibold leading-snug text-zinc-700">
                    {meName}
                  </div>
                </th>
                <th
                  scope="col"
                  className="pb-3 pl-2 pr-2 align-bottom text-xs font-black tracking-wide text-zinc-900"
                >
                  {title}
                  <div className="mt-1 text-[11px] font-semibold leading-snug text-zinc-700">
                    {theirName}
                  </div>
                  {compareId ? (
                    <div className="mt-1 hidden text-[10px] font-normal text-zinc-500 max-md:block">
                      vs {meName}
                    </div>
                  ) : null}
                </th>
              </tr>
            </thead>
            <tbody>
              {SLOT_LABELS.map((label, i) => (
                <tr key={`cmp-${i}`} className="border-b border-zinc-100">
                  <th
                    scope="row"
                    className="py-2 pr-2 align-baseline text-xs font-semibold text-zinc-500"
                  >
                    {label}
                  </th>
                  <td className="hidden py-2 pl-2 align-baseline md:table-cell md:pr-8">
                    <PickCell
                      pick={mePicks[i] ?? null}
                      picksRevealed={compareRevealed}
                    />
                  </td>
                  <td className="py-2 pl-2 pr-2 align-baseline">
                    {!compareRevealed ? (
                      <PickCell pick={null} picksRevealed={false} />
                    ) : compareState.status === "loading" ? (
                      <div className="text-xs text-zinc-400">Loading…</div>
                    ) : compareState.status === "loaded" ? (
                      <PickCell
                        pick={theirPicks[i] ?? null}
                        picksRevealed
                      />
                    ) : (
                      <PickCell pick={null} picksRevealed />
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-zinc-200">
                <th
                  scope="row"
                  className="pt-3 pr-2 text-left text-sm font-black text-zinc-900"
                >
                  TOTAL
                </th>
                <td className="hidden pt-3 pl-2 text-right text-sm font-black tabular-nums text-zinc-900 md:table-cell md:pr-8">
                  {compareRevealed ? myTotal : "—"}
                </td>
                <td className="pt-3 pl-2 pr-2 text-right text-sm font-black tabular-nums text-zinc-900">
                  {compareState.status !== "loaded"
                    ? "—"
                    : compareRevealed
                      ? (theirTotal ?? 0)
                      : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {compareState.status === "error" ? (
          <p className="mt-3 text-center text-xs text-red-600">
            Couldn&apos;t load comparison.
          </p>
        ) : null}
      </div>
    </>
  );
}

export default function TeamClient({
  season,
  currentPoolRound = 1,
  picksRevealedByRound = { 1: true, 2: true, 3: true },
  meSummary,
  teams,
}) {
  return (
    <>
      <RoundsSummaryTable
        meSummary={meSummary}
        picksRevealedByRound={picksRevealedByRound}
      />
      <CompareTable
        season={season}
        currentPoolRound={currentPoolRound}
        picksRevealedByRound={picksRevealedByRound}
        meSummary={meSummary}
        teams={teams}
      />
    </>
  );
}
