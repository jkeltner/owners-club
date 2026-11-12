// The nightly job: refresh the S&P 500 list, pull the closes we don't have yet,
// refresh the latest quarters from EDGAR, and update the earnings calendar.
// Every step is idempotent and can run alone (`?step=prices`). Steps that need
// a provider key report `skipped` when the key isn't set, so a fresh deploy
// runs clean and the data page says what's missing.
import { and, eq, gte, inArray, isNull, lt, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, earningsDates, financials, prices } from "@/db/schema";
import { alphaVantagePause, earningsLookupWindow, fetchEarningsCalendar, fetchReportedEarnings } from "@/market/alpha_vantage";
import { fetchFinancialsForFrame, fetchSecTickers, recentQuarterFrames, recentYearFrames, withPredecessors, type FinancialUpsert } from "@/market/edgar";
import { fetchCompanyFacts, quartersFromFacts } from "@/market/edgar_facts";
import { computeMetrics, onePerCompany } from "@/market/metrics";
import { fetchGroupedDaily, INDEX_FUND_TICKER, massiveFreeTierPause, weekdaysBetween } from "@/market/massive";
import { fetchSp500Members, toSecTicker } from "@/market/sp500";
import { runJob, type Step, type StepResult } from "./runner";

export const STEP_NAMES = ["sp500", "prices", "financials", "earnings"] as const;
export type StepName = (typeof STEP_NAMES)[number];

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number, from = new Date()) => isoDate(new Date(from.getTime() - n * 86_400_000));

/** Members in, members out, lenses and CIKs filled. One Wikipedia call, one SEC call when a CIK is missing. */
export async function refreshSp500(): Promise<StepResult> {
  const members = await fetchSp500Members();
  const missingCik = members.filter((m) => !m.cik);
  if (missingCik.length) {
    const bySecTicker = new Map((await fetchSecTickers()).map((t) => [t.ticker, t.cik]));
    for (const m of missingCik) m.cik = bySecTicker.get(toSecTicker(m.ticker)) ?? null;
  }
  const now = new Date();
  for (const chunk of chunks(members, 100)) {
    await db
      .insert(companies)
      .values(chunk.map((m) => ({ ticker: m.ticker, name: m.name, cik: m.cik, sector: m.sector, subIndustry: m.subIndustry, lens: m.lens, addedToIndex: m.addedToIndex, status: "active" as const, updatedAt: now })))
      .onConflictDoUpdate({
        target: companies.ticker,
        set: {
          name: sql`excluded.name`,
          cik: sql`excluded.cik`,
          sector: sql`excluded.sector`,
          subIndustry: sql`excluded.sub_industry`,
          lens: sql`excluded.lens`,
          addedToIndex: sql`excluded.added_to_index`,
          status: "active",
          updatedAt: now,
        },
      });
  }
  const tickers = members.map((m) => m.ticker);
  const removed = await db
    .update(companies)
    .set({ status: "removed", updatedAt: now })
    .where(and(eq(companies.status, "active"), sql`${companies.ticker} not in ${tickers}`))
    .returning({ ticker: companies.ticker });
  const withoutLens = members.filter((m) => !m.lens).length;
  const withoutCik = members.filter((m) => !m.cik).map((m) => m.ticker);
  return { members: members.length, removed: removed.map((r) => r.ticker), withoutLens, withoutCik };
}

