"use client";

/**
 * Renders deadline in the viewer's local timezone.
 * `suppressHydrationWarning`: server (Node TZ) and browser locale strings differ; client wins after hydrate.
 */
export default function DeadlineAtForViewer({ iso }) {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  // `timeZoneName` cannot be combined with `dateStyle`/`timeStyle` (throws in Node RSC).
  const text = d.toLocaleString(undefined, {
    dateStyle: "full",
    timeStyle: "short",
  });

  return (
    <span className="font-semibold" suppressHydrationWarning>
      {text}
    </span>
  );
}
