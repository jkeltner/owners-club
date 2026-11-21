// Dividends: storing what the price source reports, crediting each player who
// held the shares, and what the screens say about a company's dividend.
//
// The rules (Jeff, 2026-11-21): a dividend is credited on its ex-dividend date,
// the day the price drops by about that much, to whoever held the shares at the
// close before it. It is taxed at the club's long-term rate, and the rest goes
// where the player chose for that company: the index fund (the default) or more
// of the same company. The index fund's own dividends always go back into it,
// and the "left it all in the S&P 500" comparison gets them the same way.
import { and, desc, eq, gt, gte, inArray, lt, lte, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubs, companies, dividendChoices, dividendCredits, dividends, lots, memberships, prices, type DividendInto } from "@/db/schema";
import { INDEX_TICKER, round2, type GameSettings } from "@/lib/rules";
import { fetchDividends, INDEX_FUND_TICKER, type Dividend } from "@/market/massive";
import type { Reader } from "./holdings";

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysBefore = (n: number, from = new Date()) => isoDay(new Date(from.getTime() - n * DAY));

/** The holding a dividend belongs to: the index fund's dividends belong to the index holding. */
const holdingOf = (ticker: string) => (ticker === INDEX_FUND_TICKER ? INDEX_TICKER : ticker);

// ---- The arithmetic ----

export type DividendPlan = { amount: number; tax: number; net: number; intoShares: number };

/** What a dividend pays on `shares`, the tax on it at the club's long-term rate, and how many shares the rest buys at `price`. */
export function planDividend(shares: number, perShare: number, price: number, s: GameSettings): DividendPlan {
  const amount = round2(shares * perShare);
  const tax = round2(amount * s.longTermTaxRate);
  const net = round2(amount - tax);
  return { amount, tax, net, intoShares: price > 0 ? net / price : 0 };
}

// ---- Storing them ----

/** Keeps the rows for companies in the game and the index fund. Returns how many were written. */
export async function storeDividends(rows: Dividend[]): Promise<number> {
  if (!rows.length) return 0;
  const tickers = [...new Set(rows.map((r) => r.ticker))];
  const known = new Set([INDEX_FUND_TICKER, ...(await db.select({ ticker: companies.ticker }).from(companies).where(inArray(companies.ticker, tickers))).map((c) => c.ticker)]);
  const kept = rows.filter((r) => known.has(r.ticker));
  for (let i = 0; i < kept.length; i += 500) {
    await db
      .insert(dividends)
      .values(kept.slice(i, i + 500))
      .onConflictDoUpdate({
        target: dividends.id,
        set: { exDate: sql`excluded.ex_date`, payDate: sql`excluded.pay_date`, cash: sql`excluded.cash`, kind: sql`excluded.kind`, perYear: sql`excluded.per_year`, fetchedAt: sql`now()` },
      });
  }
  return kept.length;
}

/** The nightly step: every dividend in the market whose ex-date fell in the last ten days, so a missed night or two still gets credited. */
export async function refreshDividends(today = new Date()): Promise<Record<string, unknown>> {
  if (!process.env.MASSIVE_API_KEY) return { skipped: "MASSIVE_API_KEY is not set" };
  const from = daysBefore(10, today);
  const to = isoDay(today);
  const rows = await fetchDividends({ from, to }, 4);
  return { from, to, fetched: rows.length, stored: await storeDividends(rows) };
}

// ---- Crediting them ----

type Owed = { dividendId: string; ticker: string; exDate: string; perShare: number; membershipId: string; shares: number; settings: GameSettings };

/**
 * Credits every dividend a player is owed and hasn't been paid: shares held
 * (bought before the ex-date, still held) of a company or the index fund, with
 * the ex-date's closes stored. Runs before the night's orders fill, so shares
 * sold at the ex-date's close still collect. Running it again changes nothing.
 */
