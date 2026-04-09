const NHL_API_BASE_URL = "https://api-web.nhle.com/v1/";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfterSeconds(headerValue) {
  if (!headerValue) return null;
  const n = Number(headerValue);
  if (Number.isFinite(n)) return Math.max(0, n);
  const dateMs = Date.parse(headerValue);
  if (Number.isFinite(dateMs)) {
    const diff = Math.ceil((dateMs - Date.now()) / 1000);
    return Math.max(0, diff);
  }
  return null;
}

export async function nhlFetch(path, init = {}) {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path).slice(1)
    : String(path || "");
  const url = new URL(normalizedPath, NHL_API_BASE_URL);
  const maxRetries = init.maxRetries ?? 6;
  const baseDelayMs = init.baseDelayMs ?? 1200;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.headers ?? {}),
      },
      cache: init.cache ?? "no-store",
    });

    if (res.ok) return res.json();

    const body = await res.text().catch(() => "");

    // Cloudflare rate-limit / NHL throttling.
    if (res.status === 429 && attempt < maxRetries) {
      const retryAfterSec = parseRetryAfterSeconds(res.headers.get("retry-after"));
      const jitter = Math.floor(Math.random() * 250);
      const backoffMs = Math.min(60_000, baseDelayMs * 2 ** attempt) + jitter;
      const delayMs = retryAfterSec != null ? retryAfterSec * 1000 : backoffMs;
      await sleep(delayMs);
      continue;
    }

    throw new Error(`NHL API ${res.status} ${res.statusText}: ${body}`);
  }

  throw new Error("NHL API request failed after retries.");
}

