// The numbers the game shows, computed from stored financials and the latest
// close. Nothing here is stored: P/E, margins and growth are functions over
// the `financials` rows, so they can't drift from their inputs. Quarters that
// EDGAR only reports inside a fiscal year (the 10-K quarter) are derived as
// year minus the other three, when the dates show those three really are the
// rest of that fiscal year.
import type { financials } from "@/db/schema";

export type FinancialRow = typeof financials.$inferSelect;

type Flow = "revenue" | "netIncome" | "grossProfit" | "operatingIncome" | "operatingCashFlow" | "capex" | "epsDiluted";
const FLOWS: Flow[] = ["revenue", "netIncome", "grossProfit", "operatingIncome", "operatingCashFlow", "capex", "epsDiluted"];

export type Quarter = Pick<FinancialRow, "period" | "periodStart" | "periodEnd" | Flow> & { derived: boolean };

const isQuarter = (period: string) => /^CY\d{4}Q[1-4]$/.test(period);
const isYear = (period: string) => /^CY\d{4}$/.test(period);

/** Frame name of the calendar quarter a date falls in. */
export function frameForDate(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  return `CY${y}Q${Math.floor((m - 1) / 3) + 1}`;
}

/**
 * Frame name EDGAR would give a roughly three-month period: the calendar
 * quarter holding most of it, i.e. the one its midpoint falls in. For a
 * February-to-April quarter that is Q1, not Q2 (where its end date falls).
 */
export function frameForPeriod(start: string, end: string): string {
  return frameForDate(addDays(start, Math.floor(daysBetween(start, end) / 2)));
}

// Days of slack when matching period edges: 52/53-week years end on a
// weekday near the month end, and their quarters are 13 or 14 weeks.
const SLACK_DAYS = 7;

/**
 * Quarterly rows, newest first, with the fiscal year's missing quarter derived
 * as the year minus the other three. A quarter is derived only when the three
 * reported quarters sit inside the annual row's own dates (within a few days),
 * follow on from each other with no gap, and leave exactly one quarter-sized
 * hole at the start or end of that year. Anything else (a quarter missing,
 * quarters from a different fiscal year, a year that isn't twelve months) is
 * skipped rather than guessed at, because a wrong subtraction can turn a
 * profitable year into a fake loss.
 */
export function quarters(rows: FinancialRow[]): Quarter[] {
  const qs: Quarter[] = rows.filter((r) => isQuarter(r.period) && r.periodStart && r.periodEnd).map((r) => ({ ...pick(r), derived: false }));
  for (const y of rows.filter((r) => isYear(r.period) && r.periodStart && r.periodEnd)) {
    const gap = missingQuarter(y, qs.filter((q) => !q.derived));
    if (!gap) continue;
    const { inside, periodStart, periodEnd } = gap;
    const period = frameForPeriod(periodStart, periodEnd);
    // Already have it: a reported quarter overlapping the hole, or the same frame.
    if (qs.some((q) => q.period === period || overlaps(q, periodStart, periodEnd))) continue;
    const derived: Quarter = { period, periodStart, periodEnd, derived: true, ...emptyFlows() };
    for (const f of FLOWS) {
      const yearVal = y[f];
      if (yearVal == null || inside.some((q) => q[f] == null)) continue;
      const sum = inside.reduce((a, q) => a + (q[f] as number), 0);
      derived[f] = f === "epsDiluted" ? round2(yearVal - sum) : yearVal - sum;
    }
    qs.push(derived);
  }
  return qs.sort((a, b) => (a.periodEnd! < b.periodEnd! ? 1 : -1));
}

/** The three reported quarters of a fiscal year and the dates of the one left to derive, or null. */
function missingQuarter(y: FinancialRow, reported: Quarter[]) {
  const yStart = y.periodStart!;
  const yEnd = y.periodEnd!;
  const yearDays = daysBetween(yStart, yEnd) + 1;
  if (yearDays < 365 - SLACK_DAYS || yearDays > 371 + SLACK_DAYS) return null; // not a twelve-month year
  const inside = reported
    .filter((q) => daysBetween(yStart, q.periodStart!) >= -SLACK_DAYS && daysBetween(q.periodEnd!, yEnd) >= -SLACK_DAYS)
    .sort((a, b) => (a.periodStart! < b.periodStart! ? -1 : 1));
  if (inside.length !== 3) return null;
  if (!inside.every((q) => isQuarterLength(q.periodStart!, q.periodEnd!))) return null;
  for (let i = 1; i < 3; i++) if (!follows(inside[i - 1].periodEnd!, inside[i].periodStart!)) return null;
  const first = inside[0].periodStart!;
  const last = inside[2].periodEnd!;
  // Together the three cover nine months, flush with one edge of the year.
  const covered = daysBetween(first, last) + 1;
  if (covered < 3 * 84 || covered > 3 * 98) return null;
  const atStart = Math.abs(daysBetween(yStart, first)) <= SLACK_DAYS;
  const atEnd = Math.abs(daysBetween(last, yEnd)) <= SLACK_DAYS;
  if (atStart === atEnd) return null;
  const hole = atStart ? { periodStart: addDays(last, 1), periodEnd: yEnd } : { periodStart: yStart, periodEnd: addDays(first, -1) };
  if (!isQuarterLength(hole.periodStart, hole.periodEnd)) return null;
  return { inside, ...hole };
}

