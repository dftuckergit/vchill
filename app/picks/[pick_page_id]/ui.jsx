"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PICK_SALARY_CAP } from "@/lib/pick-roster-rules";
import { teamPrimaryHex } from "@/lib/nhl/team-primary-colors";

function DeadlineCountdown({ iso }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return null;
  const end = new Date(iso).getTime();
  const ms = Number.isFinite(end) ? Math.max(0, end - now) : 0;
  const sec = Math.floor(ms / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (
    <div className="mt-3 flex items-center justify-center gap-2 text-center text-xs text-zinc-800">
      <span className="font-semibold">DEADLINE IN:</span>
      <span className="font-mono text-red-600" suppressHydrationWarning>
        {d}:{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:
        {String(s).padStart(2, "0")}
      </span>
    </div>
  );
}

function ToggleButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
        active ? "bg-sky-200/80 text-zinc-900" : "border border-zinc-200 bg-white text-zinc-700",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function comparePickerRows(a, b, sortKey, dir) {
  const m = dir === "asc" ? 1 : -1;
  const tieName = () => a.name.localeCompare(b.name) * m;
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
    case "r1": {
      const c = (Number(a.stats?.r1 ?? 0) - Number(b.stats?.r1 ?? 0)) * m;
      return c !== 0 ? c : tieName();
    }
    case "r2": {
      const c = (Number(a.stats?.r2 ?? 0) - Number(b.stats?.r2 ?? 0)) * m;
      return c !== 0 ? c : tieName();
    }
    case "p": {
      const c = (Number(a.stats?.total ?? 0) - Number(b.stats?.total ?? 0)) * m;
      return c !== 0 ? c : tieName();
    }
    case "salary": {
      const c = (Number(a.salary || 0) - Number(b.salary || 0)) * m;
      return c !== 0 ? c : tieName();
    }
    default:
      return tieName();
  }
}

function SortTh({
  label,
  colKey,
  sortKey,
  sortDir,
  alignRight,
  onSort,
  disabled,
}) {
  const active = sortKey === colKey;
  return (
    <th
      scope="col"
      className={[
        "px-2 py-2 text-xs font-semibold text-zinc-800",
        alignRight ? "text-right" : "text-left",
      ].join(" ")}
      aria-sort={
        active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSort(colKey)}
        className={[
          "inline-flex max-w-full items-center gap-0.5 rounded px-0.5 hover:bg-zinc-200/80 disabled:pointer-events-none disabled:opacity-50",
          alignRight ? "float-right clear-both" : "",
        ].join(" ")}
      >
        <span>{label}</span>
        {active ? (
          <span className="text-[10px] text-zinc-500" aria-hidden>
            {sortDir === "asc" ? "▲" : "▼"}
          </span>
        ) : null}
      </button>
    </th>
  );
}

function groupPosition(pos) {
  if (pos === "F") return "Forwards";
  if (pos === "D") return "Defence";
  if (pos === "G") return "Goalies";
  return "Other";
}

function emptyRoster() {
  return {
    East: { Forwards: [], Defence: [], Goalies: [] },
    West: { Forwards: [], Defence: [], Goalies: [] },
  };
}

function maxSlots(conference, group) {
  if (group === "Forwards") return 3;
  if (group === "Defence") return 2;
  if (group === "Goalies") return 1;
  return 0;
}

function emptyStars() {
  return { Forwards: null, Defence: null, Goalies: null };
}

function buildInitialRoster({ playersById, initialSelectedNhlIds }) {
  const next = emptyRoster();

  for (const nhlId of initialSelectedNhlIds ?? []) {
    const p = playersById.get(nhlId);
    if (!p) continue;
    const conf = p.conference;
    const group = groupPosition(p.position);
    if (conf !== "East" && conf !== "West") continue;
    if (!["Forwards", "Defence", "Goalies"].includes(group)) continue;
    if (next[conf][group].length >= maxSlots(conf, group)) continue;
    next[conf][group].push(p);
  }

  return next;
}

function buildInitialStars({ playersById, initialStarNhlIds }) {
  const next = emptyStars();

  // Use existing star flags to pick a star per group.
  for (const nhlId of initialStarNhlIds ?? []) {
    const p = playersById.get(nhlId);
    if (!p) continue;
    const group = groupPosition(p.position);
    if (!["Forwards", "Defence", "Goalies"].includes(group)) continue;
    if (!next[group]) next[group] = nhlId;
  }

  return next;
}

export default function PicksClient({
  pickPageId,
  season,
  currentPoolRound = 1,
  deadlineAt = null,
  submissionsLocked = false,
  initialPlayers = [],
  initialSelectedNhlIds = [],
  initialStarNhlIds = [],
  pickerMeta = null,
}) {
  const router = useRouter();
  const [conference, setConference] = useState("East");
  const [positionGroup, setPositionGroup] = useState("Forwards");
  const [roster, setRoster] = useState(() => {
    const playersById = new Map((initialPlayers ?? []).map((p) => [p.nhl_id, p]));
    return buildInitialRoster({ playersById, initialSelectedNhlIds });
  });
  const [stars, setStars] = useState(() => {
    const playersById = new Map((initialPlayers ?? []).map((p) => [p.nhl_id, p]));
    return buildInitialStars({ playersById, initialStarNhlIds });
  });
  const [submitState, setSubmitState] = useState({
    status: "idle",
    message: null,
  });
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");

  const savedIdsKey = JSON.stringify({
    sel: [...(initialSelectedNhlIds ?? [])].sort((a, b) => a - b),
    star: [...(initialStarNhlIds ?? [])].sort((a, b) => a - b),
    locked: submissionsLocked,
  });

  useEffect(() => {
    const playersById = new Map((initialPlayers ?? []).map((p) => [p.nhl_id, p]));
    setRoster(buildInitialRoster({ playersById, initialSelectedNhlIds }));
    setStars(buildInitialStars({ playersById, initialStarNhlIds }));
    // Only re-hydrate from the server when saved selection / lock state changes (e.g. router.refresh after submit).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initialPlayers is read from latest render when key changes
  }, [savedIdsKey]);

  const filteredPlayers = useMemo(() => {
    return initialPlayers
      .filter((p) => (p.conference || "Unknown") === conference)
      .filter((p) => groupPosition(p.position) === positionGroup);
  }, [initialPlayers, conference, positionGroup]);

  const players = useMemo(() => {
    const next = [...filteredPlayers];
    next.sort((a, b) => comparePickerRows(a, b, sortKey, sortDir));
    return next;
  }, [filteredPlayers, sortKey, sortDir]);

  function onSortHeader(colKey) {
    if (submissionsLocked) return;
    if (sortKey === colKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(colKey);
      setSortDir(colKey === "name" || colKey === "team" ? "asc" : "desc");
    }
  }

  const selectedIds = useMemo(() => {
    const ids = new Set();
    for (const conf of ["East", "West"]) {
      for (const group of ["Forwards", "Defence", "Goalies"]) {
        for (const p of roster[conf][group]) ids.add(p.nhl_id);
      }
    }
    return ids;
  }, [roster]);

  const totalSalary = useMemo(() => {
    let total = 0;
    for (const conf of ["East", "West"]) {
      for (const group of ["Forwards", "Defence", "Goalies"]) {
        for (const p of roster[conf][group]) total += Number(p.salary || 0);
      }
    }
    return total;
  }, [roster]);

  function addPlayer(p) {
    if (submissionsLocked) return;
    const conf = p.conference;
    const group = groupPosition(p.position);
    if (conf !== "East" && conf !== "West") return;
    if (!["Forwards", "Defence", "Goalies"].includes(group)) return;
    if (selectedIds.has(p.nhl_id)) return;

    setRoster((prev) => {
      const current = prev[conf][group];
      if (current.length >= maxSlots(conf, group)) return prev;
      return {
        ...prev,
        [conf]: {
          ...prev[conf],
          [group]: [...current, p],
        },
      };
    });

  }

  function removePlayer(conf, group, nhl_id) {
    if (submissionsLocked) return;
    setRoster((prev) => ({
      ...prev,
      [conf]: {
        ...prev[conf],
        [group]: prev[conf][group].filter((p) => p.nhl_id !== nhl_id),
      },
    }));

    setStars((prev) => (prev?.[group] === nhl_id ? { ...prev, [group]: null } : prev));
  }

  function toggleStar(conf, group, nhl_id) {
    if (submissionsLocked) return;
    setStars((prev) => ({ ...prev, [group]: prev[group] === nhl_id ? null : nhl_id }));
  }

  const isRosterComplete = useMemo(() => {
    for (const conf of ["East", "West"]) {
      for (const group of ["Forwards", "Defence", "Goalies"]) {
        if (roster[conf][group].length !== maxSlots(conf, group)) return false;
      }
    }
    return true;
  }, [roster]);

  const areStarsChosen = useMemo(() => {
    for (const group of ["Forwards", "Defence", "Goalies"]) {
      if (!stars[group]) return false;
    }
    return true;
  }, [stars]);

  const canSubmit =
    isRosterComplete &&
    areStarsChosen &&
    totalSalary <= PICK_SALARY_CAP &&
    !submissionsLocked;

  const rosterNhlIds = useMemo(() => {
    const out = [];
    for (const conf of ["East", "West"]) {
      for (const group of ["Forwards", "Defence", "Goalies"]) {
        for (const p of roster[conf][group]) out.push(p.nhl_id);
      }
    }
    return out;
  }, [roster]);

  async function submit() {
    setSubmitState({ status: "submitting", message: null });
    try {
      const res = await fetch("/api/picks/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pick_page_id: pickPageId,
          season,
          round: currentPoolRound,
          roster: rosterNhlIds,
          stars,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
      }
      setSubmitState({
        status: "submitted",
        message: `Submitted at ${json.submitted_at}`,
      });
      router.refresh();
    } catch (e) {
      setSubmitState({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function clearPicks() {
    if (submissionsLocked) return;
    setRoster(emptyRoster());
    setStars(emptyStars());
    setSubmitState({ status: "idle", message: null });
  }

  return (
    <div className="mt-6">
      {deadlineAt ? <DeadlineCountdown iso={deadlineAt} /> : (
        <p className="mt-3 text-center text-xs text-zinc-500">
          No deadline set for this round (commissioner can set one in Admin).
        </p>
      )}
      {submissionsLocked ? (
        <p className="mt-2 text-center text-sm font-semibold text-red-700">
          Submissions are closed for this round.
        </p>
      ) : null}

      {pickerMeta && pickerMeta.season ? (
        <div className="mt-3 space-y-2 text-center text-xs text-zinc-500">
          {pickerMeta.eligibleTeamFilterActive &&
          pickerMeta.eligibleFilterPoolRound != null &&
          pickerMeta.eligibleTeamAbbrevsSorted?.length ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-950 ring-1 ring-amber-200">
              <span className="font-semibold">Eligible-team filter (pool round{" "}
              {pickerMeta.eligibleFilterPoolRound}):</span> only players on{" "}
              <span className="font-mono">
                {pickerMeta.eligibleTeamAbbrevsSorted.join(", ")}
              </span>
              . This uses the Admin list for the same round as{" "}
              <span className="font-semibold">Current pool round</span> — not the
              other round sections. Change that dropdown or edit the matching
              eligible-teams block.
            </p>
          ) : null}
          <p>
            <span className="font-mono text-zinc-700">{pickerMeta.totalPlayersInSeason}</span>{" "}
            players synced for season{" "}
            <span className="font-mono text-zinc-700">{pickerMeta.season}</span>
            {pickerMeta.totalInPicker !== pickerMeta.totalPlayersInSeason ? (
              <>
                {" "}
                — showing{" "}
                <span className="font-mono text-zinc-700">{pickerMeta.totalInPicker}</span>{" "}
                after eligible-team rules.
              </>
            ) : (
              <> — all are in the picker.</>
            )}{" "}
            {pickerMeta.eligibleTeamFilterActive &&
            pickerMeta.totalInPicker < pickerMeta.totalPlayersInSeason
              ? "In Admin, clear eligible teams or add teams to see more players."
              : null}
          </p>
        </div>
      ) : !season ? (
        <p className="mt-3 text-center text-xs text-amber-800">
          No players in the database yet. In Admin, choose the playoff year and
          run <span className="font-semibold">Sync players</span>.
        </p>
      ) : null}

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="rounded-md border border-zinc-200 bg-white">
        <div className="flex gap-2 border-b border-zinc-200 p-3">
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
        <div className="flex gap-2 border-b border-zinc-200 p-3">
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

        <div className="overflow-x-auto">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-12" />
              <col />
              <col className="w-[3.25rem]" />
              <col className="w-[3.25rem]" />
              <col className="w-[3.25rem]" />
              <col className="w-[3.25rem]" />
            </colgroup>
            <thead className="border-b border-zinc-200 bg-zinc-100">
              <tr>
                <SortTh
                  label="Team"
                  colKey="team"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSortHeader}
                  disabled={submissionsLocked}
                />
                <SortTh
                  label="Player"
                  colKey="name"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={onSortHeader}
                  disabled={submissionsLocked}
                />
                <SortTh
                  label="R1"
                  colKey="r1"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  alignRight
                  onSort={onSortHeader}
                  disabled={submissionsLocked}
                />
                <SortTh
                  label="R2"
                  colKey="r2"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  alignRight
                  onSort={onSortHeader}
                  disabled={submissionsLocked}
                />
                <SortTh
                  label="P"
                  colKey="p"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  alignRight
                  onSort={onSortHeader}
                  disabled={submissionsLocked}
                />
                <SortTh
                  label="$"
                  colKey="salary"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  alignRight
                  onSort={onSortHeader}
                  disabled={submissionsLocked}
                />
              </tr>
            </thead>
            <tbody
              className={submissionsLocked ? "pointer-events-none opacity-50" : ""}
            >
              {players.length ? (
                players.map((p) => {
                  const hex = teamPrimaryHex(p.team_abbrev);
                  return (
                    <tr
                      key={p.nhl_id}
                      className={[
                        "border-b border-zinc-100",
                        selectedIds.has(p.nhl_id)
                          ? "bg-sky-100/70"
                          : "hover:bg-zinc-50",
                      ].join(" ")}
                    >
                      <td className="px-2 py-2">
                        <span
                          className="font-bold tabular-nums"
                          style={hex ? { color: hex } : { color: "#18181b" }}
                        >
                          {p.team_abbrev}
                        </span>
                      </td>
                      <td className="max-w-0 px-2 py-2 text-zinc-900">
                        <button
                          type="button"
                          className="block w-full truncate text-left hover:underline"
                          onClick={() => addPlayer(p)}
                        >
                          {p.name}
                        </button>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-zinc-900">
                        {p.stats?.r1 ?? 0}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-zinc-900">
                        {p.stats?.r2 ?? 0}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-zinc-900">
                        {p.stats?.total ?? 0}
                      </td>
                      <td className="px-2 py-2 text-right text-sm font-bold tabular-nums text-zinc-900">
                        {Number(p.salary || 0)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-xs text-zinc-500"
                  >
                    {!season ? (
                      <>Sync players in Admin after setting the playoff year.</>
                    ) : (pickerMeta?.totalInPicker ?? 0) === 0 ? (
                      <>
                        No players match the current filters (season{" "}
                        <span className="font-mono">{season}</span>
                        {pickerMeta?.eligibleTeamFilterActive
                          ? " — eligible teams in Admin may be excluding everyone"
                          : ""}
                        ). Run <span className="font-semibold">Sync players</span>{" "}
                        for that year or widen eligible teams.
                      </>
                    ) : (
                      <>
                        No {positionGroup.toLowerCase()} from the{" "}
                        {conference} in this list — try another tab, or check
                        Admin eligible teams / re-sync players.
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className={[
          "space-y-4",
          submissionsLocked ? "pointer-events-none opacity-50" : "",
        ].join(" ")}
      >
        {[
          ["East", "Forwards"],
          ["East", "Defence"],
          ["East", "Goalies"],
          ["West", "Forwards"],
          ["West", "Defence"],
          ["West", "Goalies"],
        ].map(([conf, group]) => {
          const max = maxSlots(conf, group);
          const cur = roster[conf][group];
          const slots = Array.from({ length: max }, (_, i) => cur[i] ?? null);

          return (
            <div key={`${conf}-${group}`}>
              <div className="text-xs font-semibold text-zinc-900">
                {conf} {group === "Goalies" ? "Goalie" : group}
              </div>
              <div className="mt-1 space-y-1">
                {slots.map((slot, idx) =>
                  slot ? (
                    <div
                      key={slot.nhl_id}
                      className="flex items-center gap-2 rounded bg-zinc-200/80 px-3 py-2 text-xs text-zinc-800"
                    >
                      <button
                        type="button"
                        className="flex h-8 w-8 shrink-0 items-center justify-center text-lg leading-none disabled:opacity-50"
                        onClick={() => toggleStar(conf, group, slot.nhl_id)}
                        aria-label={
                          stars[group] === slot.nhl_id
                            ? "Clear star"
                            : "Star player (double points)"
                        }
                        title="Star (double points)"
                        disabled={submissionsLocked}
                      >
                        {stars[group] === slot.nhl_id ? (
                          <span aria-hidden>⭐</span>
                        ) : (
                          <span className="text-zinc-400" aria-hidden>
                            ☆
                          </span>
                        )}
                      </button>
                      <span className="min-w-0 flex-1 truncate">
                        <span
                          className="font-bold"
                          style={
                            teamPrimaryHex(slot.team_abbrev)
                              ? { color: teamPrimaryHex(slot.team_abbrev) }
                              : { color: "#18181b" }
                          }
                        >
                          {slot.team_abbrev}
                        </span>{" "}
                        {slot.name}
                      </span>
                      <span className="shrink-0 tabular-nums font-semibold">
                        {Number(slot.salary || 0)}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 px-1 py-0.5 text-2xl font-light leading-none text-red-600 hover:text-red-700"
                        onClick={() => removePlayer(conf, group, slot.nhl_id)}
                        aria-label="Remove player"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div
                      key={`${conf}-${group}-${idx}`}
                      className="rounded bg-zinc-200/80 px-3 py-2 text-center text-xs text-zinc-500"
                    >
                      Empty Slot
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}

        <div className="pt-2 text-right text-xs font-semibold text-zinc-800">
          Total Value: <span className="tabular-nums">{totalSalary}</span> /{" "}
          <span className="tabular-nums">{PICK_SALARY_CAP}</span>
        </div>

        <div className="text-center text-xs font-medium">
          {submissionsLocked ? (
            <span className="text-zinc-600">🔒 This round is locked</span>
          ) : !isRosterComplete && !areStarsChosen ? (
            <span className="text-red-600">
              ⚠️ Team is incomplete ⭐ Choose a star at each position
            </span>
          ) : !isRosterComplete ? (
            <span className="text-red-600">⚠️ Team is incomplete</span>
          ) : !areStarsChosen ? (
            <span className="text-red-600">
              ⚠️ Choose a star at each position
            </span>
          ) : totalSalary > PICK_SALARY_CAP ? (
            <span className="text-red-600">
              {`⚠️ Over the $${PICK_SALARY_CAP} cap`}
            </span>
          ) : (
            <span className="text-emerald-700">Ready to submit</span>
          )}
        </div>

        <button
          className={[
            "w-full rounded-md py-3 text-sm font-semibold",
            canSubmit
              ? "bg-[#163a59] text-white hover:bg-[#12324d]"
              : "bg-zinc-300 text-zinc-600",
          ].join(" ")}
          type="button"
          disabled={!canSubmit}
          onClick={submit}
        >
          {submitState.status === "submitting" ? "Submitting…" : "Submit Team"}
        </button>

        <button
          className="w-full rounded-md bg-zinc-100 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-200 disabled:opacity-50"
          type="button"
          disabled={submissionsLocked}
          onClick={clearPicks}
        >
          Clear picks
        </button>

        {submitState.message ? (
          <div
            className={[
              "mt-3 rounded-md px-3 py-2 text-xs",
              submitState.status === "error"
                ? "bg-red-50 text-red-800 ring-1 ring-red-200"
                : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200",
            ].join(" ")}
          >
            {submitState.message}
          </div>
        ) : null}
      </div>
    </div>
    </div>
  );
}

