"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

function SortTh({
  label,
  colKey,
  sortKey,
  sortDir,
  alignRight,
  arrowAfterLabel,
  labelTruncate,
  onSort,
}) {
  const active = sortKey === colKey;
  const arrow = (
    <span
      className="inline-flex w-3 shrink-0 select-none items-center justify-center text-[10px] leading-none text-zinc-500"
      aria-hidden
    >
      {active ? (sortDir === "asc" ? "▲" : "▼") : <span className="invisible">▲</span>}
    </span>
  );
  const labelClass = labelTruncate
    ? "min-w-0 flex-1 truncate text-left"
    : "shrink-0 whitespace-nowrap";
  return (
    <th
      scope="col"
      className={[
        "px-2 py-2.5 text-xs font-black text-zinc-900 align-middle",
        alignRight ? "text-right" : "text-left",
      ].join(" ")}
      aria-sort={
        active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(colKey)}
        className={[
          "flex min-h-[1.25rem] w-full min-w-0 max-w-full items-center gap-1 px-0.5",
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

function compareRows(a, b, sortKey, sortDir) {
  const m = sortDir === "asc" ? 1 : -1;
  const tieName = () =>
    String(a.name || "").localeCompare(String(b.name || "")) * m;
  switch (sortKey) {
    case "team":
      return tieName();
    case "r1": {
      const c = (Number(a.r1) - Number(b.r1)) * m;
      return c !== 0 ? c : tieName();
    }
    case "r2": {
      const c = (Number(a.r2) - Number(b.r2)) * m;
      return c !== 0 ? c : tieName();
    }
    case "r34": {
      const c = (Number(a.r34) - Number(b.r34)) * m;
      return c !== 0 ? c : tieName();
    }
    case "total":
    default: {
      const c = (Number(a.total) - Number(b.total)) * m;
      return c !== 0 ? c : tieName();
    }
  }
}

export default function StandingsClient({ rows = [] }) {
  const [sortKey, setSortKey] = useState("total");
  const [sortDir, setSortDir] = useState("desc");

  function onSort(colKey) {
    if (sortKey === colKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(colKey);
      setSortDir(colKey === "team" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const next = [...(rows ?? [])];
    next.sort((a, b) => compareRows(a, b, sortKey, sortDir));
    return next;
  }, [rows, sortKey, sortDir]);

  /** Team column wider so names can wrap on mobile; R1–R3+4–Tot stay equal width. */
  const teamColBody =
    "w-[36%] min-w-0 px-2 py-1.5 text-left align-top break-words [overflow-wrap:anywhere]";
  const numColBody = "w-[16%] min-w-0 px-2 py-1.5 align-top text-right tabular-nums";

  return (
    <div className="mt-10 overflow-x-auto rounded-md">
      <table className="w-full min-w-0 table-fixed text-sm sm:min-w-[28rem]">
        <thead>
          <tr className="border-b border-zinc-300 text-zinc-900">
            <SortTh
              label="Team"
              colKey="team"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              arrowAfterLabel
              labelTruncate
            />
            <SortTh
              label="R1"
              colKey="r1"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              alignRight
            />
            <SortTh
              label="R2"
              colKey="r2"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              alignRight
            />
            <SortTh
              label="R3+4"
              colKey="r34"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              alignRight
            />
            <SortTh
              label="Total"
              colKey="total"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              alignRight
            />
          </tr>
        </thead>
        <tbody className="text-zinc-900">
          {sorted.map((r) => (
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
  );
}