/** Closes for every weekday since the last stored date, up to yesterday. One Massive call per day. */
export async function refreshPrices(maxDays = 10, seedFrom?: string): Promise<StepResult> {
  if (!process.env.MASSIVE_API_KEY) return { skipped: "MASSIVE_API_KEY is not set" };
  const [{ latest }] = await db.select({ latest: max(prices.date) }).from(prices);
  // Resume after the latest stored day; an empty table starts at `seedFrom` (backfills) or a week ago.
  const from = latest ? daysAgo(-1, new Date(`${latest}T00:00:00Z`)) : (seedFrom ?? daysAgo(7));
  const to = daysAgo(1);
  const days = weekdaysBetween(from, to).slice(0, maxDays);
  const wanted = new Set([INDEX_FUND_TICKER, ...(await db.select({ ticker: companies.ticker }).from(companies)).map((c) => c.ticker)]);
  let written = 0;
  const empty: string[] = [];
  for (const [i, day] of days.entries()) {
    if (i > 0) await massiveFreeTierPause();
    const bars = (await fetchGroupedDaily(day)).filter((b) => wanted.has(b.ticker));
    if (!bars.length) {
      empty.push(day); // holiday, or data not published yet
      continue;
    }
    for (const chunk of chunks(bars, 500)) {
      await db
        .insert(prices)
        .values(chunk.map((b) => ({ ticker: b.ticker, date: b.date, close: b.close, volume: Math.round(b.volume), source: "massive" }))) // split-adjusted volumes are fractional
        .onConflictDoUpdate({ target: [prices.ticker, prices.date], set: { close: sql`excluded.close`, volume: sql`excluded.volume`, source: sql`excluded.source` } });
      written += chunk.length;
    }
  }
  return { days: days.length, written, empty };
}

/** The latest quarters and years from EDGAR for every member. Nightly: 3 quarters and 2 years; backfills pass more. */
export async function refreshFinancials(opts: { quarters: number; years: number; today?: Date } = { quarters: 3, years: 2 }): Promise<StepResult> {
  const today = opts.today ?? new Date();
  const members = await db.select({ cik: companies.cik }).from(companies).where(eq(companies.status, "active"));
  const ciks = new Set(members.map((m) => m.cik).filter((c): c is number => c != null));
  const frames = [...recentQuarterFrames(today, opts.quarters), ...recentYearFrames(today, opts.years)];
  let rows = 0;
  const perFrame: Record<string, number> = {};
  for (const frame of frames) {
    const upserts = await fetchFinancialsForFrame(frame, withPredecessors(ciks));
    perFrame[frame] = upserts.length;
    rows += await upsertFinancials(upserts);
  }
  const gaps = await fillFinancialGaps(today);
  return { frames: perFrame, rows, companies: ciks.size, gaps };
}

/**
 * For companies whose trailing revenue or profit is blank, reads the company's
 * own facts and stores the quarters and lines the frames left out (see
 * edgar_facts.ts). A company that can't be filled (a spinoff with under a year
 * of filings) is looked up again each night; there are about a dozen. So are
 * the 12-week filers (a period named like "CY2026Q1b"): the frames step
 * rewrites their mixed rows every night, and this puts them right again.
 */
export async function fillFinancialGaps(today = new Date(), maxCompanies = 80): Promise<StepResult> {
  const members = onePerCompany(await db.select({ ticker: companies.ticker, cik: companies.cik }).from(companies).where(eq(companies.status, "active")));
  const byCik = new Map<number, (typeof financials.$inferSelect)[]>();
  for (const r of await db.select().from(financials)) byCik.set(r.cik, [...(byCik.get(r.cik) ?? []), r]);
  const blank = members.filter((m) => {
    const rows = m.cik ? (byCik.get(m.cik) ?? []) : [];
    if (!rows.length) return false;
    const metrics = computeMetrics(rows, null);
    return metrics.revenueTtm == null || metrics.netIncomeTtm == null || rows.some((r) => r.period.endsWith("b"));
  });
  const since = isoDate(new Date(today.getTime() - 900 * 86_400_000)); // about ten quarters
  const filled: string[] = [];
  let rows = 0;
  for (const m of blank.slice(0, maxCompanies)) {
    const facts = await fetchCompanyFacts(m.cik!);
    if (!facts) continue;
    const upserts = quartersFromFacts(m.cik!, facts.facts, byCik.get(m.cik!) ?? [], since);
    if (!upserts.length) continue;
    rows += await upsertFinancials(upserts);
    filled.push(m.ticker);
  }
  return { blank: blank.length, lookedUp: Math.min(blank.length, maxCompanies), filled, rows };
}

