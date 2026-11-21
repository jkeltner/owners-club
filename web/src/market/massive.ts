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

type DividendPage = {
  results?: { id: string; ticker: string; ex_dividend_date: string; pay_date?: string; cash_amount: number; currency?: string; dividend_type?: string; frequency?: number }[];
  next_url?: string;
};

export type Dividend = { id: string; ticker: string; exDate: string; payDate: string | null; cash: number; kind: string | null; perYear: number | null };

/**
 * Cash dividends, by ex-dividend date: the whole market between two dates, or
 * one company's. The whole market runs to about 280 a day, so a week is two
 * pages; every page after the first waits out the free plan's limit. Only US
 * dollar amounts are kept.
 */
export async function fetchDividends(q: { from: string; to?: string; ticker?: string }, maxPages = 5): Promise<Dividend[]> {
  const params = new URLSearchParams({ "ex_dividend_date.gte": q.from, limit: "1000", sort: "ex_dividend_date", order: "asc" });
  if (q.to) params.set("ex_dividend_date.lte", q.to);
  if (q.ticker) params.set("ticker", q.ticker);
  let url: string | undefined = `https://api.massive.com/v3/reference/dividends?${params}`;
  const out: Dividend[] = [];
  for (let page = 0; url && page < maxPages; page++) {
    if (page > 0) await massiveFreeTierPause();
    const res: DividendPage = await fetchJson<DividendPage>(url, { headers: { Authorization: `Bearer ${apiKey()}` } });
    for (const r of res.results ?? []) {
      if ((r.currency ?? "USD") !== "USD" || !(r.cash_amount > 0)) continue;
      out.push({ id: r.id, ticker: r.ticker, exDate: r.ex_dividend_date, payDate: r.pay_date ?? null, cash: r.cash_amount, kind: r.dividend_type ?? null, perYear: r.frequency ?? null });
    }
    url = res.next_url;
  }
  return out;
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
