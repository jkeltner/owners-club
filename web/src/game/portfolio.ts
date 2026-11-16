// A player's portfolio as the screens and the nightly snapshot see it: every
// holding with its lots, what it is worth at the last close, the tax still
// owed if it were all sold, and the same $10,000 left alone in the index.
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { companies, lots, orders, portfolioDays, prices, type DayHolding } from "@/db/schema";
import { INDEX_TICKER, round2, STARTING_VALUE, tradeFee, type GameSettings } from "@/lib/rules";
import { INDEX_FUND_TICKER } from "@/market/massive";
import { displayName } from "@/market/names";
import { closesFor, openLots, taxLedger, type Reader } from "./holdings";
import { fillDay, longTermDay, taxIfAllSold, unlockDay, type Realized } from "./ledger";

export const INDEX_NAME = "S&P 500 index fund";

export type PortfolioLot = {
  id: string;
  shares: number;
  cost: number;
  value: number;
  boughtOn: string;
  unlockOn: string; // first day it can be sold
  longTermOn: string; // first day its gain is taxed at the lower rate
  sellable: boolean; // an order placed now could sell it
};

export type PortfolioHolding = {
  ticker: string;
  name: string;
  isIndex: boolean;
  shares: number;
  cost: number;
  value: number;
  price: number | null;
  share: number; // of the whole portfolio, 0 to 1
  lots: PortfolioLot[];
  sellableShares: number; // past the hold, and not already in a waiting sell
  lockedUntil: string | null; // when the next locked lot opens
};

export type Portfolio = {
  opened: boolean;
  asOf: string | null; // the close everything is valued at
  total: number;
  taxOwed: number; // if it were all sold at that close; negative when tax would come back
  afterTax: number;
  feeToSell: number; // the trade fee on selling all of it
  kept: number; // after the tax and that fee: the number the game compares
  index: { value: number; afterTax: number; kept: number } | null; // the starting money, never moved
  feesPaid: number;
  taxesPaid: number;
  realized: Realized;
  holdings: PortfolioHolding[]; // the index first, then picks by size
};

/** The starting $10,000 left alone in the index since the portfolio opened, valued at `date`'s close: before tax, after tax, and after the fee to sell it too. */
async function untouchedIndex(membershipId: string, date: string, s: GameSettings, from: Reader): Promise<{ value: number; afterTax: number; kept: number } | null> {
  const [first] = await from
    .select({ boughtOn: lots.boughtOn })
    .from(lots)
    .where(and(eq(lots.membershipId, membershipId), eq(lots.ticker, INDEX_TICKER), isNull(lots.orderId)))
    .orderBy(asc(lots.boughtOn))
    .limit(1);
  if (!first) return null;
  const [[then], now] = await Promise.all([
    from.select({ close: prices.close }).from(prices).where(and(eq(prices.ticker, INDEX_FUND_TICKER), eq(prices.date, first.boughtOn))),
    closesFor([INDEX_TICKER], date, from),
  ]);
  const close = now.get(INDEX_TICKER)?.close;
  if (!then || close == null) return null;
  const value = round2((STARTING_VALUE * close) / then.close);
  const gain = value - STARTING_VALUE;
  const rate = longTermDay(first.boughtOn, s) <= date ? s.longTermTaxRate : s.shortTermTaxRate;
  const afterTax = round2(value - Math.max(0, gain) * rate);
  return { value, afterTax, kept: round2(afterTax - tradeFee(value, s)) };
}

/**
 * The portfolio valued at the last close on or before `date` (default: the
 * latest). `now` decides what an order placed at this moment could sell.
 */
