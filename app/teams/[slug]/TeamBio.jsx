function normalizeExternalUrl(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t}`;
}

export default function TeamBio({ location, fav, linkedin }) {
  const loc = String(location ?? "").trim();
  const favorite = String(fav ?? "").trim();
  const linkUrl = normalizeExternalUrl(linkedin);

  if (!loc && !favorite && !linkUrl) {
    return null;
  }

  return (
    <p className="mt-3 text-[16px] leading-[1.2] text-zinc-800">
      {loc ? (
        <>
          Lives in {loc}
          <br />
        </>
      ) : null}
      {favorite ? (
        <>
          wears {favorite} pyjamas
          <br />
        </>
      ) : null}
      {linkUrl ? (
        <>
          learn more{" "}
          <a
            className="underline"
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            here
          </a>
          .
        </>
      ) : (
        <>learn more here.</>
      )}
    </p>
  );
}
