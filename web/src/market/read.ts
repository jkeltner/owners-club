// What the player-facing screens read from the market-data cache. Screens never
// call a provider and never do their own arithmetic on filings: they ask here
// for a company (with its computed numbers) or for the market as a whole.
import { and, asc, desc, eq, gte, inArray, max, sql } from "drizzle-orm";
import { lens as lensOf, lenses, themes, type Lens } from "@/content";
import { db } from "@/db";
import { companies, earningsDates, financials, prices, type EarningsStatus } from "@/db/schema";
import { computeMetrics, indexPe, lastQuarter, onePerCompany, peBand, recentProfits, topShare, type CompanyMetrics, type LastQuarter } from "./metrics";
import { companyLine, displayName, norm } from "./names";

/** Today's date where the market is, YYYY-MM-DD. */
export const todayInNewYork = (now = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

// ---- The market as a whole ----

export type MarketSnapshot = {
  asOf: string | null; // the close the numbers are from
  members: number;
  marketPe: number | null; // the whole index: total value ÷ total trailing profit
  bands: Record<string, [number, number]>; // lens kind → the middle half of its members' P/Es
  top10Pct: number | null; // share of the index's value in its 10 biggest companies
};

const SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;
let cached: { key: string; at: number; snapshot: MarketSnapshot } | null = null;

/**
 * Index-wide numbers, computed from every member's stored rows. They change
 * once a day, so the result is kept until a newer close arrives.
 */
export async function marketSnapshot(): Promise<MarketSnapshot> {
  const [{ latest }] = await db.select({ latest: max(prices.date) }).from(prices);
  const key = latest ?? "none";
  if (cached && cached.key === key && Date.now() - cached.at < SNAPSHOT_TTL_MS) return cached.snapshot;

  const members = await db.select().from(companies).where(eq(companies.status, "active"));
  const ciks = members.map((m) => m.cik).filter((c): c is number => c != null);
  const fin = ciks.length ? await db.select().from(financials).where(inArray(financials.cik, ciks)) : [];
  const byCik = new Map<number, typeof fin>();
  for (const f of fin) byCik.set(f.cik, [...(byCik.get(f.cik) ?? []), f]);
  const closes = await latestCloses();

  const rows = onePerCompany(members).map((m) => ({ lens: m.lens, metrics: computeMetrics(m.cik ? (byCik.get(m.cik) ?? []) : [], closes.get(m.ticker)?.close ?? null) }));
  const pesByLens = new Map<string, number[]>();
  for (const r of rows) if (r.lens && r.metrics.pe != null) pesByLens.set(r.lens, [...(pesByLens.get(r.lens) ?? []), r.metrics.pe]);
  const bands: MarketSnapshot["bands"] = {};
  for (const [kind, pes] of pesByLens) {
    const band = pes.length >= 8 ? peBand(pes) : null;
    if (band) bands[kind] = [Math.round(band[0]), Math.round(band[1])];
  }

  const snapshot: MarketSnapshot = {
    asOf: latest,
    members: members.length,
    marketPe: indexPe(rows.map((r) => r.metrics)),
    bands,
    top10Pct: topShare(rows.map((r) => r.metrics)),
  };
  cached = { key, at: Date.now(), snapshot };
  return snapshot;
}

/** For tests: forget the kept snapshot. */
export const forgetMarketSnapshot = () => void (cached = null);

/** The usual P/E range for a kind of company: computed from its members when there are enough, else the lens's rough range. */
export function usualPe(kind: string | null | undefined, snapshot: MarketSnapshot): [number, number] | undefined {
  if (!kind) return undefined;
  return snapshot.bands[kind] ?? lensOf(kind)?.typical_pe;
}

async function latestCloses() {
  const rows = await db
    .select()
    .from(prices)
    .where(sql`(${prices.ticker}, ${prices.date}) in (select ticker, max(date) from prices group by ticker)`);
  return new Map(rows.map((p) => [p.ticker, p]));
}

// ---- One company ----

export type UpcomingEarnings = { date: string; status: EarningsStatus; daysAway: number };

export type CompanyView = {
  ticker: string;
  name: string; // the name players see
  line: string; // one plain line on what it does
  sector: string;
  subIndustry: string;
  lens: Lens | null;
  isAi: boolean; // in the AI theme: the coach's opener talks about AI rather than the company
  price: number | null;
  priceDate: string | null;
  series: { date: string; close: number }[]; // about a year of closes, oldest first
  metrics: CompanyMetrics;
  last: LastQuarter | null;
  profits: { periodEnd: string; netIncome: number }[]; // last four quarters, newest first
  earnings: UpcomingEarnings | null;
};

const YEAR_OF_TRADING_DAYS = 252;
const aiTickers = () => new Set(themes.find((t) => t.name === "AI")?.tickers ?? []);

/** A company in the game with everything its card shows, or null if it isn't a current member. */
export async function companyView(ticker: string, today = todayInNewYork()): Promise<CompanyView | null> {
  const [c] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.ticker, ticker.toUpperCase()), eq(companies.status, "active")));
  if (!c) return null;
  const [fin, recent, [next]] = await Promise.all([
    c.cik ? db.select().from(financials).where(eq(financials.cik, c.cik)) : [],
    db.select({ date: prices.date, close: prices.close }).from(prices).where(eq(prices.ticker, c.ticker)).orderBy(desc(prices.date)).limit(YEAR_OF_TRADING_DAYS),
    db
      .select()
      .from(earningsDates)
      .where(and(eq(earningsDates.ticker, c.ticker), gte(earningsDates.date, today), inArray(earningsDates.status, ["estimated", "confirmed"])))
      .orderBy(asc(earningsDates.date))
      .limit(1),
  ]);
  const series = recent.reverse();
  const latest = series[series.length - 1];
  return {
    ticker: c.ticker,
    name: displayName(c.ticker, c.name),
    line: companyLine(c.ticker, c.subIndustry, c.oneLiner),
    sector: c.sector,
    subIndustry: c.subIndustry,
    lens: (c.lens && lenses.find((l) => l.kind === c.lens)) || null,
    isAi: aiTickers().has(c.ticker),
    price: latest?.close ?? null,
    priceDate: latest?.date ?? null,
    series,
    metrics: computeMetrics(fin, latest?.close ?? null),
    last: lastQuarter(fin),
    profits: recentProfits(fin),
    earnings: next ? { date: next.date, status: next.status, daysAway: daysBetween(today, next.date) } : null,
  };
}

