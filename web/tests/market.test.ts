import { describe, expect, it } from "vitest";
import { earningsLookupWindow, parseEarningsCalendar, parseAvTime } from "@/market/alpha_vantage";
import { peLabel } from "@/lib/format";
import { fixProxyScale, instantFrameFor, mergePredecessors, recentQuarterFrames, recentYearFrames, storedValue, withPredecessors } from "@/market/edgar";
import { quartersFromFacts, type Fact } from "@/market/edgar_facts";
import { lensFor } from "@/market/lens";
import { weekdaysBetween } from "@/market/massive";
import { computeMetrics, contiguous, frameForDate, frameForPeriod, onePerCompany, peBand, quarters, shareCount, type FinancialRow } from "@/market/metrics";
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
    expect(recentYearFrames(today, 2)).toEqual(["CY2026", "CY2025", "CY2024"]); // the current year holds fiscal years that already ended
    expect(instantFrameFor("CY2026Q3")).toBe("CY2026Q3I");
    expect(instantFrameFor("CY2025")).toBe("CY2025Q4I");
  });
});

describe("EDGAR values as stored", () => {
  it("drops a fractional share count, rounds fractional dollars, keeps EPS as reported", () => {
    expect(storedValue("sharesDiluted", 708.3)).toBeNull(); // McDonald's tags millions without the scale
    expect(storedValue("sharesDiluted", 708_300_000)).toBe(708_300_000);
    expect(storedValue("sharesOutstanding", 12.5)).toBeNull();
    expect(storedValue("revenue", 1_000_000.4)).toBe(1_000_000);
    expect(storedValue("epsDiluted", 3.18)).toBe(3.18);
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
  sharesDiluted: null,
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

describe("shares outstanding fallback", () => {
  // The Apple-style rows above, but as a dual-class filer: no shares
  // outstanding anywhere, because EDGAR's frames drop per-class values.
  const dualClass = rows.map((r) => ({ ...r, sharesOutstanding: null }));

  it("uses reported shares outstanding when there are any", () => {
    const m = computeMetrics(rows, 10);
    expect(m.sharesSource).toBe("reported");
    expect(m.sharesOutstanding).toBe(1000);
  });
  it("falls back to trailing net income ÷ trailing diluted EPS over the same four quarters", () => {
    const m = computeMetrics(dualClass, 10);
    // Net income 30 + 20 + 20 + 18 = 88; EPS 1 + 1 + (4 − 3) + 1 = 4.
    expect(m.sharesSource).toBe("derived");
    expect(m.sharesOutstanding).toBe(22);
    expect(m.marketCap).toBe(220);
    expect(m.pe).toBe(2.5);
  });
  it("prefers the latest quarter's weighted-average diluted shares over the estimate", () => {
    const withDiluted = dualClass.map((r) =>
      r.period === "CY2025Q4" ? { ...r, sharesDiluted: 30 } : r.period === "CY2025Q2" ? { ...r, sharesDiluted: 31 } : r.period === "CY2025" ? { ...r, sharesDiluted: 33 } : r,
    );
    const m = computeMetrics(withDiluted, 10);
    expect(m.sharesSource).toBe("diluted");
    expect(m.sharesOutstanding).toBe(30);
    expect(m.marketCap).toBe(300);
  });
  it("gives up when EPS is zero or missing", () => {
    expect(shareCount(dualClass, 88, 0)).toBeNull();
    expect(shareCount(dualClass, 88, null)).toBeNull();
    expect(shareCount(dualClass, null, 4)).toBeNull();
    const m = computeMetrics(dualClass.map((r) => ({ ...r, epsDiluted: null })), 10);
    expect(m.sharesSource).toBeNull();
    expect(m.marketCap).toBeNull();
    expect(m.pe).toBeNull();
  });
  it("doesn't turn a loss into a negative share count", () => {
    expect(shareCount(dualClass, -88, 4)).toBeNull();
    // A loss with a loss per share is still a positive count.
    expect(shareCount(dualClass, -88, -4)).toEqual({ count: 22, source: "derived" });
  });
});

describe("dual listings", () => {
  it("keeps one row per CIK, the first ticker alphabetically, and every row with no CIK", () => {
    const members = [
      { ticker: "GOOGL", cik: 1652044, pe: 25 },
      { ticker: "AAPL", cik: 320193, pe: 38 },
      { ticker: "GOOG", cik: 1652044, pe: 25 },
      { ticker: "FOXA", cik: 1754301, pe: 12 },
      { ticker: "FOX", cik: 1754301, pe: 12 },
      { ticker: "NWSA", cik: 1564708, pe: 30 },
      { ticker: "NWS", cik: 1564708, pe: 30 },
      { ticker: "NEW1", cik: null, pe: null },
      { ticker: "NEW2", cik: null, pe: null },
    ];
    expect(onePerCompany(members).map((m) => m.ticker)).toEqual(["AAPL", "GOOG", "FOX", "NWS", "NEW1", "NEW2"]);
    expect(onePerCompany([])).toEqual([]);
  });
});

// Fiscal years that don't end in December, laid out the way EDGAR's frames
// assign them: each quarter goes to the calendar quarter holding most of it,
// each year to the calendar year holding most of it.
const fq = (period: string, start: string, end: string, netIncome: number) => row({ period, periodStart: start, periodEnd: end, revenue: netIncome * 10, netIncome, epsDiluted: netIncome / 100 });
const fy = (period: string, start: string, end: string, netIncome: number) => row({ period, periodStart: start, periodEnd: end, revenue: netIncome * 10, netIncome, epsDiluted: netIncome / 100, sharesOutstanding: 100 });

describe("off-calendar fiscal years", () => {
  it("names a quarter by the calendar quarter holding most of it", () => {
    expect(frameForPeriod("2025-07-01", "2025-09-30")).toBe("CY2025Q3");
    expect(frameForPeriod("2026-02-01", "2026-04-30")).toBe("CY2026Q1"); // ends in Q2, mostly Q1
    expect(frameForPeriod("2026-03-01", "2026-05-31")).toBe("CY2026Q2");
  });

  it("derives a December year's fourth quarter", () => {
    const dec = [
      fq("CY2025Q1", "2025-01-01", "2025-03-31", 10),
      fq("CY2025Q2", "2025-04-01", "2025-06-30", 11),
      fq("CY2025Q3", "2025-07-01", "2025-09-30", 12),
      fy("CY2025", "2025-01-01", "2025-12-31", 50),
    ];
    const derived = quarters(dec).find((x) => x.derived)!;
    expect(derived).toMatchObject({ period: "CY2025Q4", periodStart: "2025-10-01", periodEnd: "2025-12-31", netIncome: 17 });
    expect(computeMetrics(dec, 10).netIncomeTtm).toBe(50);
  });

  it("derives an Apple-style 52/53-week September year", () => {
    // Apple's real fiscal 2025 dates: Sep 29 2024 to Sep 27 2025.
    const sep = [
      fq("CY2024Q4", "2024-09-29", "2024-12-28", 36),
      fq("CY2025Q1", "2024-12-29", "2025-03-29", 25),
      fq("CY2025Q2", "2025-03-30", "2025-06-28", 23),
      fy("CY2025", "2024-09-29", "2025-09-27", 112),
    ];
    const derived = quarters(sep).find((x) => x.derived)!;
    expect(derived).toMatchObject({ period: "CY2025Q3", periodStart: "2025-06-29", periodEnd: "2025-09-27", netIncome: 28 });
  });

  // A FedEx/General Mills-style May year: June 2025 to May 2026, booked by
  // EDGAR as CY2025. Its quarters land in CY2025Q3, CY2025Q4 and CY2026Q1;
  // the 10-K quarter (March to May) is CY2026Q2.
  const may = [
    fq("CY2026Q3", "2026-06-01", "2026-08-31", 30), // fiscal 2027 Q1
    fq("CY2026Q1", "2025-12-01", "2026-02-28", 20),
    fq("CY2025Q4", "2025-09-01", "2025-11-30", 22),
    fq("CY2025Q3", "2025-06-01", "2025-08-31", 25),
    fy("CY2025", "2025-06-01", "2026-05-31", 95),
    fq("CY2025Q1", "2024-12-01", "2025-02-28", 18),
    fq("CY2024Q4", "2024-09-01", "2024-11-30", 21),
    fq("CY2024Q3", "2024-06-01", "2024-08-31", 24),
    fy("CY2024", "2024-06-01", "2025-05-31", 88),
  ];

  it("derives a May year's fourth quarter from that year's own three", () => {
    const qs = quarters(may);
    const derived = qs.filter((x) => x.derived);
    expect(derived.map((d) => [d.period, d.periodStart, d.periodEnd, d.netIncome])).toEqual([
      ["CY2026Q2", "2026-03-01", "2026-05-31", 95 - 25 - 22 - 20],
      ["CY2025Q2", "2025-03-01", "2025-05-31", 88 - 24 - 21 - 18],
    ]);
    const m = computeMetrics(may, 10);
    expect(m.netIncomeTtm).toBe(30 + 28 + 20 + 22);
    expect(m.pe).toBeGreaterThan(0);
  });

  it("doesn't subtract from an annual figure filed in millions without the scale", () => {
    // FedEx's 10-K tags net income as 4,433 (meaning $4,433 million). Year
    // minus three real quarters would be a loss of nearly $3 billion.
    const misScaled = [
      fq("CY2026Q1", "2025-12-01", "2026-02-28", 1_060_000_000),
      fq("CY2025Q4", "2025-09-01", "2025-11-30", 956_000_000),
      fq("CY2025Q3", "2025-06-01", "2025-08-31", 920_000_000),
      fy("CY2025", "2025-06-01", "2026-05-31", 4433),
    ];
    const derived = quarters(misScaled).find((x) => x.derived)!;
    expect(derived.netIncome).toBeNull();
    expect(computeMetrics(misScaled, 10).netIncomeTtm).toBeNull();
  });

  it("skips the year when its three quarters aren't back to back (no fake quarter before the year starts)", () => {
    // Fiscal Q2 never made it into a frame, but the 10-K tagged its own
    // March-to-May quarter. The old rule saw three quarters inside the year,
    // found the last one flush with the year end, and "derived" a quarter
    // ending the day before the year began, worth the missing Q2.
    const gappy = [
      fq("CY2026Q2", "2026-03-01", "2026-05-31", 28),
      fq("CY2026Q1", "2025-12-01", "2026-02-28", 20),
      fq("CY2025Q3", "2025-06-01", "2025-08-31", 25),
      fy("CY2025", "2025-06-01", "2026-05-31", 95),
    ];
    expect(quarters(gappy).filter((x) => x.derived)).toEqual([]);
    // And the trailing sum refuses to add quarters with a hole between them.
    const m = computeMetrics(gappy, 10);
    expect(m.netIncomeTtm).toBeNull();
    expect(m.pe).toBeNull();
  });

  it("skips quarters from a different fiscal year and years that aren't twelve months", () => {
    // Annual dates June to May, but the quarters on file are a calendar
    // year's: two of them start before the fiscal year does.
    const mismatched = [
      fq("CY2025Q3", "2025-07-01", "2025-09-30", 25),
      fq("CY2025Q4", "2025-10-01", "2025-12-31", 22),
      fq("CY2026Q1", "2026-01-01", "2026-03-31", 20),
      fy("CY2025", "2025-06-01", "2026-05-31", 95),
    ];
    // July to March is nine months, but the hole left (April to May plus June) isn't one quarter.
    expect(quarters(mismatched).filter((x) => x.derived)).toEqual([]);
    const transition = [
      fq("CY2025Q1", "2025-01-01", "2025-03-31", 10),
      fq("CY2025Q2", "2025-04-01", "2025-06-30", 11),
      fq("CY2025Q3", "2025-07-01", "2025-09-30", 12),
      fy("CY2025", "2025-01-01", "2026-01-31", 60), // a 13-month transition period
    ];
    expect(quarters(transition).filter((x) => x.derived)).toEqual([]);
  });

  it("derives an April year's last quarter even though its end date falls in the next frame", () => {
    // A Smucker-style April year: May 2025 to April 2026. Its quarters land
    // in CY2025Q2 (May-Jul), CY2025Q3 (Aug-Oct) and CY2025Q4 (Nov-Jan); the
    // 10-K quarter (Feb-Apr) is mostly Q1. Naming it by its end date (Q2)
    // collided with next year's first quarter, so it was never derived and
    // the trailing sum reached back fifteen months.
    const apr = [
      fq("CY2026Q2", "2026-05-01", "2026-07-31", 30), // fiscal 2027 Q1
      fq("CY2025Q4", "2025-11-01", "2026-01-31", 20),
      fq("CY2025Q3", "2025-08-01", "2025-10-31", 22),
      fq("CY2025Q2", "2025-05-01", "2025-07-31", 25),
      fy("CY2025", "2025-05-01", "2026-04-30", 95),
    ];
    const derived = quarters(apr).find((x) => x.derived)!;
    expect(derived).toMatchObject({ period: "CY2026Q1", periodStart: "2026-02-01", periodEnd: "2026-04-30", netIncome: 28 });
    expect(computeMetrics(apr, 10).netIncomeTtm).toBe(30 + 28 + 20 + 22);
  });

  it("checks quarters run back to back", () => {
    expect(contiguous([{ periodStart: "2025-10-01", periodEnd: "2025-12-31" }, { periodStart: "2025-07-01", periodEnd: "2025-09-30" }])).toBe(true);
    expect(contiguous([{ periodStart: "2025-10-01", periodEnd: "2025-12-31" }, { periodStart: "2025-04-01", periodEnd: "2025-06-30" }])).toBe(false);
    expect(contiguous([{ periodStart: "2024-12-29", periodEnd: "2025-03-29" }, { periodStart: "2024-09-29", periodEnd: "2024-12-28" }])).toBe(true);
  });
});

describe("earnings lookup window", () => {
  it("leaves out today: at 1 am Eastern nobody reporting today has reported", () => {
    // The run of 2026-11-12 06:00 UTC asked for AMAT and CSCO, both dated 2026-11-12.
    const w = earningsLookupWindow(new Date("2026-11-12T06:00:10Z"));
    expect(w).toEqual({ from: "2026-11-05", before: "2026-11-12" });
    expect("2026-11-12" < w.before).toBe(false);
    expect("2026-11-11" < w.before).toBe(true);
  });
});

describe("P/E as shown", () => {
  it("shows the number up to 100 and 'over 100' above it", () => {
    expect(peLabel(38.8)).toBe("38.8");
    expect(peLabel(100)).toBe("100.0");
    expect(peLabel(312.4)).toBe("over 100");
    expect(peLabel(null)).toBeNull();
  });
});

describe("figures from the real rows, 2026-11-12", () => {
  it("scales up net income filed in millions or thousands, checked against EPS times shares", () => {
    // PG&E 2025: the proxy statement's 2,593; EPS 1.18 on 2,202M diluted shares.
    expect(fixProxyScale({ cik: 1, period: "CY2025", netIncome: 2593, epsDiluted: 1.18, sharesDiluted: 2_202_000_000 }).netIncome).toBe(2_593_000_000);
    // Con Edison 2025: filed in thousands; EPS 5.64 on 359M shares.
    expect(fixProxyScale({ cik: 1, period: "CY2025", netIncome: 2_023_000, epsDiluted: 5.64, sharesDiluted: 359_000_000 }).netIncome).toBe(2_023_000_000);
    // Schwab 2025: thousands, and EPS is after preferred dividends (8% apart).
    expect(fixProxyScale({ cik: 1, period: "CY2025", netIncome: 9_140_000, epsDiluted: 4.65, sharesDiluted: 1_809_000_000 }).netIncome).toBe(9_140_000_000);
    // Waters, second quarter of 2026: the share count is a thousand times too big, the loss is right.
    expect(fixProxyScale({ cik: 1, period: "CY2026Q2", netIncome: -136_000_000, epsDiluted: -1.39, sharesDiluted: 98_204_000_000 }).netIncome).toBe(-136_000_000);
    expect(fixProxyScale({ cik: 1, period: "CY2025", netIncome: -136_000_000, epsDiluted: -1.39, sharesDiluted: 98_204_000_000 }).netIncome).toBe(-136_000_000);
    // A normal row is left alone, and so is one with nothing to check against.
    expect(fixProxyScale({ cik: 1, period: "CY2025", netIncome: 18_254_000_000, epsDiluted: 7.28, sharesDiluted: 2_507_000_000 }).netIncome).toBe(18_254_000_000);
    expect(fixProxyScale({ cik: 1, period: "CY2025", netIncome: 2593 }).netIncome).toBe(2593);
  });

  it("stores a predecessor registrant's rows under the current CIK", () => {
    expect([...withPredecessors(new Set([2115436, 5]))].sort()).toEqual([2115436, 34088, 5].sort());
    const merged = mergePredecessors([
      { cik: 34088, period: "CY2026Q1", revenue: 100, netIncome: 10 },
      { cik: 34088, period: "CY2026Q2", revenue: 999, sharesDiluted: 7 },
      { cik: 2115436, period: "CY2026Q2", revenue: 116 },
      { cik: 5, period: "CY2026Q2", revenue: 1 },
    ]);
    expect(merged).toHaveLength(3);
    expect(merged.find((r) => r.period === "CY2026Q1")).toMatchObject({ cik: 2115436, revenue: 100 });
    // Both reported the quarter: the current registrant's number wins, gaps are filled.
    expect(merged.find((r) => r.cik === 2115436 && r.period === "CY2026Q2")).toMatchObject({ revenue: 116, sharesDiluted: 7 });
  });

  it("fills the one line a stored fourth quarter is missing from the year", () => {
    // Target-style: the 10-K quarter has net income but no revenue.
    const q4 = { ...fq("CY2025Q4", "2025-10-01", "2025-12-31", 17), revenue: null };
    const year = [fq("CY2025Q1", "2025-01-01", "2025-03-31", 10), fq("CY2025Q2", "2025-04-01", "2025-06-30", 11), fq("CY2025Q3", "2025-07-01", "2025-09-30", 12), q4, fy("CY2025", "2025-01-01", "2025-12-31", 50)];
    const expected = year[4].revenue! - year[0].revenue! - year[1].revenue! - year[2].revenue!;
    const qs = quarters(year);
    expect(qs).toHaveLength(4);
    expect(qs[0]).toMatchObject({ period: "CY2025Q4", derived: false, netIncome: 17, revenue: expected });
    expect(computeMetrics(year, 10).revenueTtm).toBe(year[4].revenue);
  });
});

describe("quarters from a company's own facts", () => {
  const fact = (start: string, end: string, val: number, form = "10-Q", filed = end): Fact => ({ start, end, val, accn: `a-${end}`, form, filed });
  const usd = (tag: string, facts: Fact[]) => ({ "us-gaap": { [tag]: { units: { USD: facts } } } });

  it("derives a quarter the API never got from the next year-to-date figure (Dow, 2026)", () => {
    const facts = usd("NetIncomeLoss", [
      fact("2026-01-01", "2026-03-31", -533),
      fact("2026-01-01", "2026-09-30", 646),
      fact("2026-07-01", "2026-09-30", 458),
      fact("2026-01-01", "2026-09-30", 9, "DEF 14A"), // a proxy figure is never used
    ]);
    const stored = [
      { period: "CY2026Q1", periodStart: "2026-01-01", periodEnd: "2026-03-31", netIncome: -533 },
      { period: "CY2026Q3", periodStart: "2026-07-01", periodEnd: "2026-09-30", netIncome: 458 },
    ];
    const out = quartersFromFacts(7, facts, stored, "2025-01-01");
    expect(out).toEqual([{ cik: 7, period: "CY2026Q2", periodStart: "2026-04-01", periodEnd: "2026-06-30", accession: "a-2026-09-30", netIncome: 646 + 533 - 458 }]);
  });

  it("builds quarters from cumulative cash flow: six months less the first quarter", () => {
    const facts = usd("NetCashProvidedByUsedInOperatingActivities", [fact("2026-01-01", "2026-03-31", 100), fact("2026-01-01", "2026-06-30", 250), fact("2026-01-01", "2026-09-30", 450)]);
    const stored = [
      { period: "CY2026Q1", periodStart: "2026-01-01", periodEnd: "2026-03-31", operatingCashFlow: 100 },
      { period: "CY2026Q2", periodStart: "2026-04-01", periodEnd: "2026-06-30", operatingCashFlow: null },
      { period: "CY2026Q3", periodStart: "2026-07-01", periodEnd: "2026-09-30", operatingCashFlow: null },
    ];
    const out = quartersFromFacts(7, facts, stored, "2025-01-01");
    // Stored quarters keep their names and dates; only the blank line is sent.
    expect(out).toEqual([
      { cik: 7, period: "CY2026Q2", operatingCashFlow: 150 },
      { cik: 7, period: "CY2026Q3", operatingCashFlow: 200 },
    ]);
  });

  it("names the second 12-week quarter in a calendar quarter with a b (AutoZone)", () => {
    const facts = usd("NetIncomeLoss", [fact("2025-11-23", "2026-02-14", 480), fact("2026-02-15", "2026-05-09", 641)]);
    const stored = [{ period: "CY2026Q1", periodStart: "2026-02-15", periodEnd: "2026-05-09", netIncome: 641 }];
    const out = quartersFromFacts(7, facts, stored, "2025-01-01");
    expect(out).toEqual([{ cik: 7, period: "CY2026Q1b", periodStart: "2025-11-23", periodEnd: "2026-02-14", accession: "a-2026-02-14", netIncome: 480 }]);
    // And the metrics read it as a quarter.
    const qs = quarters([row({ period: "CY2026Q1", periodStart: "2026-02-15", periodEnd: "2026-05-09", netIncome: 641 }), row({ ...out[0] })]);
    expect(qs.map((q) => q.period)).toEqual(["CY2026Q1", "CY2026Q1b"]);
  });

  it("leaves a matching stored value alone, and takes a restated figure over the original", () => {
    const facts = usd("NetIncomeLoss", [fact("2026-01-01", "2026-03-31", 10, "10-Q", "2026-04-20"), fact("2026-01-01", "2026-03-31", 12, "10-Q", "2027-04-20")]);
    expect(quartersFromFacts(7, facts, [{ period: "CY2026Q1", periodStart: "2026-01-01", periodEnd: "2026-03-31", netIncome: 10 }], "2025-01-01")).toEqual([{ cik: 7, period: "CY2026Q1", netIncome: 12 }]);
    expect(quartersFromFacts(7, facts, [{ period: "CY2026Q1", periodStart: "2026-01-01", periodEnd: "2026-03-31", netIncome: 12 }], "2025-01-01")).toEqual([]);
    expect(quartersFromFacts(7, facts, [], "2025-01-01")[0].netIncome).toBe(12);
  });

  it("corrects a stored row that mixes two fiscal quarters (Costco, early 2026)", () => {
    // The frames gave the row the second quarter's dates and revenue but the third quarter's net income.
    const facts = { "us-gaap": {
      NetIncomeLoss: { units: { USD: [fact("2025-11-24", "2026-02-15", 2035), fact("2026-02-16", "2026-05-10", 2192)] } },
      Revenues: { units: { USD: [fact("2025-11-24", "2026-02-15", 69597), fact("2026-02-16", "2026-05-10", 70527)] } },
    } };
    const stored = [{ period: "CY2026Q1", periodStart: "2025-11-24", periodEnd: "2026-02-15", revenue: 69597, netIncome: 2192 }];
    expect(quartersFromFacts(7, facts, stored, "2025-01-01")).toEqual([
      { cik: 7, period: "CY2026Q1", netIncome: 2035 },
      { cik: 7, period: "CY2026Q1b", periodStart: "2026-02-16", periodEnd: "2026-05-10", accession: "a-2026-05-10", revenue: 70527, netIncome: 2192 },
    ]);
  });

  it("joins a quarter to a stored row that has only balance-sheet values and no dates", () => {
    const facts = usd("NetIncomeLoss", [fact("2025-01-01", "2025-03-31", 506)]);
    const out = quartersFromFacts(7, facts, [{ period: "CY2025Q1", periodStart: null, periodEnd: null }], "2025-01-01");
    expect(out).toEqual([{ cik: 7, period: "CY2025Q1", periodStart: "2025-01-01", periodEnd: "2025-03-31", accession: "a-2025-03-31", netIncome: 506 }]);
  });
});

describe("two annual rows over the same hole", () => {
  it("fills the derived quarter's blank lines from the second year row (Amazon's trailing twelve months)", () => {
    const set = [
      fq("CY2025Q1", "2025-01-01", "2025-03-31", 10), fq("CY2025Q2", "2025-04-01", "2025-06-30", 11), fq("CY2025Q3", "2025-07-01", "2025-09-30", 12),
      fq("CY2026Q1", "2026-01-01", "2026-03-31", 13), fq("CY2026Q2", "2026-04-01", "2026-06-30", 14), fq("CY2026Q3", "2026-07-01", "2026-09-30", 15),
      // October 2025 to September 2026, net income only; listed first so it is read first.
      row({ period: "CY2026", periodStart: "2025-10-01", periodEnd: "2026-09-30", netIncome: 59 }),
      fy("CY2025", "2025-01-01", "2025-12-31", 50),
    ];
    const q4 = quarters(set).find((q) => q.period === "CY2025Q4")!;
    expect(q4).toMatchObject({ derived: true, netIncome: 17, revenue: 500 - 100 - 110 - 120 });
    expect(quarters(set).filter((q) => q.period === "CY2025Q4")).toHaveLength(1);
  });
});
