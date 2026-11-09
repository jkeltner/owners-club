import { describe, expect, it } from "vitest";
import { parseEarningsCalendar, parseAvTime } from "@/market/alpha_vantage";
import { instantFrameFor, recentQuarterFrames, recentYearFrames } from "@/market/edgar";
import { lensFor } from "@/market/lens";
import { weekdaysBetween } from "@/market/massive";
import { computeMetrics, frameForDate, peBand, quarters, type FinancialRow } from "@/market/metrics";
import { parseSp500Table, toSecTicker } from "@/market/sp500";

describe("lenses from GICS", () => {
  it("maps the kinds we have lenses for", () => {
    expect(lensFor("Information Technology", "Semiconductors")).toBe("Chipmakers");
    expect(lensFor("Information Technology", "Application Software")).toBe("Software");
    expect(lensFor("Consumer Discretionary", "Broadline Retail")).toBe("Retailers and restaurants");
    expect(lensFor("Consumer Discretionary", "Restaurants")).toBe("Retailers and restaurants");
    expect(lensFor("Financials", "Diversified Banks")).toBe("Banks");
    expect(lensFor("Communication Services", "Interactive Media & Services")).toBe("Media and streaming");
    expect(lensFor("Health Care", "Pharmaceuticals")).toBe("Drugmakers and biotech");
    expect(lensFor("Energy", "Integrated Oil & Gas")).toBe("Energy producers");
    expect(lensFor("Industrials", "Aerospace & Defense")).toBe("Aerospace and defense");
    expect(lensFor("Consumer Staples", "Household Products")).toBe("Consumer brands");
  });
  it("leaves the rest without a lens", () => {
    expect(lensFor("Utilities", "Electric Utilities")).toBeNull();
    expect(lensFor("Real Estate", "Office REITs")).toBeNull();
    expect(lensFor("Financials", "Asset Management & Custody Banks")).toBeNull();
  });
});

describe("S&P 500 table", () => {
  const html = `<table id="constituents"><tbody>
    <tr><th>Symbol</th><th>Security</th><th>GICS Sector</th><th>GICS Sub-Industry</th><th>Headquarters Location</th><th>Date added</th><th>CIK</th><th>Founded</th></tr>
    ${Array.from({ length: 500 }, (_, i) => `<tr><td><a href="#">T${i}</a></td><td>Company ${i}</td><td>Industrials</td><td>Building Products</td><td>Somewhere</td><td>2017-07-26</td><td>${1000 + i}</td><td>1916</td></tr>`).join("")}
    <tr><td>BRK.B</td><td>Berkshire Hathaway</td><td>Financials</td><td>Multi-Sector Holdings</td><td>Omaha</td><td>2010-02-16</td><td>0001067983</td><td>1839</td></tr>
    <tr><td>NVDA</td><td>Nvidia</td><td>Information Technology</td><td>Semiconductors</td><td>Santa Clara</td><td>2001-11-30</td><td>0001045810</td><td>1993</td></tr>
  </tbody></table>`;
  it("parses tickers, sectors, CIKs and lenses", () => {
    const members = parseSp500Table(html);
    expect(members).toHaveLength(502);
    const nvda = members.find((m) => m.ticker === "NVDA")!;
    expect(nvda).toMatchObject({ name: "Nvidia", sector: "Information Technology", cik: 1045810, lens: "Chipmakers", addedToIndex: "2001-11-30" });
    expect(members.find((m) => m.ticker === "BRK.B")?.lens).toBeNull();
    expect(toSecTicker("BRK.B")).toBe("BRK-B");
  });
  it("refuses a page that no longer looks like the list", () => {
    expect(() => parseSp500Table("<table id=\"constituents\"><tr><th>Symbol</th></tr></table>")).toThrow();
  });
});

describe("EDGAR frames", () => {
  it("names the last complete quarters and years", () => {
    const today = new Date("2026-11-09T12:00:00Z");
    expect(recentQuarterFrames(today, 5)).toEqual(["CY2026Q3", "CY2026Q2", "CY2026Q1", "CY2025Q4", "CY2025Q3"]);
    expect(recentQuarterFrames(new Date("2026-01-15T00:00:00Z"), 2)).toEqual(["CY2025Q4", "CY2025Q3"]);
    expect(recentYearFrames(today, 2)).toEqual(["CY2025", "CY2024"]);
    expect(instantFrameFor("CY2026Q3")).toBe("CY2026Q3I");
    expect(instantFrameFor("CY2025")).toBe("CY2025Q4I");
  });
});

describe("Massive", () => {
  it("lists weekdays", () => {
    expect(weekdaysBetween("2026-11-06", "2026-11-10")).toEqual(["2026-11-06", "2026-11-09", "2026-11-10"]);
  });
});

