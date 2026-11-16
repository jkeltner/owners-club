// The nightly fill step. After the day's closes are stored it (1) puts each
// new player's $10,000 into the index at the club's opening close (the first
// close on or after its opening day), however late they joined, so everyone
// in a club is measured over the same stretch, and (2) fills every waiting
// order at the first close after it was placed.
// Safe to run again: a portfolio opens once, and an order fills only while it
// is still waiting.
import { and, asc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubs, companies, conversations, lots, memberships, orders, prices, theses } from "@/db/schema";
import { logEvent } from "@/lib/events";
import { INDEX_TICKER, STARTING_VALUE, type GameSettings } from "@/lib/rules";
import { INDEX_FUND_TICKER } from "@/market/massive";
import { holdingsOf, openLots, taxLedger } from "./holdings";
import { fillDay, planBuy, planSell } from "./ledger";
import { snapshotDay } from "./portfolio";

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

/** The $10,000 goes into the index at the club's opening close. False while that close hasn't happened, or if the portfolio is already open. */
async function openAt(membershipId: string, opensOn: string): Promise<boolean> {
  const day = await firstCloseDay([INDEX_FUND_TICKER], opensOn);
  if (!day) return false;
  return db.transaction(async (tx) => {
    if (await tx.$count(lots, eq(lots.membershipId, membershipId))) return false;
    await tx.insert(lots).values({ membershipId, ticker: INDEX_TICKER, shares: STARTING_VALUE / day.closes.get(INDEX_FUND_TICKER)!, cost: STARTING_VALUE, boughtOn: day.date });
    return true;
  });
}

/** Every playing member without a portfolio gets the starting $10,000 of the index, dated the club's opening close. */
export async function openPortfolios(): Promise<{ opened: number; waitingForAClose: number }> {
  const fresh = await db
    .select({ id: memberships.id, opensOn: clubs.opensOn })
    .from(memberships)
    .innerJoin(clubs, eq(clubs.id, memberships.clubId))
    .where(and(eq(memberships.plays, true), sql`not exists (select 1 from ${lots} where ${lots.membershipId} = ${memberships.id})`));
  let opened = 0;
  for (const m of fresh) if (await openAt(m.id, m.opensOn)) opened++;
  return { opened, waitingForAClose: fresh.length - opened };
}

/**
 * For someone joining a club that has already opened: their portfolio opens
 * on the spot, dated the club's opening close, with today's row for the board.
 */
export async function openLateJoiner(membershipId: string): Promise<boolean> {
  const [m] = await db
    .select({ plays: memberships.plays, opensOn: clubs.opensOn, settings: clubs.settings })
    .from(memberships)
    .innerJoin(clubs, eq(clubs.id, memberships.clubId))
    .where(eq(memberships.id, membershipId));
  if (!m?.plays || !(await openAt(membershipId, m.opensOn))) return false;
  await snapshotDay(membershipId, m.settings);
  return true;
}

/** An order that can't go through: marked, and its thesis handed back as a draft with its conversation. */
export async function releaseThesis(tx: Tx, orderId: string) {
  const freed = await tx.update(theses).set({ status: "draft", orderId: null }).where(eq(theses.orderId, orderId)).returning({ id: theses.id });
  if (freed.length) await tx.update(conversations).set({ thesisId: null }).where(inArray(conversations.thesisId, freed.map((t) => t.id)));
}

const dollars = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export type FillSummary = { filled: number; trimmed: number; rejected: number; stillWaiting: number };

