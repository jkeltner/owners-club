// The nightly fill step. After the day's closes are stored it (1) puts each
// new player's $10,000 into the index at the first close after they joined,
// and (2) fills every waiting order at the first close after it was placed.
// Safe to run again: a portfolio opens once, and an order fills only while it
// is still waiting.
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubs, companies, conversations, lots, memberships, orders, prices, theses } from "@/db/schema";
import { logEvent } from "@/lib/events";
import { INDEX_TICKER, STARTING_VALUE, type GameSettings } from "@/lib/rules";
import { INDEX_FUND_TICKER } from "@/market/massive";
import { holdingsOf, openLots } from "./holdings";
import { fillDay, planBuy, type Realized } from "./ledger";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The first day on or after `from` that has a close for every ticker given. */
async function firstCloseDay(tickers: string[], from: string): Promise<{ date: string; closes: Map<string, number> } | null> {
  const rows = await db
    .select({ ticker: prices.ticker, date: prices.date, close: prices.close })
    .from(prices)
    .where(and(inArray(prices.ticker, tickers), gte(prices.date, from)))
    .orderBy(asc(prices.date));
  const byDate = new Map<string, Map<string, number>>();
  for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? new Map()).set(r.ticker, r.close));
  for (const [date, closes] of byDate) if (tickers.every((t) => closes.has(t))) return { date, closes };
  return null;
}

/** Every playing member without a portfolio gets the starting $10,000 of the index at the first close after joining. */
export async function openPortfolios(): Promise<{ opened: number; waitingForAClose: number }> {
  const fresh = await db
    .select({ id: memberships.id, joinedAt: memberships.joinedAt })
    .from(memberships)
    .where(and(eq(memberships.plays, true), sql`not exists (select 1 from ${lots} where ${lots.membershipId} = ${memberships.id})`));
  let opened = 0;
  for (const m of fresh) {
    const day = await firstCloseDay([INDEX_FUND_TICKER], fillDay(m.joinedAt));
    if (!day) continue;
    await db.transaction(async (tx) => {
      const already = await tx.$count(lots, eq(lots.membershipId, m.id));
      if (already) return;
      await tx.insert(lots).values({ membershipId: m.id, ticker: INDEX_TICKER, shares: STARTING_VALUE / day.closes.get(INDEX_FUND_TICKER)!, cost: STARTING_VALUE, boughtOn: day.date });
      opened++;
    });
  }
  return { opened, waitingForAClose: fresh.length - opened };
}

/** Gains made real and tax paid by a player's fills so far. */
async function taxLedger(tx: Tx, membershipId: string): Promise<{ realized: Realized; paid: number }> {
  const [row] = await tx
    .select({ short: sql<number>`coalesce(sum(${orders.gainShort}), 0)`, long: sql<number>`coalesce(sum(${orders.gainLong}), 0)`, paid: sql<number>`coalesce(sum(${orders.tax}), 0)` })
    .from(orders)
    .where(and(eq(orders.membershipId, membershipId), eq(orders.status, "filled")));
  return { realized: { short: Number(row.short), long: Number(row.long) }, paid: Number(row.paid) };
}

/** An order that can't go through: marked, and its thesis handed back as a draft with its conversation. */
export async function releaseThesis(tx: Tx, orderId: string) {
  const freed = await tx.update(theses).set({ status: "draft", orderId: null }).where(eq(theses.orderId, orderId)).returning({ id: theses.id });
  if (freed.length) await tx.update(conversations).set({ thesisId: null }).where(inArray(conversations.thesisId, freed.map((t) => t.id)));
}

const dollars = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type FillSummary = { filled: number; trimmed: number; rejected: number; stillWaiting: number };

