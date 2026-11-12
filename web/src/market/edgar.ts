// SEC EDGAR's XBRL "frames" API: one call returns one reported concept (say,
// Revenues) for every filer for one calendar period, so a nightly refresh of a
// dozen concepts for the latest quarters is a few dozen calls and no bulk
// download. Public filings, no key, no display license. The SEC asks for a
// descriptive User-Agent and under 10 requests a second.
//
// Frames: "CY2025Q2" is a three-month duration (income and cash-flow items),
// "CY2025" a twelve-month one, "CY2025Q2I" an instant at the quarter end
// (balance-sheet items). A company whose fiscal quarter ends near a calendar
// quarter end is assigned to that frame.
import { financials } from "@/db/schema";
import { fetchJson, sleep } from "./http";

export type FinancialColumn = Exclude<keyof typeof financials.$inferInsert, "cik" | "period" | "periodStart" | "periodEnd" | "accession" | "filed" | "updatedAt">;

type ConceptSpec = { taxonomy: "us-gaap" | "dei"; tag: string; unit: string };

// For each of our columns, the XBRL concepts that can supply it, best first.
// Companies use different tags for the same line; the first with a value wins.
export const CONCEPTS: Record<FinancialColumn, { instant: boolean; sources: ConceptSpec[] }> = {
  revenue: {
    instant: false,
    sources: [
      { taxonomy: "us-gaap", tag: "Revenues", unit: "USD" },
      { taxonomy: "us-gaap", tag: "RevenueFromContractWithCustomerExcludingAssessedTax", unit: "USD" },
      // Best Buy, TJX, Kraft Heinz and CrowdStrike report sales with sales tax included.
      { taxonomy: "us-gaap", tag: "RevenueFromContractWithCustomerIncludingAssessedTax", unit: "USD" },
      { taxonomy: "us-gaap", tag: "SalesRevenueNet", unit: "USD" },
      { taxonomy: "us-gaap", tag: "RevenuesNetOfInterestExpense", unit: "USD" },
      // Utilities (NextEra, Duke, DTE, Xcel).
      { taxonomy: "us-gaap", tag: "RegulatedAndUnregulatedOperatingRevenue", unit: "USD" },
    ],
  },
  netIncome: {
    instant: false,
    sources: [
      { taxonomy: "us-gaap", tag: "NetIncomeLoss", unit: "USD" },
      // Booking tags only this one: profit after preferred dividends, which is what EPS is based on.
      { taxonomy: "us-gaap", tag: "NetIncomeLossAvailableToCommonStockholdersBasic", unit: "USD" },
      { taxonomy: "us-gaap", tag: "ProfitLoss", unit: "USD" },
    ],
  },
  epsDiluted: {
    instant: false,
    sources: [
      { taxonomy: "us-gaap", tag: "EarningsPerShareDiluted", unit: "USD-per-shares" },
      { taxonomy: "us-gaap", tag: "EarningsPerShareBasicAndDiluted", unit: "USD-per-shares" },
    ],
  },
  grossProfit: { instant: false, sources: [{ taxonomy: "us-gaap", tag: "GrossProfit", unit: "USD" }] },
  operatingIncome: { instant: false, sources: [{ taxonomy: "us-gaap", tag: "OperatingIncomeLoss", unit: "USD" }] },
  operatingCashFlow: { instant: false, sources: [{ taxonomy: "us-gaap", tag: "NetCashProvidedByUsedInOperatingActivities", unit: "USD" }] },
  capex: { instant: false, sources: [{ taxonomy: "us-gaap", tag: "PaymentsToAcquirePropertyPlantAndEquipment", unit: "USD" }] },
  sharesOutstanding: {
    instant: true,
    sources: [
      { taxonomy: "dei", tag: "EntityCommonStockSharesOutstanding", unit: "shares" },
      { taxonomy: "us-gaap", tag: "CommonStockSharesOutstanding", unit: "shares" },
    ],
  },
  // Duration concept (weighted over the period). Dual-class filers report
  // EntityCommonStockSharesOutstanding per share class, which the frames API
  // drops, but most still report this one with no class axis.
  sharesDiluted: { instant: false, sources: [{ taxonomy: "us-gaap", tag: "WeightedAverageNumberOfDilutedSharesOutstanding", unit: "shares" }] },
  cash: { instant: true, sources: [{ taxonomy: "us-gaap", tag: "CashAndCashEquivalentsAtCarryingValue", unit: "USD" }] },
  longTermDebt: {
    instant: true,
    sources: [
      { taxonomy: "us-gaap", tag: "LongTermDebt", unit: "USD" },
      { taxonomy: "us-gaap", tag: "LongTermDebtNoncurrent", unit: "USD" },
    ],
  },
  equity: {
    instant: true,
    sources: [
      { taxonomy: "us-gaap", tag: "StockholdersEquity", unit: "USD" },
      { taxonomy: "us-gaap", tag: "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest", unit: "USD" },
    ],
  },
  goodwill: { instant: true, sources: [{ taxonomy: "us-gaap", tag: "Goodwill", unit: "USD" }] },
  intangibles: { instant: true, sources: [{ taxonomy: "us-gaap", tag: "IntangibleAssetsNetExcludingGoodwill", unit: "USD" }] },
};