/** Fills waiting orders, buys and sells together, oldest first, each at the first close after it was placed. */
export async function fillOrders(): Promise<FillSummary> {
  const waiting = await db
    .select({ order: orders, settings: clubs.settings })
    .from(orders)
    .innerJoin(memberships, eq(memberships.id, orders.membershipId))
    .innerJoin(clubs, eq(clubs.id, memberships.clubId))
    .where(eq(orders.status, "waiting"))
    .orderBy(asc(orders.placedAt));
  const out: FillSummary = { filled: 0, trimmed: 0, rejected: 0, stillWaiting: 0 };
  for (const { order, settings } of waiting) {
    const day = await firstCloseDay([INDEX_FUND_TICKER, order.ticker], fillDay(order.placedAt));
    if (!day) {
      out.stillWaiting++;
      continue;
    }
    const fill = order.side === "sell" ? fillSell : fillBuy;
    const result = await fill(order, settings, day.date, day.closes.get(order.ticker)!, day.closes.get(INDEX_FUND_TICKER)!);
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
    const ledger = await taxLedger(order.membershipId, tx);
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

const sharesText = (n: number) => n.toFixed(3);

async function fillSell(order: typeof orders.$inferSelect, settings: GameSettings, date: string, price: number, indexPrice: number): Promise<"filled" | "trimmed" | "rejected" | "stillWaiting"> {
  const outcome = await db.transaction(async (tx) => {
    const reject = async (note: string) => {
      const done = await tx.update(orders).set({ status: "rejected", fillDate: date, note }).where(and(eq(orders.id, order.id), eq(orders.status, "waiting"))).returning({ id: orders.id });
      return done.length ? ("rejected" as const) : ("stillWaiting" as const);
    };
    const open = (await openLots(order.membershipId, tx)).filter((l) => l.ticker === order.ticker && l.boughtOn <= date);
    const ledger = await taxLedger(order.membershipId, tx);
    const plan = planSell({ shares: order.askedShares ?? 0, price, indexPrice, lots: open, date, realizedBefore: ledger.realized, taxPaid: ledger.paid, settings });
    if (!plan.ok) return reject(plan.reason);
    const note = plan.trimmed ? `You asked to sell ${sharesText(order.askedShares ?? 0)} shares. At that close ${sharesText(plan.shares)} could be sold, so that is what sold.` : null;
    const done = await tx
      .update(orders)
      .set({ status: "filled", fillDate: date, fillPrice: price, fee: plan.fee, filledAmount: plan.proceeds, shares: plan.shares, gainShort: plan.realized.short, gainLong: plan.realized.long, tax: plan.tax, note })
      .where(and(eq(orders.id, order.id), eq(orders.status, "waiting")))
      .returning({ id: orders.id });
    if (!done.length) return "stillWaiting" as const;
    for (const c of plan.changes) await tx.update(lots).set({ shares: c.shares, cost: c.cost }).where(eq(lots.id, c.id));
    // What the sale brought in, less the fee and the tax, goes back into the index as money that arrived today.
    await tx.insert(lots).values({ membershipId: order.membershipId, ticker: INDEX_TICKER, shares: plan.indexShares, cost: plan.into, boughtOn: date, orderId: order.id });
    return plan.trimmed ? ("trimmed" as const) : ("filled" as const);
  });
  if (outcome === "rejected") await logEvent({ level: "info", kind: "trade.rejected", message: "A sell didn't go through at the close", detail: { membershipId: order.membershipId, orderId: order.id, ticker: order.ticker, shares: order.askedShares, date } });
  return outcome;
}

/** Writes each open portfolio's row for the latest close: what the board and the drift chart read. */
export async function snapshotPortfolios(): Promise<{ snapshots: number }> {
  const players = await db
    .select({ id: memberships.id, settings: clubs.settings })
    .from(memberships)
    .innerJoin(clubs, eq(clubs.id, memberships.clubId))
    .where(and(eq(memberships.plays, true), sql`exists (select 1 from ${lots} where ${lots.membershipId} = ${memberships.id})`));
  let snapshots = 0;
  for (const p of players) if (await snapshotDay(p.id, p.settings)) snapshots++;
  return { snapshots };
}

/** The whole step, in order: portfolios open before orders fill against them, and the day is recorded last. */
export async function runFills() {
  const portfolios = await openPortfolios();
  const fills = await fillOrders();
  const days = await snapshotPortfolios();
  return { ...portfolios, ...fills, ...days };
}