export async function portfolioOf(membershipId: string, s: GameSettings, opts: { date?: string; now?: Date; from?: Reader } = {}): Promise<Portfolio> {
  const from = opts.from ?? db;
  const open = await openLots(membershipId, from);
  const [closes, ledger, waitingSells] = await Promise.all([
    closesFor(open.map((l) => l.ticker), opts.date, from),
    taxLedger(membershipId, from),
    from
      .select({ ticker: orders.ticker, askedShares: orders.askedShares })
      .from(orders)
      .where(and(eq(orders.membershipId, membershipId), eq(orders.side, "sell"), eq(orders.status, "waiting"))),
  ]);
  const asOf = [...closes.values()].map((c) => c.date).sort().at(-1) ?? null;
  const sellOn = fillDay(opts.now ?? new Date());
  const tickers = [...new Set(open.map((l) => l.ticker))].filter((t) => t !== INDEX_TICKER);
  const named = tickers.length ? await from.select({ ticker: companies.ticker, name: companies.name }).from(companies).where(inArray(companies.ticker, tickers)) : [];
  const nameOf = new Map(named.map((c) => [c.ticker, c.name]));

  const byTicker = new Map<string, PortfolioHolding>();
  for (const lot of open) {
    const price = closes.get(lot.ticker)?.close ?? null;
    const isIndex = lot.ticker === INDEX_TICKER;
    const h =
      byTicker.get(lot.ticker) ??
      ({ ticker: lot.ticker, name: isIndex ? INDEX_NAME : displayName(lot.ticker, nameOf.get(lot.ticker) ?? lot.ticker), isIndex, shares: 0, cost: 0, value: 0, price, share: 0, lots: [], sellableShares: 0, lockedUntil: null } satisfies PortfolioHolding);
    const unlockOn = isIndex ? lot.boughtOn : unlockDay(lot.boughtOn, s);
    const sellable = unlockOn <= sellOn;
    h.lots.push({ id: lot.id, shares: lot.shares, cost: lot.cost, value: price == null ? lot.cost : lot.shares * price, boughtOn: lot.boughtOn, unlockOn, longTermOn: longTermDay(lot.boughtOn, s), sellable });
    h.shares += lot.shares;
    h.cost += lot.cost;
    if (sellable) h.sellableShares += lot.shares;
    else if (!h.lockedUntil || unlockOn < h.lockedUntil) h.lockedUntil = unlockOn;
    byTicker.set(lot.ticker, h);
  }
  for (const w of waitingSells) {
    const h = byTicker.get(w.ticker);
    if (h) h.sellableShares = Math.max(0, h.sellableShares - (w.askedShares ?? 0));
  }
  const all = [...byTicker.values()].map((h) => ({ ...h, cost: round2(h.cost), value: round2(h.lots.reduce((a, l) => a + l.value, 0)) }));
  const total = round2(all.reduce((a, h) => a + h.value, 0));
  for (const h of all) h.share = total > 0 ? h.value / total : 0;
  all.sort((a, b) => Number(b.isIndex) - Number(a.isIndex) || b.value - a.value);

  const opened = open.length > 0 || ledger.fees > 0;
  const day = asOf ?? sellOn;
  const taxOwed = taxIfAllSold(all.flatMap((h) => h.lots), day, ledger.realized, ledger.paid, s);
  const feeToSell = tradeFee(total, s);
  return {
    opened,
    asOf,
    total,
    taxOwed,
    afterTax: round2(total - taxOwed),
    feeToSell,
    kept: round2(total - taxOwed - feeToSell),
    index: asOf ? await untouchedIndex(membershipId, asOf, s, from) : null,
    feesPaid: round2(ledger.fees),
    taxesPaid: round2(ledger.paid),
    realized: ledger.realized,
    holdings: all,
  };
}

/** Writes (or rewrites) one player's row for the day their portfolio is valued at. */
export async function snapshotDay(membershipId: string, s: GameSettings, date?: string): Promise<boolean> {
  const p = await portfolioOf(membershipId, s, { date });
  if (!p.opened || !p.asOf || !p.index) return false;
  const holdings: DayHolding[] = p.holdings.map((h) => ({ ticker: h.ticker, value: h.value }));
  const row = { value: p.total, taxOwed: p.taxOwed, afterTax: p.afterTax, indexAfterTax: p.index.afterTax, kept: p.kept, indexKept: p.index.kept, holdings };
  await db
    .insert(portfolioDays)
    .values({ membershipId, date: p.asOf, ...row })
    .onConflictDoUpdate({ target: [portfolioDays.membershipId, portfolioDays.date], set: row });
  return true;
}

/** A player's daily rows, oldest first. */
export async function daysOf(membershipId: string) {
  return db.select().from(portfolioDays).where(eq(portfolioDays.membershipId, membershipId)).orderBy(asc(portfolioDays.date));
}
