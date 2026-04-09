"use client";

import { useEffect, useMemo, useState } from "react";
import { playoffYearToSeasonId } from "@/lib/nhl/season";
import {
  utcIsoToEasternDatetimeLocalInput,
  easternDatetimeLocalInputToUtcIso,
} from "@/lib/deadline-timezone";

function buildYearOptions() {
  // “Playoff year” as shown in the NHL bracket endpoint.
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);
  return years;
}

function teamSetFromSettings(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return new Set();
  return new Set(arr.map((a) => String(a).toUpperCase()));
}

function EligibleTeamsRoundAccordion({
  title,
  playoffTeams,
  loadStatus,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
}) {
  const n = selected.size;
  const total = playoffTeams.length;
  const ready = loadStatus === "ok" && total > 0;
  return (
    <details className="rounded-lg border border-zinc-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm font-semibold text-zinc-900 select-none [&::-webkit-details-marker]:hidden">
        <span>{title}</span>
        <span className="text-xs font-normal tabular-nums text-zinc-500">
          {loadStatus === "loading"
            ? "Loading…"
            : loadStatus === "error"
              ? "—"
              : n === 0
                ? "All playoff teams (no restriction)"
                : `${n} / ${total} playoff teams`}
        </span>
      </summary>
      <div className="space-y-2 border-t border-zinc-200 p-3">
        <p className="text-xs text-zinc-500">
          Only clubs in the NHL playoff bracket for the selected playoff year
          appear here (same source as Sync players). If none are checked, every
          synced playoff player is available for this round.
        </p>
        {loadStatus === "loading" ? (
          <p className="text-xs text-zinc-600">Loading teams from bracket…</p>
        ) : loadStatus === "error" || total === 0 ? (
          <p className="text-xs text-amber-800">
            Playoff teams could not be loaded. Fix the error above or try
            another year.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                disabled={!ready}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectAll();
                }}
              >
                Select all
              </button>
              <button
                type="button"
                className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                disabled={!ready}
                onClick={(e) => {
                  e.preventDefault();
                  onClearAll();
                }}
              >
                Clear all
              </button>
            </div>
            <div className="grid max-h-52 grid-cols-4 gap-x-2 gap-y-1.5 overflow-y-auto sm:grid-cols-6 md:grid-cols-8">
              {playoffTeams.map(({ abbrev, name }) => (
                <label
                  key={abbrev}
                  className="flex cursor-pointer items-center gap-1.5 text-xs text-zinc-800"
                  title={name}
                >
                  <input
                    type="checkbox"
                    className="rounded border-zinc-300"
                    checked={selected.has(abbrev)}
                    onChange={() => onToggle(abbrev)}
                  />
                  {abbrev}
                </label>
              ))}
            </div>
          </>
        )}
      </div>
    </details>
  );
}

