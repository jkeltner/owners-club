// Shared fetch helpers for the data adapters: one place for the User-Agent the
// SEC requires, retries on transient failures, and a pause between calls so a
// backfill stays under every provider's rate limit.

export const USER_AGENT = process.env.MARKET_USER_AGENT ?? "Owners Club (github.com/jkeltner/owners-club)";

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    body: string,
  ) {
    super(`HTTP ${status} from ${url}: ${body.slice(0, 200)}`);
  }
}

export async function fetchWithRetry(url: string, init: RequestInit = {}, tries = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, { ...init, headers: { "User-Agent": USER_AGENT, ...(init.headers ?? {}) } });
      if (res.ok) return res;
      const body = await res.text();
      // 404 is an answer (no data for that frame or symbol), not a failure to retry.
      if (res.status === 404 || res.status < 500 && res.status !== 429) throw new HttpError(res.status, url, body);
      lastError = new HttpError(res.status, url, body);
    } catch (err) {
      if (err instanceof HttpError && (err.status === 404 || err.status < 500 && err.status !== 429)) throw err;
      lastError = err;
    }
    await sleep(500 * 2 ** attempt);
  }
  throw lastError;
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithRetry(url, init);
  return (await res.json()) as T;
}

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetchWithRetry(url, init);
  return res.text();
}

/** Strips tags and collapses whitespace in a fragment of HTML. */
export const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#160;|&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