/** Fills waiting buy orders, oldest first, each at the first close after it was placed. */
export async function fillOrders(): Promise<FillSummary> {
  const waiting = await db
    .select({ order: orders, settings: clubs.settings })
    .from(orders)
    .innerJoin(memberships, eq(memberships.id, orders.membershipId))
    .innerJoin(clubs, eq(clubs.id, memberships.clubId))
    .where(and(eq(orders.status, "waiting"), eq(orders.side, "buy")))
    .orderBy(asc(orders.placedAt));
  const out: FillSummary = { filled: 0, trimmed: 0, rejected: 0, stillWaiting: 0 };
  for (const { order, settings } of waiting) {
    const day = await firstCloseDay([INDEX_FUND_TICKER, order.ticker], fillDay(order.placedAt));
    if (!day) {
      out.stillWaiting++;
      continue;
    }
    const result = await fillBuy(order, settings, day.date, day.closes.get(order.ticker)!, day.closes.get(INDEX_FUND_TICKER)!);
    out[result]++;
    if (result === "trimmed") out.filled++;
  }
  return out;
}

async function fillBuy(order: typeof orders.$inferSelect, settings: GameSettings, date: string, price: number, indexPrice: number): Promise<"filled" | "trimmed" | "rejected" | "stillWaiting"> {
  const outcome = await db.transaction(async (tx) => {
    const reject = async (note: string) => {
      const done = await tx.update(orders).set({ status: "rejected", fillDate: date, note }).where(and(eq(orders.id, order.id), eq(orders.status, "waiting"))).returning({ id: orders.id });
      if (!done.length) return "stillWaiting" as const;
      await releaseThesis(tx, order.id);
      return "rejected" as const;
    };
    const [company] = await tx.select({ status: companies.status }).from(companies).where(eq(companies.ticker, order.ticker));
    if (company?.status !== "active") return reject("This company left the S&P 500 before your order went through, so it isn't in the game any more");
    const open = await openLots(order.membershipId, tx);
    const indexLots = open.filter((l) => l.ticker === INDEX_TICKER && l.boughtOn <= date);
    if (!indexLots.length) return "stillWaiting" as const; // the portfolio hasn't opened yet; openPortfolios runs first
    const { holdings, total } = await holdingsOf(order.membershipId, date, tx);
    const ledger = await taxLedger(tx, order.membershipId);
    const plan = planBuy({
      amount: order.amount,
      price,
      indexPrice,
      indexLots,
      portfolioValue: total,
      companyValue: holdings.find((h) => h.ticker === order.ticker)?.value ?? 0,
      date,
      realizedBefore: ledger.realized,
      taxPaid: ledger.paid,
      settings,
    });
    if (!plan.ok) return reject(plan.reason);
    const note =
      plan.trimmedBy === "cap"
        ? `You asked to move ${dollars(order.amount)}. At that close, this club's limit for one company allowed ${dollars(plan.moved)}, so that is what moved.`
        : plan.trimmedBy === "index"
          ? `You asked to move ${dollars(order.amount)}. At that close your index fund held ${dollars(plan.moved)}, so that is what moved.`
          : null;
    const done = await tx
      .update(orders)
      .set({ status: "filled", fillDate: date, fillPrice: price, fee: plan.fee, filledAmount: plan.moved, shares: plan.shares, gainShort: plan.realized.short, gainLong: plan.realized.long, tax: plan.tax, note })
      .where(and(eq(orders.id, order.id), eq(orders.status, "waiting")))
      .returning({ id: orders.id });
    if (!done.length) return "stillWaiting" as const; // cancelled, or filled by another run, in the meantime
    for (const c of plan.indexChanges) await tx.update(lots).set({ shares: c.shares, cost: c.cost }).where(eq(lots.id, c.id));
    await tx.insert(lots).values({ membershipId: order.membershipId, ticker: order.ticker, shares: plan.shares, cost: plan.into, boughtOn: date, orderId: order.id });
    return plan.trimmedBy ? ("trimmed" as const) : ("filled" as const);
  });
  if (outcome === "rejected") await logEvent({ level: "info", kind: "trade.rejected", message: "An order didn't go through at the close", detail: { membershipId: order.membershipId, orderId: order.id, ticker: order.ticker, amount: order.amount, date } });
  return outcome;
}

/** The whole step, in order: portfolios open before orders fill against them. */
export async function runFills() {
  const portfolios = await openPortfolios();
  const fills = await fillOrders();
  return { ...portfolios, ...fills };
}