// ---- Finding companies ----

export type CompanyCard = { ticker: string; name: string; line: string };

const LIST_TTL_MS = 10 * 60 * 1000;
let list: { at: number; cards: CompanyCard[] } | null = null;

/** Every current member as a small card. The list changes a few times a year, so it's kept for ten minutes. */
export async function companyCards(): Promise<CompanyCard[]> {
  if (list && Date.now() - list.at < LIST_TTL_MS) return list.cards;
  const rows = await db
    .select({ ticker: companies.ticker, name: companies.name, subIndustry: companies.subIndustry, oneLiner: companies.oneLiner })
    .from(companies)
    .where(eq(companies.status, "active"))
    .orderBy(companies.ticker);
  const cards = rows.map((r) => ({ ticker: r.ticker, name: displayName(r.ticker, r.name), line: companyLine(r.ticker, r.subIndustry, r.oneLiner) }));
  list = { at: Date.now(), cards };
  return cards;
}

export const forgetCompanyCards = () => void (list = null);

/** The cards for these tickers, in the order asked, skipping any that aren't current members. */
export async function cardsFor(tickers: string[]): Promise<CompanyCard[]> {
  const byTicker = new Map((await companyCards()).map((c) => [c.ticker, c]));
  return tickers.map((t) => byTicker.get(t)).filter((c): c is CompanyCard => !!c);
}

/**
 * Search by ticker or name, forgiving about case and punctuation. A ticker
 * match comes first, then names that start with what was typed, then names and
 * lines that contain it ("google" finds Alphabet through its line).
 */
export function searchCards(cards: CompanyCard[], q: string, limit = 6): CompanyCard[] {
  const n = norm(q);
  if (!n) return [];
  const score = (c: CompanyCard) => {
    const ticker = norm(c.ticker);
    const name = norm(c.name);
    if (ticker === n) return 0;
    if (name.startsWith(n)) return 1;
    if (ticker.startsWith(n)) return 2;
    if (n.length >= 2 && name.includes(n)) return 3;
    if (n.length >= 3 && norm(c.line).includes(n)) return 4;
    return null;
  };
  return cards
    .map((c) => ({ c, s: score(c) }))
    .filter((x): x is { c: CompanyCard; s: number } => x.s != null)
    .sort((a, b) => a.s - b.s || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((x) => x.c);
}
