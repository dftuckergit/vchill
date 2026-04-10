"use client";

import { useMemo, useState } from "react";
import { teamPrimaryHex } from "@/lib/nhl/team-primary-colors";

function slotLabel(p) {
  const conf = p?.conference === "West" ? "West" : p?.conference === "East" ? "East" : "";
  const pos = p?.position || "";
  return `${conf} ${pos}`.trim();
}

function RoundBlock({ title, picks, total, picksRevealed }) {
  const rows = picks?.length ? picks : [];
  return (
    <div>
      <h2 className="text-xs font-bold tracking-wide text-zinc-900">{title}</h2>
      <div className="mt-3 space-y-2.5">
        {!picksRevealed ? (
          <p className="text-xs text-zinc-500">
            Picks stay private until after this round&apos;s deadline.
          </p>
        ) : rows.length ? (
          rows.map((p) => {
            const hex = teamPrimaryHex(p.team_abbrev);
            return (
              <div
                key={`${p.round ?? ""}:${p.nhl_id ?? p.player_id}`}
                className="flex items-baseline gap-2 text-sm"
              >
                <span className="w-14 shrink-0 text-xs text-zinc-500">
                  {slotLabel(p)}
                </span>
                <span className="min-w-0 flex-1 truncate text-zinc-900">
                  {p.is_star ? (
                    <span className="mr-0.5" aria-label="Star pick">
                      ⭐
                    </span>
                  ) : null}
                  <span
                    className="font-bold"
                    style={hex ? { color: hex } : { color: "#18181b" }}
                  >
                    {p.team_abbrev}
                  </span>{" "}
                  <span className="font-normal">{p.name}</span>
                </span>
                <span className="w-10 shrink-0 text-right text-sm font-bold tabular-nums text-zinc-900">
                  {p.points}
                </span>
              </div>
            );
          })
        ) : (
          <div className="text-xs text-zinc-500">No picks submitted yet.</div>
        )}
        <div className="border-t border-zinc-200 pt-2 text-sm font-bold text-zinc-900">
          TOTAL{" "}
          <span className="float-right tabular-nums">
            {picksRevealed ? total : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function compareLabel(poolRound) {
  if (poolRound === 1) return "ROUND 1";
  if (poolRound === 2) return "ROUND 2";
  return "ROUND 3 + 4";
}

export default function TeamClient({
  season,
  currentPoolRound = 1,
  picksRevealedByRound = { 1: true, 2: true, 3: true },
  meSummary,
  teams,
}) {
  const [compareId, setCompareId] = useState("");
  const [compareState, setCompareState] = useState({ status: "idle", summary: null });

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
      if (!res.ok) throw new Error(json?.error || json?.message || `HTTP ${res.status}`);
      setCompareState({ status: "loaded", summary: json.summary });
    } catch (e) {
      setCompareState({
        status: "error",
        summary: {
          participant: { name: e instanceof Error ? e.message : String(e) },
          totals: { r1: 0, r2: 0, r34: 0, total: 0 },
        },
      });
    }
  }

  const meR34Picks = meSummary?.rounds?.[3]?.picks ?? [];

  const myCompareTotal =
    currentPoolRound === 1
      ? (meSummary?.totals?.r1 ?? 0)
      : currentPoolRound === 2
        ? (meSummary?.totals?.r2 ?? 0)
        : (meSummary?.totals?.r34 ?? 0);

  const theirCompareTotal =
    currentPoolRound === 1
      ? (compareState.summary?.totals?.r1 ?? 0)
      : currentPoolRound === 2
        ? (compareState.summary?.totals?.r2 ?? 0)
        : (compareState.summary?.totals?.r34 ?? 0);

  const compareRevealed = picksRevealedByRound[currentPoolRound] !== false;

  return (
    <>
      <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-10 text-left text-sm">
        <RoundBlock
          title="ROUND 1"
          picks={meSummary?.rounds?.[1]?.picks}
          total={meSummary?.totals?.r1 ?? 0}
          picksRevealed={picksRevealedByRound[1]}
        />
        <RoundBlock
          title="ROUND 2"
          picks={meSummary?.rounds?.[2]?.picks}
          total={meSummary?.totals?.r2 ?? 0}
          picksRevealed={picksRevealedByRound[2]}
        />
        <RoundBlock
          title="ROUND 3 + 4"
          picks={meR34Picks}
          total={meSummary?.totals?.r34 ?? 0}
          picksRevealed={picksRevealedByRound[3]}
        />
      </div>

      <h2 className="font-display mt-14 text-center text-[32px] leading-[1.0] font-bold text-[#163a59]">
        Compare to
      </h2>
      <div className="mx-auto mt-8 flex max-w-2xl items-start justify-between gap-10">
        <div className="w-full text-left text-sm">
          <h3 className="text-xs font-semibold tracking-wide text-zinc-900">
            {compareLabel(currentPoolRound)} — you
          </h3>
          <div className="mt-3 space-y-2">
            <div className="flex justify-between gap-3 text-zinc-800">
              <span className="text-zinc-600">Your total</span>
              <span className="tabular-nums font-semibold">
                {compareRevealed ? myCompareTotal : "—"}
              </span>
            </div>
            {!compareRevealed ? (
              <p className="text-xs text-zinc-500">
                Compare totals stay hidden until after this round&apos;s deadline.
              </p>
            ) : null}
            <div className="text-xs text-zinc-500">
              {compareState.status === "loading"
                ? "Loading…"
                : compareState.status === "error"
                  ? "Couldn’t load comparison."
                  : "Select a team to compare."}
            </div>
            <div className="pt-2 font-semibold text-zinc-900">
              Their total{" "}
              <span className="float-right tabular-nums">
                {compareRevealed ? theirCompareTotal : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className="w-64">
          <select
            className="w-full rounded-full border border-zinc-300 bg-zinc-100 px-4 py-2.5 text-sm text-zinc-900"
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
          <div className="mt-6 rounded-md bg-white p-4 text-sm shadow-sm ring-1 ring-black/5">
            <div className="text-xs font-semibold tracking-wide text-zinc-900">
              {compareLabel(currentPoolRound)}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="font-semibold">THEIR TOTAL</span>
              <span className="tabular-nums">
                {compareRevealed ? theirCompareTotal : "—"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