export type FrameRow = { accn: string; cik: number; entityName: string; loc: string; start?: string; end: string; val: number; filed?: string };
type FrameResponse = { taxonomy: string; tag: string; ccp: string; uom: string; data: FrameRow[] };

const EDGAR_DELAY_MS = 120; // ~8 requests a second, under the SEC's limit of 10

export async function fetchFrame(spec: ConceptSpec, frame: string): Promise<FrameRow[]> {
  const url = `https://data.sec.gov/api/xbrl/frames/${spec.taxonomy}/${spec.tag}/${encodeURIComponent(spec.unit)}/${frame}.json`;
  await sleep(EDGAR_DELAY_MS);
  try {
    const res = await fetchJson<FrameResponse>(url);
    return res.data ?? [];
  } catch (err) {
    // No filer reported this concept for this frame.
    if (err instanceof Error && err.message.startsWith("HTTP 404")) return [];
    // The SEC refuses requests whose User-Agent doesn't name a contact.
    if (err instanceof Error && err.message.startsWith("HTTP 403")) {
      throw new Error(`The SEC refused the request (403). Set MARKET_USER_AGENT to "Owners Club <contact email>"; the SEC requires a contact in the User-Agent.`);
    }
    throw err;
  }
}

/** The frame names for the last `quarters` calendar quarters ending before `today`, newest first. */
export function recentQuarterFrames(today: Date, quarters: number): string[] {
  const out: string[] = [];
  let y = today.getUTCFullYear();
  let q = Math.floor(today.getUTCMonth() / 3); // 0-based current quarter; the last complete one is q-1
  for (let i = 0; i < quarters; i++) {
    q -= 1;
    if (q < 0) {
      q = 3;
      y -= 1;
    }
    out.push(`CY${y}Q${q + 1}`);
  }
  return out;
}

/**
 * The annual frame names to fetch, newest first: the current calendar year,
 * then the last `years` complete ones. The current year is there for fiscal
 * years that have already ended: EDGAR files a year ending June to October
 * 2026 under CY2026, and without it the 10-K quarter of every such company
 * (Microsoft, Procter & Gamble, Costco) can't be derived until January.
 */
export function recentYearFrames(today: Date, years: number): string[] {
  const y = today.getUTCFullYear();
  return [`CY${y}`, ...Array.from({ length: years }, (_, i) => `CY${y - 1 - i}`)];
}

/** The instant frame that goes with a duration frame: the quarter's end, or Q4 for a year. */
export const instantFrameFor = (frame: string) => (/Q\d$/.test(frame) ? `${frame}I` : `${frame}Q4I`);

export type FinancialUpsert = typeof financials.$inferInsert;

/**
 * Fetches every concept for one frame and returns one row per wanted company
 * (by CIK), with each column filled from the first concept that reported it.
 * Rows for companies with no values at all are left out.
 */
export async function fetchFinancialsForFrame(frame: string, wantedCiks: Set<number>): Promise<FinancialUpsert[]> {
  const rows = new Map<number, FinancialUpsert>();
  const rowFor = (r: FrameRow) => {
    let row = rows.get(r.cik);
    if (!row) {
      row = { cik: r.cik, period: frame };
      rows.set(r.cik, row);
    }
    return row;
  };
  for (const [column, { instant, sources }] of Object.entries(CONCEPTS) as [FinancialColumn, (typeof CONCEPTS)[FinancialColumn]][]) {
    const frameName = instant ? instantFrameFor(frame) : frame;
    for (const spec of sources) {
      const data = await fetchFrame(spec, frameName);
      for (const r of data) {
        if (!wantedCiks.has(r.cik)) continue;
        const row = rowFor(r);
        if (row[column] != null) continue; // an earlier (preferred) concept already supplied it
        const val = storedValue(column, r.val);
        if (val == null) continue;
        (row as Record<string, unknown>)[column] = val;
        if (!instant) {
          row.periodStart ??= r.start ?? null;
          row.periodEnd ??= r.end;
          row.accession ??= r.accn;
        }
      }
    }
  }
  return mergePredecessors([...rows.values()]).map(fixProxyScale);
}