export default function AdminClient() {
  const yearOptions = useMemo(() => buildYearOptions(), []);
  const [year, setYear] = useState(2025);
  const season = useMemo(() => playoffYearToSeasonId(year), [year]);
  const [statsLimit, setStatsLimit] = useState(50);
  const [statsOffset, setStatsOffset] = useState(0);
  const [statsConcurrency, setStatsConcurrency] = useState(2);
  const [regLimit, setRegLimit] = useState(25);
  const [regOffset, setRegOffset] = useState(0);
  const [running, setRunning] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const [adminPassword, setAdminPassword] = useState("");
  const [poolCurrentRound, setPoolCurrentRound] = useState(1);
  const [deadlineR1, setDeadlineR1] = useState("");
  const [deadlineR2, setDeadlineR2] = useState("");
  const [deadlineR3, setDeadlineR3] = useState("");
  const [poolLoadError, setPoolLoadError] = useState(null);
  const [poolSaving, setPoolSaving] = useState(false);
  const [poolSaveResult, setPoolSaveResult] = useState(null);
  const [eligibleR1, setEligibleR1] = useState(() => new Set());
  const [eligibleR2, setEligibleR2] = useState(() => new Set());
  const [eligibleR3, setEligibleR3] = useState(() => new Set());
  const [playoffEligibleTeams, setPlayoffEligibleTeams] = useState([]);
  const [playoffEligibleStatus, setPlayoffEligibleStatus] = useState("loading");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setPoolLoadError(null);
      setPlayoffEligibleStatus("loading");
      try {
        const [poolRes, playoffRes] = await Promise.all([
          fetch(`/api/pool-settings?season=${encodeURIComponent(season)}`),
          fetch(`/api/playoff-teams?year=${year}`),
        ]);
        const poolJson = await poolRes.json().catch(() => null);
        const playoffJson = await playoffRes.json().catch(() => null);
        if (!poolRes.ok) {
          throw new Error(poolJson?.error || `Pool settings HTTP ${poolRes.status}`);
        }
        if (!playoffRes.ok || !playoffJson?.ok) {
          throw new Error(
            playoffJson?.error || `Playoff teams HTTP ${playoffRes.status}`
          );
        }
        if (cancelled) return;

        const allowed = new Set(playoffJson.teams.map((t) => t.abbrev));
        setPlayoffEligibleTeams(playoffJson.teams);
        setPlayoffEligibleStatus("ok");

        const s = poolJson.settings;
        setPoolCurrentRound(s.current_round ?? 1);
        setDeadlineR1(utcIsoToEasternDatetimeLocalInput(s.deadline_r1));
        setDeadlineR2(utcIsoToEasternDatetimeLocalInput(s.deadline_r2));
        setDeadlineR3(utcIsoToEasternDatetimeLocalInput(s.deadline_r3));
        setEligibleR1(
          new Set(
            [...teamSetFromSettings(s.eligible_teams_r1)].filter((a) =>
              allowed.has(a)
            )
          )
        );
        setEligibleR2(
          new Set(
            [...teamSetFromSettings(s.eligible_teams_r2)].filter((a) =>
              allowed.has(a)
            )
          )
        );
        setEligibleR3(
          new Set(
            [...teamSetFromSettings(s.eligible_teams_r3)].filter((a) =>
              allowed.has(a)
            )
          )
        );
      } catch (e) {
        if (!cancelled) {
          setPoolLoadError(e instanceof Error ? e.message : String(e));
          setPlayoffEligibleStatus("error");
          setPlayoffEligibleTeams([]);
          setEligibleR1(new Set());
          setEligibleR2(new Set());
          setEligibleR3(new Set());
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [season, year]);

  async function savePoolSettings() {
    setPoolSaving(true);
    setPoolSaveResult(null);
    setError(null);
    try {
      const r1Iso = deadlineR1
        ? easternDatetimeLocalInputToUtcIso(deadlineR1)
        : null;
      const r2Iso = deadlineR2
        ? easternDatetimeLocalInputToUtcIso(deadlineR2)
        : null;
      const r3Iso = deadlineR3
        ? easternDatetimeLocalInputToUtcIso(deadlineR3)
        : null;
      if (deadlineR1 && r1Iso == null) {
        throw new Error(
          "Round 1 deadline could not be read as Eastern Time. Check the date and time."
        );
      }
      if (deadlineR2 && r2Iso == null) {
        throw new Error(
          "Round 2 deadline could not be read as Eastern Time. Check the date and time."
        );
      }
      if (deadlineR3 && r3Iso == null) {
        throw new Error(
          "Round 3+4 deadline could not be read as Eastern Time. Check the date and time."
        );
      }
      const body = {
        season,
        current_round: poolCurrentRound,
        deadline_r1: r1Iso,
        deadline_r2: r2Iso,
        deadline_r3: r3Iso,
        eligible_teams_r1:
          eligibleR1.size > 0 ? [...eligibleR1].sort() : null,
        eligible_teams_r2:
          eligibleR2.size > 0 ? [...eligibleR2].sort() : null,
        eligible_teams_r3:
          eligibleR3.size > 0 ? [...eligibleR3].sort() : null,
        admin_password: adminPassword,
      };
      const res = await fetch("/api/pool-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setPoolSaveResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPoolSaving(false);
    }
  }

  async function run(label, url) {
    setRunning(label);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(url, { method: "GET" });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
      }
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-3 text-sm text-zinc-600">
        Set the season, load roster data, keep the participant list current,
        configure each pool round, then sync playoff stats as games finish.
      </p>

      <div className="mt-8 flex flex-col gap-6">
        {/* 1. Season */}
        <div className="flex flex-col gap-3 rounded-xl border border-black/10 p-4">
          <div className="text-sm font-semibold text-zinc-900">
            Season (NHL year)
          </div>
          <p className="text-xs text-zinc-600">
            Start here each year. All NHL syncs below use this playoff year and
            the derived Supabase season id.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <label className="text-sm font-medium text-zinc-900">
              Playoff year
              <select
                className="ml-2 w-48 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-xs text-zinc-500">
              (e.g. use 2025 to test last season&apos;s playoffs)
            </span>
            <span className="text-xs font-mono text-zinc-600">
              Season id: {season}
            </span>
          </div>
        </div>

        {/* 2. Roster and regular season */}
        <div className="flex flex-col gap-4 rounded-xl border border-black/10 p-4">
          <div className="text-sm font-semibold text-zinc-900">
            Roster and regular season
          </div>
          <p className="text-xs text-zinc-600">
            Run once you are on the correct year. Salaries are edited in Supabase.
            After your Round 1 pick deadline, you typically leave players and
            regular-season points alone until next year; rerun players if the
            bracket or rosters change before then.
          </p>
          <button
            className="w-fit rounded-xl border border-black/10 px-4 py-3 text-left text-sm hover:bg-black/[.02] disabled:opacity-50"
            type="button"
            disabled={!!running}
            onClick={() => run("players", `/api/sync-players?year=${year}`)}
          >
            {running === "players"
              ? "Syncing players…"
              : "Sync players (NHL bracket & rosters → Supabase)"}
          </button>
          <div className="flex flex-col gap-3 border-t border-zinc-200 pt-4">
            <div className="text-xs font-medium text-zinc-800">
              Regular season points (batched)
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <label className="text-sm text-zinc-700">
                Limit
                <input
                  className="ml-2 w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                  inputMode="numeric"
                  value={regLimit}
                  onChange={(e) => setRegLimit(Number(e.target.value || 0))}
                />
              </label>
              <label className="text-sm text-zinc-700">
                Offset
                <input
                  className="ml-2 w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                  inputMode="numeric"
                  value={regOffset}
                  onChange={(e) => setRegOffset(Number(e.target.value || 0))}
                />
              </label>
              <button
                className="w-fit rounded-xl border border-black/10 px-4 py-2 text-sm hover:bg-black/[.02] disabled:opacity-50"
                type="button"
                disabled={!!running}
                onClick={() =>
                  run(
                    "regularSeason",
                    `/api/sync-regular-season?year=${year}&limit=${regLimit}&offset=${regOffset}&concurrency=1`
                  )
                }
              >
                {running === "regularSeason"
                  ? "Syncing regular season…"
                  : "Sync regular season points"}
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              Writes to <code className="rounded bg-zinc-100 px-1">players.season_points</code>{" "}
              (add the column in Supabase if missing). Advance offset until the
              full roster is covered.
            </p>
          </div>
        </div>

        {/* 3. Participants */}
        <div className="flex flex-col gap-4 rounded-xl border border-black/10 p-4">
          <div className="text-sm font-semibold text-zinc-900">
            Participants
          </div>
          <p className="text-xs text-zinc-600">
            Re-run while people sign up from the Google Sheet. After Round 1
            picks lock, you usually stop syncing until next season.
          </p>
          <button
            className="w-fit rounded-xl border border-black/10 px-4 py-3 text-left text-sm hover:bg-black/[.02] disabled:opacity-50"
            type="button"
            disabled={!!running}
            onClick={() => run("participants", "/api/sync-participants")}
          >
            {running === "participants"
              ? "Syncing participants…"
              : "Sync participants (Sheet → Supabase)"}
          </button>
        </div>

        {/* 4. Pool rounds and picks */}
        <div className="flex flex-col gap-4 rounded-xl border border-black/10 p-4">
          <div className="text-sm font-semibold text-zinc-900">
            Pool rounds and picks
          </div>
          <p className="text-xs text-zinc-600">
            Three pool rounds: R1, R2, and R3+4 (one pick window for NHL
            conference final + Cup).{" "}
            <span className="font-medium text-zinc-900">Current pool round</span>{" "}
            controls which pick window is open on the site and what submit
            accepts.             Set each round&apos;s deadline and which NHL teams may
            appear on the pick list before you advance. Deadlines are
            entered in US Eastern Time (New York, EST/EDT); the picks page
            shows each participant the same moment in their own time zone.
          </p>
          {poolLoadError ? (
            <p className="text-xs text-amber-800">
              Could not load settings (create{" "}
              <code className="rounded bg-zinc-100 px-1">pool_settings</code> in
              Supabase if missing): {poolLoadError}
            </p>
          ) : null}

          <label className="text-sm font-medium text-zinc-900">
            Current pool round (open for picks)
            <select
              className="ml-2 mt-1 block w-full max-w-xs rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm sm:ml-2 sm:mt-0 sm:inline-block"
              value={poolCurrentRound}
              onChange={(e) => setPoolCurrentRound(Number(e.target.value))}
            >
              <option value={1}>Round 1</option>
              <option value={2}>Round 2</option>
              <option value={3}>Round 3 + 4 (R3+4)</option>
            </select>
          </label>
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950 ring-1 ring-amber-200">
            The picks page only applies <span className="font-semibold">one</span>{" "}
            eligible-team list: the block below that matches this dropdown (Round
            1 / 2 / 3+4). If you set teams under &quot;Round 2&quot; but leave
            <span className="font-semibold"> Current pool round</span> on Round 1,
            participants still see Round 1&apos;s team list — not Round 2&apos;s.
          </p>

          <div className="space-y-4 border-t border-zinc-200 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Round 1
            </div>
            <label className="block text-xs text-zinc-700">
              Deadline R1 (Eastern Time)
              <input
                className="mt-1 w-full max-w-xs rounded-md border border-zinc-300 px-2 py-1 text-sm"
                type="datetime-local"
                value={deadlineR1}
                onChange={(e) => setDeadlineR1(e.target.value)}
              />
            </label>
            <EligibleTeamsRoundAccordion
              title="Eligible teams — pool round 1 (used when Current pool round is Round 1)"
              playoffTeams={playoffEligibleTeams}
              loadStatus={playoffEligibleStatus}
              selected={eligibleR1}
              onToggle={(abbr) =>
                setEligibleR1((prev) => {
                  const next = new Set(prev);
                  if (next.has(abbr)) next.delete(abbr);
                  else next.add(abbr);
                  return next;
                })
              }
              onSelectAll={() =>
                setEligibleR1(new Set(playoffEligibleTeams.map((t) => t.abbrev)))
              }
              onClearAll={() => setEligibleR1(new Set())}
            />
          </div>

          <div className="space-y-4 border-t border-zinc-200 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Round 2
            </div>
            <label className="block text-xs text-zinc-700">
              Deadline R2 (Eastern Time)
              <input
                className="mt-1 w-full max-w-xs rounded-md border border-zinc-300 px-2 py-1 text-sm"
                type="datetime-local"
                value={deadlineR2}
                onChange={(e) => setDeadlineR2(e.target.value)}
              />
            </label>
            <EligibleTeamsRoundAccordion
              title="Eligible teams — pool round 2 (used when Current pool round is Round 2)"
              playoffTeams={playoffEligibleTeams}
              loadStatus={playoffEligibleStatus}
              selected={eligibleR2}
              onToggle={(abbr) =>
                setEligibleR2((prev) => {
                  const next = new Set(prev);
                  if (next.has(abbr)) next.delete(abbr);
                  else next.add(abbr);
                  return next;
                })
              }
              onSelectAll={() =>
                setEligibleR2(new Set(playoffEligibleTeams.map((t) => t.abbrev)))
              }
              onClearAll={() => setEligibleR2(new Set())}
            />
          </div>

          <div className="space-y-4 border-t border-zinc-200 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Round 3 + 4 (R3+4)
            </div>
            <label className="block text-xs text-zinc-700">
              Deadline R3+4 (Eastern Time)
              <input
                className="mt-1 w-full max-w-xs rounded-md border border-zinc-300 px-2 py-1 text-sm"
                type="datetime-local"
                value={deadlineR3}
                onChange={(e) => setDeadlineR3(e.target.value)}
              />
            </label>
            <EligibleTeamsRoundAccordion
              title="Eligible teams — pool round 3 + 4 (used when Current pool round is R3+4)"
              playoffTeams={playoffEligibleTeams}
              loadStatus={playoffEligibleStatus}
              selected={eligibleR3}
              onToggle={(abbr) =>
                setEligibleR3((prev) => {
                  const next = new Set(prev);
                  if (next.has(abbr)) next.delete(abbr);
                  else next.add(abbr);
                  return next;
                })
              }
              onSelectAll={() =>
                setEligibleR3(new Set(playoffEligibleTeams.map((t) => t.abbrev)))
              }
              onClearAll={() => setEligibleR3(new Set())}
            />
          </div>

          <div className="space-y-3 border-t border-zinc-200 pt-4">
            <label className="text-sm text-zinc-700">
              Admin password
              <input
                className="ml-2 mt-1 block w-full max-w-xs rounded-md border border-zinc-300 px-2 py-1 text-sm sm:ml-2 sm:mt-0 sm:inline-block sm:w-56"
                type="password"
                autoComplete="current-password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="ADMIN_PASSWORD from env"
              />
            </label>
            <button
              className="w-fit rounded-xl border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/[.02] disabled:opacity-50"
              type="button"
              disabled={poolSaving}
              onClick={() => savePoolSettings()}
            >
              {poolSaving ? "Saving…" : "Save pool settings"}
            </button>
            {poolSaveResult ? (
              <pre className="overflow-x-auto rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                {JSON.stringify(poolSaveResult, null, 2)}
              </pre>
            ) : null}
          </div>
        </div>

        {/* 5. Playoff stats */}
        <div className="flex flex-col gap-4 rounded-xl border border-black/10 p-4">
          <div className="text-sm font-semibold text-zinc-900">
            Playoff stats (NHL)
          </div>
          <p className="text-xs text-zinc-600">
            Batched sync from NHL playoff game logs. After each batch, use{" "}
            <code className="rounded bg-zinc-100 px-1">next_offset</code> in the
            response and run again until finished. During the playoffs, run
            daily (or automate with a cron job). Keep concurrency low to avoid
            rate limits.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <label className="text-sm text-zinc-700">
              Limit
              <input
                className="ml-2 w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                inputMode="numeric"
                value={statsLimit}
                onChange={(e) => setStatsLimit(Number(e.target.value || 0))}
              />
            </label>
            <label className="text-sm text-zinc-700">
              Offset
              <input
                className="ml-2 w-24 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                inputMode="numeric"
                value={statsOffset}
                onChange={(e) => setStatsOffset(Number(e.target.value || 0))}
              />
            </label>
            <label className="text-sm text-zinc-700">
              Concurrency
              <input
                className="ml-2 w-20 rounded-md border border-zinc-300 px-2 py-1 text-sm"
                inputMode="numeric"
                value={statsConcurrency}
                onChange={(e) =>
                  setStatsConcurrency(Math.max(1, Number(e.target.value || 1)))
                }
              />
            </label>
            <button
              className="w-fit rounded-xl border border-black/10 px-4 py-2 text-sm hover:bg-black/[.02] disabled:opacity-50"
              type="button"
              disabled={!!running}
              onClick={() =>
                run(
                  "stats",
                  `/api/sync-stats?year=${year}&limit=${statsLimit}&offset=${statsOffset}&concurrency=${statsConcurrency}`
                )
              }
            >
              {running === "stats"
                ? "Syncing stats…"
                : "Sync playoff stats (NHL → Supabase)"}
            </button>
          </div>
        </div>

        {error ? (
          <pre className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
            {error}
          </pre>
        ) : null}

        {result ? (
          <pre className="overflow-x-auto rounded-xl border border-black/10 bg-white p-4 text-xs text-zinc-800">
            {JSON.stringify(result, null, 2)}
          </pre>
        ) : null}
      </div>
    </main>
  );
}