export async function creditDividends(onlyMembershipId?: string): Promise<{ credited: number; waitingForAClose: number }> {
  const [{ latest }] = await db.select({ latest: max(prices.date) }).from(prices).where(eq(prices.ticker, INDEX_FUND_TICKER));
  if (!latest) return { credited: 0, waitingForAClose: 0 };
  const lotTicker = sql`case when ${dividends.ticker} = ${INDEX_FUND_TICKER} then ${INDEX_TICKER} else ${dividends.ticker} end`;
  const owed: Owed[] = (
    await db
      .select({
        dividendId: dividends.id,
        ticker: dividends.ticker,
        exDate: dividends.exDate,
        perShare: dividends.cash,
        membershipId: lots.membershipId,
        shares: sql<number>`sum(${lots.shares})`,
        settings: clubs.settings,
      })
      .from(dividends)
      .innerJoin(lots, and(sql`${lots.ticker} = ${lotTicker}`, lt(lots.boughtOn, dividends.exDate), gt(lots.shares, 0)))
      .innerJoin(memberships, eq(memberships.id, lots.membershipId))
      .innerJoin(clubs, eq(clubs.id, memberships.clubId))
      .where(
        and(
          lte(dividends.exDate, latest),
          onlyMembershipId ? eq(lots.membershipId, onlyMembershipId) : undefined,
          sql`not exists (select 1 from ${dividendCredits} where ${dividendCredits.membershipId} = ${lots.membershipId} and ${dividendCredits.dividendId} = ${dividends.id})`,
        ),
      )
      .groupBy(dividends.id, lots.membershipId, clubs.settings)
      .orderBy(dividends.exDate)
  ).map((r) => ({ ...r, shares: Number(r.shares) }));

  let credited = 0;
  let waitingForAClose = 0;
  for (const o of owed) {
    const holding = holdingOf(o.ticker);
    const into: DividendInto = holding === INDEX_TICKER ? "index" : await dividendChoice(o.membershipId, holding);
    const priceTicker = into === "reinvest" ? o.ticker : INDEX_FUND_TICKER;
    const [close] = await db.select({ close: prices.close }).from(prices).where(and(eq(prices.ticker, priceTicker), eq(prices.date, o.exDate)));
    if (!close) {
      waitingForAClose++;
      continue;
    }
    const plan = planDividend(o.shares, o.perShare, close.close, o.settings);
    if (plan.net <= 0) continue; // a fraction of a cent: nothing to put anywhere
    const wrote = await db.transaction(async (tx) => {
      const [credit] = await tx
        .insert(dividendCredits)
        .values({ membershipId: o.membershipId, dividendId: o.dividendId, ticker: holding, exDate: o.exDate, shares: o.shares, perShare: o.perShare, amount: plan.amount, tax: plan.tax, into, intoPrice: close.close, intoShares: plan.intoShares })
        .onConflictDoNothing()
        .returning({ id: dividendCredits.id });
      if (!credit) return false;
      await tx.insert(lots).values({ membershipId: o.membershipId, ticker: into === "reinvest" ? holding : INDEX_TICKER, shares: plan.intoShares, cost: plan.net, boughtOn: o.exDate, creditId: credit.id });
      return true;
    });
    if (wrote) credited++;
  }
  return { credited, waitingForAClose };
}

// ---- Where they go ----

/** Where a player's dividends from one company go: the index fund unless they chose otherwise. */
export async function dividendChoice(membershipId: string, ticker: string, from: Reader = db): Promise<DividendInto> {
  if (ticker === INDEX_TICKER) return "index";
  const [row] = await from.select({ into: dividendChoices.into }).from(dividendChoices).where(and(eq(dividendChoices.membershipId, membershipId), eq(dividendChoices.ticker, ticker)));
  return row?.into ?? "index";
}

export async function setDividendChoice(membershipId: string, ticker: string, into: DividendInto): Promise<void> {
  if (ticker === INDEX_TICKER) return;
  const choice: DividendInto = into === "reinvest" ? "reinvest" : "index";
  await db
    .insert(dividendChoices)
    .values({ membershipId, ticker, into: choice })
    .onConflictDoUpdate({ target: [dividendChoices.membershipId, dividendChoices.ticker], set: { into: choice, updatedAt: new Date() } });
}

// ---- What the screens read ----

