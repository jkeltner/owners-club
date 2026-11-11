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
      { taxonomy: "us-gaap", tag: "SalesRevenueNet", unit: "USD" },
      { taxonomy: "us-gaap", tag: "RevenuesNetOfInterestExpense", unit: "USD" },
    ],
  },
  netIncome: {
    instant: false,
    sources: [
      { taxonomy: "us-gaap", tag: "NetIncomeLoss", unit: "USD" },
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
  return [...rows.values()];
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