/** 13 or 14 weeks, or a calendar quarter (90 to 92 days), with slack. */
const isQuarterLength = (start: string, end: string) => {
  const days = daysBetween(start, end) + 1;
  return days >= 84 && days <= 98 + SLACK_DAYS;
};
/** Whether a period starting on `start` picks up where one ending on `end` left off. */
const follows = (end: string, start: string) => Math.abs(daysBetween(end, start) - 1) <= SLACK_DAYS;
/** More than a few days in common (52/53-week edges can touch). */
const overlaps = (q: Quarter, start: string, end: string) => {
  const from = q.periodStart! > start ? q.periodStart! : start;
  const to = q.periodEnd! < end ? q.periodEnd! : end;
  return daysBetween(from, to) + 1 > SLACK_DAYS;
};

/** Whether quarters, newest first, run back to back with no missing quarter between them. */
export function contiguous(set: Pick<Quarter, "periodStart" | "periodEnd">[]): boolean {
  for (let i = 1; i < set.length; i++) {
    const newer = set[i - 1];
    const older = set[i];
    if (!newer.periodStart || !older.periodEnd || !follows(older.periodEnd, newer.periodStart)) return false;
  }
  return true;
}

export type SharesSource = "reported" | "diluted" | "derived";

export type CompanyMetrics = {
  latestPeriod: string | null;
  quartersAvailable: number;
  price: number | null;
  // The share count behind the market cap: shares outstanding as reported,
  // else the latest quarter's weighted-average diluted shares, else trailing
  // net income ÷ trailing diluted EPS over the same four quarters.
  sharesOutstanding: number | null;
  sharesSource: SharesSource | null;
  marketCap: number | null;
  revenueTtm: number | null;
  netIncomeTtm: number | null;
  epsTtm: number | null;
  pe: number | null;
  revenueGrowth: number | null; // % vs. the prior four quarters
  grossMargin: number | null; // %
  operatingMargin: number | null; // %
  netMargin: number | null; // %
  fcfTtm: number | null;
  fcfMargin: number | null; // %
  cashConversion: number | null; // free cash flow ÷ net income
  ruleOf40: number | null; // revenue growth % + free-cash-flow margin %
  roe: number | null; // %
  priceToBook: number | null;
  cash: number | null;
  longTermDebt: number | null;
  equity: number | null;
};