/** A player's dividends, newest first. */
export async function creditsOf(membershipId: string) {
  return db
    .select({ credit: dividendCredits, name: companies.name })
    .from(dividendCredits)
    .leftJoin(companies, eq(companies.ticker, dividendCredits.ticker))
    .where(eq(dividendCredits.membershipId, membershipId))
    .orderBy(desc(dividendCredits.exDate), desc(dividendCredits.createdAt));
}

/** Tax taken from a player's dividends so far. Kept apart from the tax on sales, which nets gains against losses. */
export async function dividendTaxPaid(membershipId: string, from: Reader = db): Promise<number> {
  const [row] = await from.select({ tax: sql<number>`coalesce(sum(${dividendCredits.tax}), 0)` }).from(dividendCredits).where(eq(dividendCredits.membershipId, membershipId));
  return Number(row.tax);
}

/** The index fund's dividends with an ex-date after `after` and on or before `upTo`, each with that day's close: for the untouched-index comparison. */
export async function indexDividends(after: string, upTo: string, from: Reader = db): Promise<{ exDate: string; perShare: number; close: number }[]> {
  return from
    .select({ exDate: dividends.exDate, perShare: dividends.cash, close: prices.close })
    .from(dividends)
    .innerJoin(prices, and(eq(prices.ticker, dividends.ticker), eq(prices.date, dividends.exDate)))
    .where(and(eq(dividends.ticker, INDEX_FUND_TICKER), gt(dividends.exDate, after), lte(dividends.exDate, upTo)))
    .orderBy(dividends.exDate);
}

export type DividendYear = {
  perShare: number; // regular dividends over the last year, per share
  payments: number; // how many regular payments that was
  special: { exDate: string; perShare: number } | null; // the latest one-off special dividend, if any
  next: { exDate: string; perShare: number; special: boolean } | null; // one already announced
};

const LOOKUP_EVERY_DAYS = 7;
const LOOKUP_TIMEOUT_MS = 4000;

/**
 * A company's last year of dividends, for the buy screen and the company page.
 * The nightly step only fetches recent days, so the first time a company is
 * shown (and weekly after) its year is looked up from the price source; if
 * that is slow or refused, what is stored is used.
 */
export async function dividendYear(ticker: string, today = new Date()): Promise<DividendYear | null> {
  const yearAgo = daysBefore(365, today);
  const [c] = await db.select({ checked: companies.dividendsCheckedOn }).from(companies).where(eq(companies.ticker, ticker));
  if (!c) return null;
  if (process.env.MASSIVE_API_KEY && (!c.checked || c.checked < daysBefore(LOOKUP_EVERY_DAYS, today))) {
    try {
      const rows = await Promise.race([fetchDividends({ from: yearAgo, ticker }, 1), new Promise<never>((_, no) => setTimeout(() => no(new Error("timed out")), LOOKUP_TIMEOUT_MS))]);
      await storeDividends(rows);
      await db.update(companies).set({ dividendsCheckedOn: isoDay(today) }).where(eq(companies.ticker, ticker));
    } catch {
      // The free plan allows five requests a minute; try again next time.
    }
  }
  const rows = await db
    .select({ exDate: dividends.exDate, perShare: dividends.cash, kind: dividends.kind })
    .from(dividends)
    .where(and(eq(dividends.ticker, ticker), gte(dividends.exDate, yearAgo)))
    .orderBy(dividends.exDate);
  const now = isoDay(today);
  const past = rows.filter((r) => r.exDate <= now);
  const regular = past.filter((r) => r.kind !== "SC");
  const specials = past.filter((r) => r.kind === "SC");
  const upcoming = rows.find((r) => r.exDate > now);
  if (!past.length && !upcoming) return null;
  return {
    perShare: round2(regular.reduce((a, r) => a + r.perShare, 0)),
    payments: regular.length,
    special: specials.length ? { exDate: specials.at(-1)!.exDate, perShare: specials.at(-1)!.perShare } : null,
    next: upcoming ? { exDate: upcoming.exDate, perShare: upcoming.perShare, special: upcoming.kind === "SC" } : null,
  };
}