describe("Alpha Vantage", () => {
  it("parses the earnings calendar CSV", () => {
    const csv = `symbol,name,reportDate,fiscalDateEnding,estimate,currency\nAAPL,Apple Inc,2027-01-28,2026-12-31,2.45,USD\nXYZ,"Comma, Inc",2027-02-02,2026-12-31,,USD\n`;
    const rows = parseEarningsCalendar(csv);
    expect(rows).toEqual([
      { ticker: "AAPL", name: "Apple Inc", reportDate: "2027-01-28", fiscalDateEnding: "2026-12-31", estimateEps: 2.45 },
      { ticker: "XYZ", name: "Comma, Inc", reportDate: "2027-02-02", fiscalDateEnding: "2026-12-31", estimateEps: null },
    ]);
  });
  it("parses timestamps", () => {
    expect(parseAvTime("20220410T013000").toISOString()).toBe("2022-04-10T01:30:00.000Z");
  });
});

// A company with a September fiscal year: three 10-Q quarters and a 10-K, so
// the fourth quarter has to be derived.
const row = (over: Partial<FinancialRow>): FinancialRow => ({
  cik: 1,
  period: "",
  periodStart: null,
  periodEnd: null,
  revenue: null,
  netIncome: null,
  epsDiluted: null,
  grossProfit: null,
  operatingIncome: null,
  operatingCashFlow: null,
  capex: null,
  sharesOutstanding: null,
  cash: null,
  longTermDebt: null,
  equity: null,
  goodwill: null,
  intangibles: null,
  accession: null,
  filed: null,
  updatedAt: new Date(),
  ...over,
});
const q = (period: string, start: string, end: string, revenue: number, netIncome: number) =>
  row({ period, periodStart: start, periodEnd: end, revenue, netIncome, grossProfit: revenue / 2, operatingCashFlow: netIncome + 10, capex: 5, epsDiluted: 1 });

const rows: FinancialRow[] = [
  q("CY2025Q4", "2025-10-01", "2025-12-31", 120, 30), // fiscal Q1 2026
  q("CY2025Q2", "2025-04-01", "2025-06-30", 100, 20),
  q("CY2025Q1", "2025-01-01", "2025-03-31", 90, 18),
  q("CY2024Q4", "2024-10-01", "2024-12-31", 110, 25),
  // The 10-K: Oct 2024 to Sep 2025. Its Q3 2025 quarter is never filed on its own.
  row({ period: "CY2025", periodStart: "2024-10-01", periodEnd: "2025-09-30", revenue: 400, netIncome: 83, grossProfit: 200, operatingCashFlow: 123, capex: 20, epsDiluted: 4, sharesOutstanding: 1000, equity: 500, cash: 50, longTermDebt: 100 }),
  // Prior year's quarters for growth.
  q("CY2024Q3", "2024-07-01", "2024-09-30", 95, 22),
  q("CY2024Q2", "2024-04-01", "2024-06-30", 85, 17),
  q("CY2024Q1", "2024-01-01", "2024-03-31", 80, 15),
];

describe("metrics", () => {
  it("derives the 10-K quarter", () => {
    const qs = quarters(rows);
    const derived = qs.find((x) => x.derived)!;
    expect(derived.period).toBe("CY2025Q3");
    expect(derived.periodStart).toBe("2025-07-01");
    expect(derived.periodEnd).toBe("2025-09-30");
    expect(derived.revenue).toBe(400 - 110 - 90 - 100);
    expect(derived.netIncome).toBe(83 - 25 - 18 - 20);
    expect(qs[0].period).toBe("CY2025Q4");
    expect(frameForDate("2025-09-30")).toBe("CY2025Q3");
  });
  it("computes trailing numbers from the latest four quarters", () => {
    const m = computeMetrics(rows, 10);
    expect(m.latestPeriod).toBe("CY2025Q4");
    expect(m.revenueTtm).toBe(120 + 100 + 90 + 100); // Q4'25, Q3'25 (derived), Q2'25, Q1'25
    expect(m.netIncomeTtm).toBe(30 + 20 + 20 + 18);
    expect(m.marketCap).toBe(10_000);
    expect(m.pe).toBe(Math.round((10_000 / 88) * 10) / 10);
    expect(m.revenueGrowth).toBe(Math.round(((410 - (110 + 95 + 85 + 80)) / 370) * 1000) / 10);
    expect(m.grossMargin).toBe(50);
    expect(m.equity).toBe(500);
    expect(m.roe).toBe(Math.round((88 / 500) * 1000) / 10);
    // Operating cash flow 40 + 30 (derived: 123 − 93) + 30 + 28 = 128, less capex 4 × 5.
    expect(m.fcfTtm).toBe(108);
  });
  it("handles a company with nothing stored", () => {
    const m = computeMetrics([], 50);
    expect(m.pe).toBeNull();
    expect(m.quartersAvailable).toBe(0);
  });
  it("finds the middle half of P/Es", () => {
    expect(peBand([10, 12, 14, 16, 18, 20, 22, 24])).toEqual([14, 20]);
    expect(peBand([10, 12])).toBeNull();
  });
});
