import { beforeAll, describe, expect, it } from "vitest";
import { companyLines, lenses, marketFacts, notInGame, themes } from "@/content";
import { db, dbReady } from "@/db";
import { companies, earningsDates, financials, prices } from "@/db/schema";
import { PRIVATE_SCRIPTS } from "@/coach/script";
import { LENS_LABELS_WITH_VALUES, lensValue } from "@/market/lens_values";
import { computeMetrics, indexPe, lastQuarter, recentProfits, topShare, type FinancialRow } from "@/market/metrics";
import { companyLine, displayName, tidyName } from "@/market/names";
import { companyView, forgetCompanyCards, forgetMarketSnapshot, marketSnapshot, searchCards, todayInNewYork, usualPe, type CompanyCard } from "@/market/read";

describe("company names and lines", () => {
  it("tidies the member list's official names", () => {
    expect(tidyName("Walt Disney Company (The)")).toBe("Walt Disney Company");
    expect(tidyName("Nike, Inc.")).toBe("Nike");
    expect(tidyName("Apple Inc.")).toBe("Apple");
    expect(tidyName("Target Corporation")).toBe("Target");
    expect(tidyName("Alphabet Inc. (Class C)")).toBe("Alphabet");
    expect(tidyName("Lilly (Eli)")).toBe("Eli Lilly");
    expect(tidyName("Linde plc")).toBe("Linde");
    expect(tidyName("Deere & Company")).toBe("Deere & Company");
    expect(tidyName("JPMorgan Chase")).toBe("JPMorgan Chase");
  });

  it("uses the hand-written name and line where there is one, else the industry", () => {
    expect(displayName("GOOGL", "Alphabet Inc. (Class A)")).toBe("Alphabet (Google)");
    expect(displayName("XOM", "ExxonMobil")).toBe("ExxonMobil");
    expect(companyLine("NVDA", "Semiconductors")).toBe("Makes the chips that power AI");
    expect(companyLine("XOM", "Integrated Oil & Gas")).toBe("Integrated Oil & Gas");
    expect(companyLine("XOM", "Integrated Oil & Gas", "Finds and sells oil and gas")).toBe("Finds and sells oil and gas");
  });

  it("has a line for every company the themes and the private-company lessons point at", () => {
    const pointedAt = new Set([...themes.flatMap((t) => t.tickers), ...Object.values(PRIVATE_SCRIPTS).flatMap((s) => s.tickers.split(","))]);
    for (const ticker of pointedAt) expect(companyLines[ticker], ticker).toBeDefined();
    for (const p of notInGame) expect(PRIVATE_SCRIPTS[p.name], p.name).toBeDefined();
  });

  it("gives every looked-up market number a source and a date", () => {
    expect(Object.keys(marketFacts).sort()).toEqual(["long_run_return_pct", "public_one_in", "sp500_share_of_us_market_pct", "us_listed_companies", "us_listed_companies_1996"]);
    for (const f of Object.values(marketFacts)) {
      expect(typeof f.value).toBe("number");
      expect(f.source.length).toBeGreaterThan(10);
      expect(f.url).toMatch(/^https:\/\//);
      expect(f.as_of).toBeTruthy();
    }
  });
});

describe("search", () => {
  const cards: CompanyCard[] = [
    { ticker: "GOOGL", name: "Alphabet (Google)", line: "Google search, YouTube, and Gemini AI" },
    { ticker: "MCD", name: "McDonald's", line: "Burgers and fries in 100+ countries" },
    { ticker: "META", name: "Meta", line: "Instagram, WhatsApp, Facebook and Meta AI" },
    { ticker: "MET", name: "MetLife", line: "Life & Health Insurance" },
    { ticker: "T", name: "AT&T", line: "Integrated Telecommunication Services" },
    { ticker: "TGT", name: "Target", line: "Big-box stores for almost everything" },
  ];
  const found = (q: string) => searchCards(cards, q).map((c) => c.ticker);

  it("finds by ticker, by name and by what the company is known for", () => {
    expect(found("meta")).toEqual(["META"]);
    expect(found("met")).toEqual(["MET", "META"]); // the ticker itself first, then names starting with it
    expect(found("mcdonalds")).toEqual(["MCD"]);
    expect(found("Mc Donald's")).toEqual(["MCD"]);
    expect(found("youtube")).toEqual(["GOOGL"]);
    expect(found("instagram")).toEqual(["META"]);
    expect(found("t")).toEqual(["T", "TGT"]);
    expect(found("at&t")).toEqual(["T"]);
    expect(found("zzz")).toEqual([]);
    expect(found("  ")).toEqual([]);
  });
});

const row = (cik: number, period: string, periodStart: string, periodEnd: string, more: Partial<FinancialRow>): FinancialRow =>
  ({ cik, period, periodStart, periodEnd, revenue: null, netIncome: null, epsDiluted: null, grossProfit: null, operatingIncome: null, operatingCashFlow: null, capex: null, sharesOutstanding: null, sharesDiluted: null, cash: null, longTermDebt: null, equity: null, goodwill: null, intangibles: null, accession: null, filed: null, updatedAt: new Date(), ...more }) as FinancialRow;

// Eight calendar quarters, 2024 Q4 to 2026 Q3, oldest first.
const eightQuarters = (cik: number, f: (i: number) => Partial<FinancialRow>): FinancialRow[] =>
  Array.from({ length: 8 }, (_, i) => {
    const q = (3 + i) % 4;
    const year = 2024 + Math.floor((3 + i) / 4);
    return row(cik, `CY${year}Q${q + 1}`, `${year}-${["01-01", "04-01", "07-01", "10-01"][q]}`, `${year}-${["03-31", "06-30", "09-30", "12-31"][q]}`, f(i));
  });

describe("numbers for the screens", () => {
  const rows = eightQuarters(1, (i) => ({ revenue: (100 + i * 10) * 1e6, netIncome: (10 + i) * 1e6, epsDiluted: 0.1 + i / 100, sharesOutstanding: 100e6, grossProfit: (50 + i * 5) * 1e6 }));

  it("reads the latest quarter against the same quarter a year before", () => {
    // 2026 Q3: revenue 170 against 2025 Q3's 130.
    expect(lastQuarter(rows)).toMatchObject({ period: "CY2026Q3", revenueGrowth: 30.8, eps: 0.17, netMargin: 10 });
    expect(lastQuarter(rows.slice(4))?.revenueGrowth).toBeNull(); // under five quarters: no year-ago quarter
    expect(lastQuarter([])).toBeNull();
    // A quarter missing in between: the fifth row back isn't a year ago.
    expect(lastQuarter(rows.filter((r) => r.period !== "CY2026Q1"))?.revenueGrowth).toBeNull();
  });

  it("lists the last four quarters' profit, newest first", () => {
    expect(recentProfits(rows).map((p) => [p.periodEnd, p.netIncome / 1e6])).toEqual([
      ["2026-09-30", 17],
      ["2026-06-30", 16],
      ["2026-03-31", 15],
      ["2025-12-31", 14],
    ]);
  });

  it("computes the index's P/E and top-10 share only when most of the index is there", () => {
    const few = [{ marketCap: 100, netIncomeTtm: 5 }];
    expect(indexPe(few)).toBeNull();
    expect(topShare(few)).toBeNull();
    const many = Array.from({ length: 100 }, (_, i) => ({ marketCap: i < 10 ? 400 : 100, netIncomeTtm: i === 99 ? -50 : 5 }));
    // Value 10×400 + 90×100 = 13,000; profit 99×5 − 50 = 445 (losses count).
    expect(indexPe(many)).toBe(29.2);
    expect(topShare(many)).toBe(30.8);
  });

  it("shows a lens value only where the filings give one", () => {
    const m = computeMetrics(rows, 30);
    expect(lensValue("Gross margin", m)).toEqual({ value: "50%", sub: "50¢ of each $1 of sales" });
    expect(lensValue("Free cash flow", m)).toBeNull(); // no cash-flow rows
    expect(lensValue("Same-store sales", m)).toBeNull(); // company-reported: named, no number
    const labels = new Set(lenses.flatMap((l) => [l.look_first, ...l.then]));
    for (const label of LENS_LABELS_WITH_VALUES) expect(labels.has(label), label).toBe(true);
  });
});

describe("reading the cache", () => {
  beforeAll(async () => {
    await dbReady;
    await db.insert(companies).values([
      { ticker: "RDR", name: "Readerco, Inc.", cik: 900300, sector: "Information Technology", subIndustry: "Semiconductors", lens: "Chipmakers" },
      { ticker: "OUT", name: "Outco", cik: 900301, sector: "Energy", subIndustry: "Oil & Gas Drilling", status: "removed" },
    ]);
    await db.insert(financials).values(eightQuarters(900300, (i) => ({ revenue: (100 + i * 10) * 1e6, netIncome: (20 + i) * 1e6, epsDiluted: 0.2 + i / 100, sharesOutstanding: 100e6 })));
    await db.insert(prices).values([
      { ticker: "RDR", date: "2026-11-10", close: 28, source: "test" },
      { ticker: "RDR", date: "2026-11-11", close: 29, source: "test" },
      { ticker: "RDR", date: "2026-11-12", close: 30, source: "test" },
    ]);
    await db.insert(earningsDates).values([
      { ticker: "RDR", date: "2026-08-20", status: "reported", source: "test" },
      { ticker: "RDR", date: "2026-11-20", status: "estimated", source: "test" },
      { ticker: "RDR", date: "2027-02-18", status: "estimated", source: "test" },
    ]);
    forgetCompanyCards();
    forgetMarketSnapshot();
  });

  it("builds a company's card from its stored rows", async () => {
    const c = (await companyView("rdr", "2026-11-13"))!;
    expect(c).toMatchObject({ ticker: "RDR", name: "Readerco", line: "Semiconductors", price: 30, priceDate: "2026-11-12", isAi: false });
    expect(c.lens?.kind).toBe("Chipmakers");
    expect(c.series.map((p) => p.close)).toEqual([28, 29, 30]);
    // Price 30 × 100M shares = $3.0B; trailing profit 24+25+26+27 = $102M.
    expect(c.metrics.marketCap).toBe(3e9);
    expect(c.metrics.pe).toBe(29.4);
    expect(c.earnings).toEqual({ date: "2026-11-20", status: "estimated", daysAway: 7 });
    expect(c.last?.period).toBe("CY2026Q3");
  });

  it("says so when there's no upcoming earnings date, and hides companies no longer in the index", async () => {
    expect((await companyView("RDR", "2027-03-01"))?.earnings).toBeNull();
    expect(await companyView("OUT")).toBeNull();
    expect(await companyView("NOPE")).toBeNull();
  });

  it("holds back index-wide numbers until most of the index is loaded, and falls back to the lens's rough P/E range", async () => {
    const market = await marketSnapshot();
    expect(market.asOf).toBe("2026-11-12");
    expect(market.marketPe).toBeNull();
    expect(market.top10Pct).toBeNull();
    expect(usualPe("Chipmakers", market)).toEqual([15, 35]);
    expect(usualPe("Chipmakers", { ...market, bands: { Chipmakers: [23, 42] } })).toEqual([23, 42]);
    expect(usualPe(null, market)).toBeUndefined();
  });

  it("knows what day it is in New York", () => {
    expect(todayInNewYork(new Date("2026-11-13T03:30:00Z"))).toBe("2026-11-12"); // 10:30 pm the night before
    expect(todayInNewYork(new Date("2026-11-13T15:00:00Z"))).toBe("2026-11-13");
  });
});