/**
 * Companies whose SEC registrant changed, so their history sits under an older
 * CIK. Exxon became ExxonMobil Holdings Corp in 2026: its filings before the
 * second quarter of 2026 are under 34088. Rows fetched for an old CIK are
 * stored under the current one.
 */
export const PREDECESSOR_CIKS: Record<number, number[]> = {
  2115436: [34088], // ExxonMobil
};

/** The CIKs to ask the frames for: the members' own, plus any predecessors. */
export function withPredecessors(ciks: Set<number>): Set<number> {
  const out = new Set(ciks);
  for (const cik of ciks) for (const old of PREDECESSOR_CIKS[cik] ?? []) out.add(old);
  return out;
}

/** Moves a predecessor's rows to the current CIK; where both reported a period, the current registrant's values win. */
export function mergePredecessors(rows: FinancialUpsert[]): FinancialUpsert[] {
  const currentOf = new Map<number, number>();
  for (const [cik, olds] of Object.entries(PREDECESSOR_CIKS)) for (const old of olds) currentOf.set(old, Number(cik));
  const own = new Map(rows.filter((r) => !currentOf.has(r.cik)).map((r) => [`${r.cik}:${r.period}`, r]));
  for (const r of rows.filter((r) => currentOf.has(r.cik))) {
    const cik = currentOf.get(r.cik)!;
    const key = `${cik}:${r.period}`;
    const mine = own.get(key);
    if (!mine) {
      own.set(key, { ...r, cik });
      continue;
    }
    for (const [k, v] of Object.entries(r)) if (k !== "cik" && v != null && (mine as Record<string, unknown>)[k] == null) (mine as Record<string, unknown>)[k] = v;
  }
  return [...own.values()];
}

/**
 * Net income filed in thousands or millions without the scale. The proxy
 * statement's pay-versus-performance table tags `NetIncomeLoss` that way
 * (PG&E: 2,593 for $2,593 million), and when the 10-K uses a different tag the
 * proxy's figure is the one the frame holds. EPS times diluted shares says
 * what net income should roughly be; when the stored figure is about a
 * thousand or a million times smaller, it is scaled up. The band is wide
 * because EPS is after preferred dividends (Schwab: 8% apart).
 *
 * Only annual rows with a net income under 100 million are touched: the proxy
 * reports fiscal years, and a real S&P 500 year is rarely that small. Without
 * those limits a wrong share count sets it off: Waters files 98,204 thousand
 * diluted shares as 98 billion, which made a correct quarterly loss of $136
 * million look a thousand times too small.
 */
export function fixProxyScale(row: FinancialUpsert): FinancialUpsert {
  const { netIncome, epsDiluted, sharesDiluted } = row;
  if (!netIncome || !epsDiluted || !sharesDiluted) return row;
  if (!/^CY\d{4}$/.test(row.period) || Math.abs(netIncome) >= 1e8) return row;
  const implied = epsDiluted * sharesDiluted;
  for (const scale of [1e3, 1e6]) {
    const ratio = implied / (netIncome * scale);
    if (ratio > 0.75 && ratio < 1.3) return { ...row, netIncome: netIncome * scale };
  }
  return row;
}

/**
 * A reported value as we store it. Every column but EPS is a whole number in
 * the database, and one fractional value fails the whole insert. A fractional
 * share count is a filer tagging in millions without the scale (McDonald's
 * reports 708.3 diluted shares), so it's dropped, not rounded to 708 shares.
 * Fractional dollar amounts are rounded.
 */
export function storedValue(column: FinancialColumn, val: number): number | null {
  if (!Number.isFinite(val)) return null;
  if (column === "epsDiluted") return val;
  if (column === "sharesOutstanding" || column === "sharesDiluted") return Number.isInteger(val) ? val : null;
  return Math.round(val);
}

export type SecTicker = { cik: number; ticker: string; title: string };

/** The SEC's ticker ↔ CIK list, for members whose Wikipedia row has no CIK. */
export async function fetchSecTickers(): Promise<SecTicker[]> {
  const data = await fetchJson<Record<string, { cik_str: number; ticker: string; title: string }>>("https://www.sec.gov/files/company_tickers.json");
  return Object.values(data).map((d) => ({ cik: d.cik_str, ticker: d.ticker, title: d.title }));
}