export function computeMetrics(rows: FinancialRow[], price: number | null): CompanyMetrics {
  const qs = quarters(rows);
  const last4 = qs.slice(0, 4);
  const prior4 = qs.slice(4, 8);
  // A trailing sum needs four quarters back to back; with one missing, the
  // four newest rows would span more than a year.
  const ttm = (f: Flow, set = last4) => (set.length === 4 && contiguous(set) && set.every((q) => q[f] != null) ? set.reduce((a, q) => a + (q[f] as number), 0) : null);

  // Balance-sheet values: the newest row that has them (instants come from the
  // quarter's own row, not the derived one).
  const latestWith = (f: keyof FinancialRow) => rows.filter((r) => r[f] != null && r.periodEnd).sort((a, b) => (a.periodEnd! < b.periodEnd! ? 1 : -1))[0]?.[f] as number | null | undefined;
  const equity = latestWith("equity") ?? null;

  const revenueTtm = ttm("revenue");
  const netIncomeTtm = ttm("netIncome");
  const epsTtm = ttm("epsDiluted");
  const shares = shareCount(rows, netIncomeTtm, epsTtm);
  const sharesOutstanding = shares?.count ?? null;
  const priorRevenue = ttm("revenue", prior4);
  const ocf = ttm("operatingCashFlow");
  const capex = ttm("capex");
  const fcfTtm = ocf != null && capex != null ? ocf - capex : null;
  const marketCap = price != null && sharesOutstanding ? price * sharesOutstanding : null;
  const pctOf = (num: number | null, den: number | null) => (num != null && den ? round1((num / den) * 100) : null);
  const revenueGrowth = pctOf(revenueTtm != null && priorRevenue ? revenueTtm - priorRevenue : null, priorRevenue);
  const fcfMargin = pctOf(fcfTtm, revenueTtm);

  return {
    latestPeriod: qs[0]?.period ?? null,
    quartersAvailable: qs.length,
    price,
    sharesOutstanding,
    sharesSource: shares?.source ?? null,
    marketCap,
    revenueTtm,
    netIncomeTtm,
    epsTtm: epsTtm != null ? round2(epsTtm) : null,
    pe: marketCap != null && netIncomeTtm != null && netIncomeTtm > 0 ? round1(marketCap / netIncomeTtm) : null,
    revenueGrowth,
    grossMargin: pctOf(ttm("grossProfit"), revenueTtm),
    operatingMargin: pctOf(ttm("operatingIncome"), revenueTtm),
    netMargin: pctOf(netIncomeTtm, revenueTtm),
    fcfTtm,
    fcfMargin,
    cashConversion: fcfTtm != null && netIncomeTtm ? round2(fcfTtm / netIncomeTtm) : null,
    ruleOf40: revenueGrowth != null && fcfMargin != null ? round1(revenueGrowth + fcfMargin) : null,
    roe: pctOf(netIncomeTtm, equity),
    priceToBook: marketCap != null && equity ? round2(marketCap / equity) : null,
    cash: latestWith("cash") ?? null,
    longTermDebt: latestWith("longTermDebt") ?? null,
    equity,
  };
}

/** The share count for the market cap, and where it came from (see CompanyMetrics). */
export function shareCount(rows: FinancialRow[], netIncomeTtm: number | null, epsTtm: number | null): { count: number; source: SharesSource } | null {
  const newest = (f: "sharesOutstanding" | "sharesDiluted", keep: (r: FinancialRow) => boolean = () => true) =>
    rows.filter((r) => r[f] != null && r[f]! > 0 && r.periodEnd && keep(r)).sort((a, b) => (a.periodEnd! < b.periodEnd! ? 1 : -1))[0]?.[f] ?? null;
  const reported = newest("sharesOutstanding");
  if (reported) return { count: reported, source: "reported" };
  // A quarter's average is closer to today's count than a full year's.
  const diluted = newest("sharesDiluted", (r) => isQuarter(r.period)) ?? newest("sharesDiluted");
  if (diluted) return { count: diluted, source: "diluted" };
  if (netIncomeTtm != null && epsTtm != null && epsTtm !== 0) {
    const count = Math.round(netIncomeTtm / epsTtm);
    if (count > 0) return { count, source: "derived" };
  }
  return null;
}

/**
 * One row per company: dual listings (GOOG and GOOGL, FOX and FOXA, NWS and
 * NWSA) share a CIK and would count twice in index-wide totals. Keeps the
 * first ticker alphabetically; rows with no CIK all stay. Order is kept.
 */
export function onePerCompany<T extends { ticker: string; cik: number | null }>(rows: T[]): T[] {
  const keep = new Map<number, string>();
  for (const r of rows) {
    if (r.cik == null) continue;
    const seen = keep.get(r.cik);
    if (seen == null || r.ticker < seen) keep.set(r.cik, r.ticker);
  }
  return rows.filter((r) => r.cik == null || keep.get(r.cik) === r.ticker);
}

/** Middle half of a set of P/Es (the band the P/E scale shows), or null under 4 values. */
export function peBand(pes: number[]): [number, number] | null {
  const sorted = pes.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (sorted.length < 4) return null;
  return [round1(sorted[Math.floor(sorted.length / 4)]), round1(sorted[Math.ceil((sorted.length * 3) / 4) - 1])];
}

function pick(r: FinancialRow) {
  return {
    period: r.period,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    revenue: r.revenue,
    netIncome: r.netIncome,
    grossProfit: r.grossProfit,
    operatingIncome: r.operatingIncome,
    operatingCashFlow: r.operatingCashFlow,
    capex: r.capex,
    epsDiluted: r.epsDiluted,
  };
}
const emptyFlows = () => ({ revenue: null, netIncome: null, grossProfit: null, operatingIncome: null, operatingCashFlow: null, capex: null, epsDiluted: null });
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
