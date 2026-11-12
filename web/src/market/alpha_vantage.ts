// Alpha Vantage: the earnings calendar (one CSV for every listed company), each
// company's reported earnings, and news headlines. The free key allows 25
// requests a day, so the nightly job spends them deliberately: one on the
// calendar, the rest on companies that just reported. Headlines come later,
// for companies players hold.
import { fetchJson, fetchText, sleep } from "./http";

function apiKey() {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error("ALPHA_VANTAGE_API_KEY is not set");
  return key;
}

const BASE = "https://www.alphavantage.co/query";

export type CalendarEntry = { ticker: string; name: string; reportDate: string; fiscalDateEnding: string | null; estimateEps: number | null };

/** Scheduled earnings for every company over the horizon. */
export async function fetchEarningsCalendar(horizon: "3month" | "6month" | "12month" = "3month"): Promise<CalendarEntry[]> {
  const csv = await fetchText(`${BASE}?function=EARNINGS_CALENDAR&horizon=${horizon}&apikey=${apiKey()}`);
  return parseEarningsCalendar(csv);
}

export function parseEarningsCalendar(csv: string): CalendarEntry[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = splitCsv(lines[0]).map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const iSymbol = col("symbol");
  const iName = col("name");
  const iDate = col("reportDate");
  const iFiscal = col("fiscalDateEnding");
  const iEstimate = col("estimate");
  if (iSymbol < 0 || iDate < 0) throw new Error(`Unexpected earnings calendar header: ${lines[0]}`);
  const out: CalendarEntry[] = [];
  for (const line of lines.slice(1)) {
    const c = splitCsv(line);
    if (!c[iSymbol] || !/^\d{4}-\d{2}-\d{2}$/.test(c[iDate] ?? "")) continue;
    const est = Number.parseFloat(c[iEstimate] ?? "");
    out.push({
      ticker: c[iSymbol],
      name: iName >= 0 ? c[iName] : "",
      reportDate: c[iDate],
      fiscalDateEnding: iFiscal >= 0 && c[iFiscal] ? c[iFiscal] : null,
      estimateEps: Number.isFinite(est) ? est : null,
    });
  }
  return out;
}

export type ReportedQuarter = {
  fiscalDateEnding: string;
  reportedDate: string;
  reportedEps: number | null;
  estimatedEps: number | null;
  reportTime: string | null; // "pre-market" | "post-market" | null
};

type EarningsResponse = {
  symbol?: string;
  quarterlyEarnings?: { fiscalDateEnding: string; reportedDate: string; reportedEPS: string; estimatedEPS?: string; reportTime?: string }[];
  Information?: string;
  Note?: string;
};

/** A company's reported quarters, newest first. */
export async function fetchReportedEarnings(ticker: string): Promise<ReportedQuarter[]> {
  const res = await fetchJson<EarningsResponse>(`${BASE}?function=EARNINGS&symbol=${encodeURIComponent(ticker)}&apikey=${apiKey()}`);
  if (res.Information || res.Note) throw new Error(`Alpha Vantage: ${res.Information ?? res.Note}`);
  return (res.quarterlyEarnings ?? []).map((q) => ({
    fiscalDateEnding: q.fiscalDateEnding,
    reportedDate: q.reportedDate,
    reportedEps: num(q.reportedEPS),
    estimatedEps: num(q.estimatedEPS),
    reportTime: q.reportTime ? q.reportTime.replace("_", "-").toLowerCase() : null,
  }));
}

export type Headline = { ticker: string; title: string; url: string; source: string; publishedAt: Date };

type NewsResponse = {
  feed?: { title: string; url: string; time_published: string; source: string; ticker_sentiment?: { ticker: string }[] }[];
  Information?: string;
  Note?: string;
};

/** Recent headlines mentioning one company. Titles and links only. */
export async function fetchHeadlines(ticker: string, limit = 20): Promise<Headline[]> {
  const res = await fetchJson<NewsResponse>(`${BASE}?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(ticker)}&sort=LATEST&limit=${limit}&apikey=${apiKey()}`);
  if (res.Information || res.Note) throw new Error(`Alpha Vantage: ${res.Information ?? res.Note}`);
  return (res.feed ?? []).map((f) => ({ ticker, title: f.title, url: f.url, source: f.source, publishedAt: parseAvTime(f.time_published) }));
}

/** "20220410T013000" → Date */
export function parseAvTime(s: string): Date {
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?/);
  if (!m) return new Date(NaN);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0)));
}

const num = (s: string | undefined) => {
  const n = Number.parseFloat(s ?? "");
  return Number.isFinite(n) ? n : null;
};

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** The free key allows 25 calls a day and about one a second; wait between consecutive calls. */
export const alphaVantagePause = () => sleep(1300);

/**
 * Which report dates the nightly job looks up reported numbers for: the last
 * seven days, up to yesterday (UTC). Today is left out: the job runs at 1 am
 * Eastern, before anyone reporting today has reported, and each lookup spends
 * one of the free key's 25 calls a day.
 */
export function earningsLookupWindow(now = new Date()): { from: string; before: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(new Date(now.getTime() - 7 * 86_400_000)), before: iso(now) };
}