/**
 * Insert or update financial rows by (cik, period). A later run never blanks a
 * number an earlier run had: each column keeps the existing value when the new
 * one is null. The existing column must be qualified with the table name, or
 * Postgres can't tell it from `excluded`.
 */
export async function upsertFinancials(rows: FinancialUpsert[]): Promise<number> {
  const merged = ["periodStart", "periodEnd", "revenue", "netIncome", "epsDiluted", "grossProfit", "operatingIncome", "operatingCashFlow", "capex", "sharesOutstanding", "sharesDiluted", "cash", "longTermDebt", "equity", "goodwill", "intangibles", "accession"];
  let n = 0;
  for (const chunk of chunks(rows, 200)) {
    await db
      .insert(financials)
      .values(chunk)
      .onConflictDoUpdate({
        target: [financials.cik, financials.period],
        set: Object.fromEntries(merged.map((c) => [c, sql.raw(`coalesce(excluded.${camelToSnake(c)}, financials.${camelToSnake(c)})`)])),
      });
    n += chunk.length;
  }
  return n;
}

/** Upcoming report dates for members (one call), then the numbers for members whose report date was in the last week, up to yesterday. */
export async function refreshEarnings(maxLookups = 12): Promise<StepResult> {
  if (!process.env.ALPHA_VANTAGE_API_KEY) return { skipped: "ALPHA_VANTAGE_API_KEY is not set" };
  const members = new Set((await db.select({ ticker: companies.ticker }).from(companies).where(eq(companies.status, "active"))).map((c) => c.ticker));
  const calendar = (await fetchEarningsCalendar("3month")).filter((e) => members.has(e.ticker));
  const now = new Date();
  for (const chunk of chunks(calendar, 200)) {
    await db
      .insert(earningsDates)
      .values(chunk.map((e) => ({ ticker: e.ticker, date: e.reportDate, status: "estimated" as const, fiscalPeriodEnd: e.fiscalDateEnding, source: "alpha_vantage", updatedAt: now })))
      .onConflictDoNothing();
  }
  // Companies whose date has passed but whose numbers we don't have yet.
  const window = earningsLookupWindow(now);
  const due = await db
    .select({ ticker: earningsDates.ticker, date: earningsDates.date })
    .from(earningsDates)
    .where(and(lt(earningsDates.date, window.before), gte(earningsDates.date, window.from), isNull(earningsDates.reportedEps), inArray(earningsDates.status, ["estimated", "confirmed"])))
    .limit(maxLookups);
  let reported = 0;
  const unresolved: string[] = [];
  for (const d of due) {
    await alphaVantagePause(); // the free key allows one call a second, and the calendar call was just made
    const quarters = await fetchReportedEarnings(d.ticker);
    const match = quarters.find((q) => q.reportedDate === d.date) ?? quarters.find((q) => Math.abs(new Date(q.reportedDate).getTime() - new Date(d.date).getTime()) <= 3 * 86_400_000);
    if (!match) {
      unresolved.push(d.ticker);
      continue;
    }
    await db
      .update(earningsDates)
      .set({ status: "reported", reportedEps: match.reportedEps, reportTime: match.reportTime, fiscalPeriodEnd: match.fiscalDateEnding, updatedAt: now })
      .where(and(eq(earningsDates.ticker, d.ticker), eq(earningsDates.date, d.date)));
    reported++;
  }
  return { calendar: calendar.length, lookedUp: due.length, reported, unresolved };
}

export function nightlySteps(only?: StepName[]): Step[] {
  const all: Record<StepName, Step> = {
    sp500: { name: "sp500", run: refreshSp500 },
    prices: { name: "prices", run: () => refreshPrices() },
    financials: { name: "financials", run: () => refreshFinancials() },
    earnings: { name: "earnings", run: () => refreshEarnings() },
  };
  return (only ?? STEP_NAMES).map((n) => all[n]);
}

export const runNightly = (only?: StepName[]) => runJob("nightly", nightlySteps(only));

function* chunks<T>(arr: T[], size: number) {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}
const camelToSnake = (s: string) => s.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
