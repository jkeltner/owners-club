// What a player holds and what it is worth at a close. Lots are written only
// by the fill step (fills.ts); everything else reads them through here.
import { and, desc, eq, gt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { lots, orders, prices } from "@/db/schema";
import type { Realized } from "./ledger";
import { INDEX_TICKER, round2 } from "@/lib/rules";
import { INDEX_FUND_TICKER } from "@/market/massive";

export type LotRow = typeof lots.$inferSelect;
/** The database, or a transaction on it: the fill step reads inside the transaction it writes in. */
export type Reader = Pick<typeof db, "select">;

/** The ticker whose closes price a holding: the index holding is priced by the index fund. */
export const priceTicker = (ticker: string) => (ticker === INDEX_TICKER ? INDEX_FUND_TICKER : ticker);

/** Lots with shares left, oldest first. */
export async function openLots(membershipId: string, from: Reader = db): Promise<LotRow[]> {
  return from
    .select()
    .from(lots)
    .where(and(eq(lots.membershipId, membershipId), gt(lots.shares, 0)))
    .orderBy(lots.boughtOn, lots.createdAt);
}

/** The last close on or before `date` (or the latest of all) for each ticker held. */
export async function closesFor(tickers: string[], date?: string, from: Reader = db): Promise<Map<string, { close: number; date: string }>> {
  const found = new Map<string, { close: number; date: string }>();
  for (const ticker of new Set(tickers)) {
    const [row] = await from
      .select({ close: prices.close, date: prices.date })
      .from(prices)
      .where(and(eq(prices.ticker, priceTicker(ticker)), date ? lte(prices.date, date) : undefined))
      .orderBy(desc(prices.date))
      .limit(1);
    if (row) found.set(ticker, row);
  }
  return found;
}

export type Holding = { ticker: string; shares: number; cost: number; value: number; price: number | null; firstBought: string };

/**
 * A player's holdings, one per ticker, valued at the last close on or before
 * `date`. A holding with no close yet is valued at what it cost.
 */
export async function holdingsOf(membershipId: string, date?: string, from: Reader = db): Promise<{ holdings: Holding[]; total: number; asOf: string | null }> {
  const open = await openLots(membershipId, from);
  const closes = await closesFor(open.map((l) => l.ticker), date, from);
  const byTicker = new Map<string, Holding>();
  for (const lot of open) {
    const h = byTicker.get(lot.ticker) ?? { ticker: lot.ticker, shares: 0, cost: 0, value: 0, price: closes.get(lot.ticker)?.close ?? null, firstBought: lot.boughtOn };
    h.shares += lot.shares;
    h.cost += lot.cost;
    byTicker.set(lot.ticker, h);
  }
  const holdings = [...byTicker.values()].map((h) => ({ ...h, cost: round2(h.cost), value: round2(h.price == null ? h.cost : h.shares * h.price) }));
  const dates = [...closes.values()].map((c) => c.date).sort();
  return { holdings, total: round2(holdings.reduce((a, h) => a + h.value, 0)), asOf: dates.at(-1) ?? null };
}

/** Gains made real, and tax and fees paid, by a player's filled orders so far. */
export async function taxLedger(membershipId: string, from: Reader = db): Promise<{ realized: Realized; paid: number; fees: number }> {
  const [row] = await from
    .select({
      short: sql<number>`coalesce(sum(${orders.gainShort}), 0)`,
      long: sql<number>`coalesce(sum(${orders.gainLong}), 0)`,
      paid: sql<number>`coalesce(sum(${orders.tax}), 0)`,
      fees: sql<number>`coalesce(sum(${orders.fee}), 0)`,
    })
    .from(orders)
    .where(and(eq(orders.membershipId, membershipId), eq(orders.status, "filled")));
  return { realized: { short: Number(row.short), long: Number(row.long) }, paid: Number(row.paid), fees: Number(row.fees) };
}
