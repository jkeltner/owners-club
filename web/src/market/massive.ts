// Daily closes from Massive (formerly Polygon): one "grouped daily" call returns
// every US stock's bar for one date, so a day of prices is one request. The free
// plan is end-of-day only with two years of history and five requests a minute,
// which is all the nightly job needs; a backfill paces itself.
import { fetchJson, sleep } from "./http";

export const INDEX_FUND_TICKER = "SPY"; // stands in for the S&P 500 holding

type GroupedDaily = {
  status: string;
  resultsCount: number;
  results?: { T: string; c: number; v: number; t: number }[];
};

export type DailyClose = { ticker: string; date: string; close: number; volume: number };

function apiKey() {
  const key = process.env.MASSIVE_API_KEY;
  if (!key) throw new Error("MASSIVE_API_KEY is not set");
  return key;
}

/** Every US stock's close for one trading day (YYYY-MM-DD). Empty on a market holiday. */
export async function fetchGroupedDaily(date: string): Promise<DailyClose[]> {
  const url = `https://api.massive.com/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true`;
  const res = await fetchJson<GroupedDaily>(url, { headers: { Authorization: `Bearer ${apiKey()}` } });
  return (res.results ?? []).map((r) => ({ ticker: r.T, date, close: r.c, volume: r.v }));
}

type Aggs = { results?: { c: number; v: number; t: number }[] };

/** One ticker's daily closes over a date range, for backfills. */
export async function fetchDailyRange(ticker: string, from: string, to: string): Promise<DailyClose[]> {
  const url = `https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=50000`;
  const res = await fetchJson<Aggs>(url, { headers: { Authorization: `Bearer ${apiKey()}` } });
  return (res.results ?? []).map((r) => ({ ticker, date: new Date(r.t).toISOString().slice(0, 10), close: r.c, volume: r.v }));
}

/** Pause to stay inside the free plan's five requests a minute. */
export const massiveFreeTierPause = () => sleep(12_500);

/** Trading days (Mon–Fri, not a holiday check) from `from` to `to` inclusive, YYYY-MM-DD. */
export function weekdaysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
