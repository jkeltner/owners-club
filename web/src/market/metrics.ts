// The numbers the game shows, computed from stored financials and the latest
// close. Nothing here is stored: P/E, margins and growth are functions over
// the `financials` rows, so they can't drift from their inputs. Quarters that
// EDGAR only reports inside a fiscal year (the 10-K quarter) are derived as
// year minus the other three.
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
 * Quarterly rows, newest first, with the fiscal year's missing quarter derived
 * from each annual row that has exactly three quarters inside it.
 */
export function quarters(rows: FinancialRow[]): Quarter[] {
  const qs: Quarter[] = rows.filter((r) => isQuarter(r.period) && r.periodEnd).map((r) => ({ ...pick(r), derived: false }));
  for (const y of rows.filter((r) => isYear(r.period) && r.periodStart && r.periodEnd)) {
    const inside = qs.filter((q) => !q.derived && q.periodStart! >= y.periodStart! && q.periodEnd! <= y.periodEnd!);
    if (inside.length !== 3) continue;
    const ends = inside.map((q) => q.periodEnd!).sort();
    // The gap is either the year's last quarter or its first.
    const gapAtEnd = ends[ends.length - 1] < y.periodEnd!;
    const periodEnd = gapAtEnd ? y.periodEnd! : addDays(inside.map((q) => q.periodStart!).sort()[0], -1);
    const periodStart = gapAtEnd ? addDays(ends[ends.length - 1], 1) : y.periodStart!;
    const period = frameForDate(periodEnd);
    if (qs.some((q) => q.period === period)) continue;
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

export type CompanyMetrics = {
  latestPeriod: string | null;
  quartersAvailable: number;
  price: number | null;
  sharesOutstanding: number | null;
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
  const ttm = (f: Flow, set = last4) => (set.length === 4 && set.every((q) => q[f] != null) ? set.reduce((a, q) => a + (q[f] as number), 0) : null);

  // Balance-sheet values: the newest row that has them (instants come from the
  // quarter's own row, not the derived one).
  const latestWith = (f: keyof FinancialRow) => rows.filter((r) => r[f] != null && r.periodEnd).sort((a, b) => (a.periodEnd! < b.periodEnd! ? 1 : -1))[0]?.[f] as number | null | undefined;
  const sharesOutstanding = latestWith("sharesOutstanding") ?? null;
  const equity = latestWith("equity") ?? null;

  const revenueTtm = ttm("revenue");
  const netIncomeTtm = ttm("netIncome");
  const epsTtm = ttm("epsDiluted");
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
function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
