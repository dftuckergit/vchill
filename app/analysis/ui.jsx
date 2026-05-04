"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { filterPlayersByTeamAbbrevs } from "@/lib/playoff-pick-eligibility";
import { groupPosition } from "@/lib/player-position-group";
import { teamPrimaryHex } from "@/lib/nhl/team-primary-colors";

function ToggleButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-sky-200/80 text-zinc-900"
          : "border border-zinc-200 bg-white text-zinc-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SortTh({
  label,
  colKey,
  sortKey,
  sortDir,
  alignRight,
  arrowAfterLabel,
  labelTruncate,
  onSort,
  /** Minimal width; content defines column width */
  hug,
  /** Absorb remaining horizontal space (e.g. Player) */
  fill,
  /** Minimal width for numeric columns */
  narrow,
}) {
  const active = sortKey === colKey;
  const arrow = (
    <span
      className="inline-flex w-3 shrink-0 select-none items-center justify-center text-[10px] leading-none text-zinc-500"
      aria-hidden
    >
      {active ? (
        sortDir === "asc" ? (
          "▲"
        ) : (
          "▼"
        )
      ) : (
        <span className="invisible">▲</span>
      )}
    </span>
  );
  const labelClass = labelTruncate
    ? "min-w-0 flex-1 truncate text-left"
    : "shrink-0 whitespace-nowrap";
  return (
    <th
      scope="col"
      className={[
        "px-2 py-2 text-xs font-black text-zinc-800",
        alignRight ? "text-right" : "text-left",
        hug ? "w-px whitespace-nowrap" : "",
        narrow ? "w-px whitespace-nowrap" : "",
        fill ? "min-w-0 w-full" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-sort={
        active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(colKey)}
        className={[
          "flex min-h-[1.25rem] items-center gap-1 px-0.5",
          hug || narrow ? "w-max max-w-full" : "w-full min-w-0 max-w-full",
          alignRight ? "justify-end" : "justify-start",
        ].join(" ")}
      >
        {!arrowAfterLabel ? arrow : null}
        <span className={labelClass}>{label}</span>
        {arrowAfterLabel ? arrow : null}
      </button>
    </th>
  );
}

function poolRoundTitle(r) {
  if (r === 1) return "Round 1";
  if (r === 2) return "Round 2";
  return "Rounds 3 + 4";
}

function pickMetaForRound(roundPickData, poolRound, playerId) {
  const block = roundPickData?.[String(poolRound)] ?? {};
  return block[String(playerId)] ?? { pickCount: 0, pickers: [] };
}

function ptsForPoolRound(row, poolRound) {
  if (poolRound === 1) return Number(row.pts1 ?? 0) || 0;
  if (poolRound === 2) return Number(row.pts2 ?? 0) || 0;
  return Number(row.pts3 ?? 0) || 0;
}

function compareAnalysisRows(a, b, sortKey, sortDir, poolRound, roundPickData) {
  const m = sortDir === "asc" ? 1 : -1;
  const tieName = () => String(a.name || "").localeCompare(String(b.name || "")) * m;
  const picks = (row) =>
    pickMetaForRound(roundPickData, poolRound, row.id).pickCount;
  const pts = (row) => ptsForPoolRound(row, poolRound);

  switch (sortKey) {
    case "team": {
      const c =
        String(a.team_abbrev || "")
          .toUpperCase()
          .localeCompare(String(b.team_abbrev || "").toUpperCase()) * m;
      return c !== 0 ? c : tieName();
    }
    case "name":
      return tieName();
    case "pos": {
      const c =
        String(a.position || "")
          .toUpperCase()
          .localeCompare(String(b.position || "").toUpperCase()) * m;
      return c !== 0 ? c : tieName();
    }
    case "picks": {
      const c = (picks(a) - picks(b)) * m;
      return c !== 0 ? c : tieName();
    }
    case "pts": {
      const c = (pts(a) - pts(b)) * m;
      return c !== 0 ? c : tieName();
    }
    default:
      return tieName();
  }
}

export default function AnalysisClient({
  season,
  players = [],
  eligibleByRound = { 1: null, 2: null, 3: null },
  roundPickData = { 1: {}, 2: {}, 3: {} },
  roundRevealed = { 1: true, 2: true, 3: true },
  initialPoolRound = 1,
}) {
  const [poolRound, setPoolRound] = useState(initialPoolRound);
  const [conference, setConference] = useState("All");
  const [positionGroup, setPositionGroup] = useState("All");
  const [sortKey, setSortKey] = useState("picks");
  const [sortDir, setSortDir] = useState("desc");
  const [openPlayerId, setOpenPlayerId] = useState(null);

  const anyRoundPublic =
    roundRevealed[1] || roundRevealed[2] || roundRevealed[3];

  /** If stored round is locked (e.g. settings changed), show first public round. */
  const activePoolRound = roundRevealed[poolRound]
    ? poolRound
    : ([1, 2, 3].find((r) => roundRevealed[r]) ?? 1);

  const eligibleSet = useMemo(() => {
    const arr = eligibleByRound?.[String(activePoolRound)];
    if (!arr?.length) return null;
    return new Set(arr.map((a) => String(a).toUpperCase()));
  }, [eligibleByRound, activePoolRound]);

  const eligibilityFiltered = useMemo(
    () => filterPlayersByTeamAbbrevs(players, eligibleSet),
    [players, eligibleSet],
  );

  const conferenceFiltered = useMemo(() => {
    return eligibilityFiltered.filter((p) => {
      if (conference === "All") return true;
      return (p.conference || "Unknown") === conference;
    });
  }, [eligibilityFiltered, conference]);

  const positionFiltered = useMemo(() => {
    return conferenceFiltered.filter((p) => {
      if (positionGroup === "All") return true;
      return groupPosition(p.position) === positionGroup;
    });
  }, [conferenceFiltered, positionGroup]);

  const sortedRows = useMemo(() => {
    const next = [...positionFiltered];
    next.sort((a, b) =>
      compareAnalysisRows(a, b, sortKey, sortDir, activePoolRound, roundPickData),
    );
    return next;
  }, [positionFiltered, sortKey, sortDir, activePoolRound, roundPickData]);

  function onSortHeader(colKey) {
    if (sortKey === colKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(colKey);
      setSortDir(
        colKey === "name" || colKey === "team" || colKey === "pos"
          ? "asc"
          : "desc",
      );
    }
  }

  function toggleRow(playerId) {
    setOpenPlayerId((cur) => (cur === playerId ? null : playerId));
  }

  const ptsLabel =
    activePoolRound === 1 ? "R1" : activePoolRound === 2 ? "R2" : "R3+4";

  return (
    <div className="mt-8">
      {!season ? (
        <p className="text-center text-sm text-amber-800">
          No player season in the database yet. In Admin, run{" "}
          <span className="font-semibold">Sync players</span> after choosing the
          playoff year.
        </p>
      ) : null}

      {season ? (
        <>
          {!anyRoundPublic ? (
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-center text-sm text-amber-950 ring-1 ring-amber-200">
              Pick analysis is not available yet — no pool round pick deadlines
              have passed. Check back after the first deadline.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <label className="flex items-center gap-2 text-sm font-semibold text-zinc-800">
                  <span className="shrink-0">Pool round</span>
                  <select
                    className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-900 shadow-sm"
                    value={activePoolRound}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (![1, 2, 3].includes(v) || !roundRevealed[v]) return;
                      setPoolRound(v);
                      setOpenPlayerId(null);
                    }}
                  >
                    {[1, 2, 3].map((r) => (
                      <option
                        key={r}
                        value={r}
                        disabled={!roundRevealed[r]}
                        className={
                          roundRevealed[r] ? "text-zinc-900" : "text-zinc-400"
                        }
                        title={
                          roundRevealed[r]
                            ? undefined
                            : "Available after this pool round’s pick deadline"
                        }
                      >
                        {poolRoundTitle(r)}
                        {!roundRevealed[r] ? " (locked)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mb-2 flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
                <ToggleButton
                  active={conference === "All"}
                  onClick={() => setConference("All")}
                >
                  All conferences
                </ToggleButton>
                <ToggleButton
                  active={conference === "East"}
                  onClick={() => setConference("East")}
                >
                  East
                </ToggleButton>
                <ToggleButton
                  active={conference === "West"}
                  onClick={() => setConference("West")}
                >
                  West
                </ToggleButton>
              </div>

              <div className="mb-6 flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
                <ToggleButton
                  active={positionGroup === "All"}
                  onClick={() => setPositionGroup("All")}
                >
                  All positions
                </ToggleButton>
                <ToggleButton
                  active={positionGroup === "Forwards"}
                  onClick={() => setPositionGroup("Forwards")}
                >
                  Forwards
                </ToggleButton>
                <ToggleButton
                  active={positionGroup === "Defence"}
                  onClick={() => setPositionGroup("Defence")}
                >
                  Defence
                </ToggleButton>
                <ToggleButton
                  active={positionGroup === "Goalies"}
                  onClick={() => setPositionGroup("Goalies")}
                >
                  Goalies
                </ToggleButton>
              </div>

              <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white">
                <table className="w-full min-w-[32rem] table-auto border-collapse text-sm [&_td:last-child]:pr-3 [&_th:last-child]:pr-3">
              <thead className="border-b border-zinc-200 bg-zinc-100">
                <tr>
                  <SortTh
                    label="Pos"
                    colKey="pos"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    onSort={onSortHeader}
                    hug
                  />
                  <SortTh
                    label="Team"
                    colKey="team"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    arrowAfterLabel
                    onSort={onSortHeader}
                    hug
                  />
                  <SortTh
                    label="Player"
                    colKey="name"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    arrowAfterLabel
                    labelTruncate
                    onSort={onSortHeader}
                    fill
                  />
                  <SortTh
                    label={ptsLabel}
                    colKey="pts"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    alignRight
                    onSort={onSortHeader}
                    narrow
                  />
                  <SortTh
                    label="Picks"
                    colKey="picks"
                    sortKey={sortKey}
                    sortDir={sortDir}
                    alignRight
                    onSort={onSortHeader}
                    narrow
                  />
                </tr>
              </thead>
              <tbody className="text-zinc-900">
                {sortedRows.length ? (
                  sortedRows.map((row) => {
                    const meta = pickMetaForRound(
                      roundPickData,
                      activePoolRound,
                      row.id,
                    );
                    const pts = ptsForPoolRound(row, activePoolRound);
                    const expanded = openPlayerId === row.id;
                    const teamHex = teamPrimaryHex(row.team_abbrev);
                    return (
                      <Fragment key={row.id}>
                        <tr
                          className={[
                            "cursor-pointer hover:bg-zinc-50",
                            expanded ? "border-b-0" : "border-b border-zinc-100",
                          ].join(" ")}
                          onClick={() => toggleRow(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleRow(row.id);
                            }
                          }}
                          tabIndex={0}
                          aria-expanded={expanded}
                        >
                          <td className="w-px whitespace-nowrap px-2 py-2 text-zinc-700">
                            {row.position || "—"}
                          </td>
                          <td className="w-px whitespace-nowrap px-2 py-2">
                            <span
                              className="font-bold tabular-nums"
                              style={
                                teamHex
                                  ? { color: teamHex }
                                  : { color: "#18181b" }
                              }
                            >
                              {row.team_abbrev || "—"}
                            </span>
                          </td>
                          <td className="min-w-0 px-2 py-2 text-zinc-900">
                            <span className="block max-w-full truncate font-semibold">
                              {row.name}
                            </span>
                          </td>
                          <td className="w-px whitespace-nowrap px-2 py-2 text-right tabular-nums text-zinc-900">
                            {pts}
                          </td>
                          <td className="w-px whitespace-nowrap px-2 py-2 text-right tabular-nums text-zinc-900">
                            {meta.pickCount}
                          </td>
                        </tr>
                        {expanded ? (
                          <tr className="border-b border-zinc-100 bg-white">
                            <td
                              className="w-px border-0 bg-white p-0 align-top"
                              aria-hidden="true"
                            />
                            <td
                              className="w-px border-0 bg-white p-0 align-top"
                              aria-hidden="true"
                            />
                            <td
                              colSpan={3}
                              className="border-0 bg-white px-2 pb-3 pt-0 text-left text-sm align-top"
                            >
                              {meta.pickers?.length ? (
                                <p className="leading-relaxed text-zinc-800">
                                  {meta.pickers.map((picker, idx) => (
                                    <Fragment key={picker.participant_id}>
                                      {idx > 0 ? (
                                        <span className="text-zinc-400">
                                          ,{" "}
                                        </span>
                                      ) : null}
                                      {picker.slug ? (
                                        <Link
                                          href={`/teams/${encodeURIComponent(picker.slug)}`}
                                          className="font-semibold text-[#163a59] no-underline decoration-[#163a59] hover:underline hover:opacity-80"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          {picker.name}
                                        </Link>
                                      ) : (
                                        <span className="font-semibold text-[#163a59]">
                                          {picker.name}
                                        </span>
                                      )}
                                      {meta.pickCount === 1 ? (
                                        <span
                                          className="text-zinc-800"
                                          title="Only one participant picked this player this round"
                                          aria-label="Only one participant picked this player this round"
                                        >
                                          {" "}
                                          🧠
                                        </span>
                                      ) : null}
                                      {picker.is_star ? (
                                        <span
                                          className="text-amber-600"
                                          title="Star pick"
                                          aria-label="Star pick"
                                        >
                                          {" "}
                                          ⭐
                                        </span>
                                      ) : null}
                                    </Fragment>
                                  ))}
                                </p>
                              ) : (
                                <span className="text-zinc-500">
                                  Nobody wanted this guy!
                                </span>
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-10 text-center text-xs text-zinc-500"
                    >
                      No players match the current filters for{" "}
                      <span className="font-semibold">
                        {poolRoundTitle(activePoolRound)}
                      </span>
                      {eligibleSet?.size
                        ? " (eligible teams may be limiting the list)"
                        : ""}
                      .
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
