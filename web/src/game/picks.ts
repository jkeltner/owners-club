// Picks: the thesis a player writes, and the order that moves money out of the
// index holding into a company. Everything a screen or a server action does to
// `theses` and `orders` goes through here, so the rules (a written thesis, the
// purchase cap, the money actually left in the index) are checked in one
// place, on the server, whatever the screen allowed.
import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { companies, conversations, memberships, orders, theses } from "@/db/schema";
import { logEvent } from "@/lib/events";
import { INDEX_TICKER, maxPurchase, round2, STARTING_VALUE, tradeFee, type GameSettings } from "@/lib/rules";
import type { LastQuarter } from "@/market/metrics";
import { releaseThesis } from "./fills";
import { holdingsOf } from "./holdings";
import { closeHasPassed } from "./ledger";
import { portfolioOf } from "./portfolio";
import { joinParts, MAX_PART, metricById, written, type Parts, type PredictionMetric } from "./thesis_text";

export type Thesis = typeof theses.$inferSelect;
export type Order = typeof orders.$inferSelect;

/** A rule said no. The message is written for the player. */
export class PickError extends Error {}

// ---- The thesis ----

export type ThesisInput = { parts: Parts; metric: string; value: number };

/** The last quarter's number for a prediction metric: what the player's guess is compared with on screen. */
export function predictionRef(metric: PredictionMetric, last: LastQuarter | null): number | null {
  if (!last) return null;
  return metric === "revenue_growth" ? last.revenueGrowth : metric === "eps" ? last.eps : last.netMargin;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim().slice(0, MAX_PART);

/** Checks a thesis the way the screen does: three parts in the player's own words and one measurable prediction. */
export function checkThesis(input: ThesisInput, starters: string[] = []) {
  const parts = input.parts.map(clean) as Parts;
  for (let i = 0; i < 3; i++) if (!written(parts, i, starters)) throw new PickError(`Part ${i + 1} of your thesis needs a few more words of your own`);
  const metric = metricById(input.metric);
  if (!metric) throw new PickError("Pick one number to predict");
  const value = Number(input.value);
  if (!Number.isFinite(value) || value < metric.min || value > metric.max) throw new PickError("That prediction is outside what we can check");
  return { parts, metric, value: round2(value) };
}

/**
 * Saves the thesis a player has written for a company they haven't bought yet.
 * One draft per player per company: writing it again replaces it.
 */
export async function saveDraft(membershipId: string, ticker: string, input: ThesisInput, starters: string[] = []): Promise<Thesis> {
  const { parts, metric, value } = checkThesis(input, starters);
  const values = {
    doesWell: parts[0],
    happensNext: parts[1],
    numberWatched: parts[2],
    predictionMetric: metric.id,
    predictionValue: value,
    predictionUnit: metric.unit,
    updatedAt: new Date(),
  };
  const existing = await draftFor(membershipId, ticker);
  if (existing) {
    const [updated] = await db.update(theses).set(values).where(eq(theses.id, existing.id)).returning();
    return updated;
  }
  const [created] = await db
    .insert(theses)
    .values({ membershipId, ticker, kind: "pick", status: "draft", ...values })
    .returning();
  return created;
}

export async function draftFor(membershipId: string, ticker: string): Promise<Thesis | null> {
  const [row] = await db
    .select()
    .from(theses)
    .where(and(eq(theses.membershipId, membershipId), eq(theses.ticker, ticker), eq(theses.kind, "pick"), eq(theses.status, "draft")))
    .orderBy(desc(theses.updatedAt))
    .limit(1);
  return row ?? null;
}

export const thesisParts = (t: Pick<Thesis, "doesWell" | "happensNext" | "numberWatched">): Parts => [t.doesWell, t.happensNext, t.numberWatched];
export const thesisText = (t: Pick<Thesis, "doesWell" | "happensNext" | "numberWatched">) => joinParts(thesisParts(t));

// ---- Money ----

export type Money = {
  portfolio: number; // what the cap is a share of
  inPicks: number; // already moved, or waiting to move, out of the index
  indexLeft: number; // still in the index holding
  inThisCompany: number; // already in (or on its way into) this company
  cap: number; // the most one company can take at purchase
  max: number; // the most this order can be
};

/**
 * What a player can put into a company right now. Holdings are valued at the
 * last close; before a portfolio's first close it is the starting $10,000,
 * all in the index. A waiting buy counts at the dollars it asked for, so five
 * orders in one evening can't add up past the cap. The fill step checks again
 * at the close and trims an order that no longer fits.
 */
export async function moneyFor(membershipId: string, settings: GameSettings, ticker?: string): Promise<Money> {
  const [{ holdings, total }, waiting] = await Promise.all([
    holdingsOf(membershipId),
    db
      .select({ ticker: orders.ticker, amount: orders.amount })
      .from(orders)
      .where(and(eq(orders.membershipId, membershipId), eq(orders.side, "buy"), eq(orders.status, "waiting"))),
  ]);
  const opened = holdings.length > 0;
  const portfolio = opened ? total : STARTING_VALUE;
  const inIndex = opened ? (holdings.find((h) => h.ticker === INDEX_TICKER)?.value ?? 0) : STARTING_VALUE;
  const held = holdings.find((h) => h.ticker === ticker)?.value ?? 0;
  const waitingAll = waiting.reduce((a, o) => a + o.amount, 0);
  const waitingHere = waiting.filter((o) => o.ticker === ticker).reduce((a, o) => a + o.amount, 0);
  const inPicks = round2(portfolio - inIndex + waitingAll);
  const inThisCompany = round2(held + waitingHere);
  const indexLeft = round2(Math.max(0, inIndex - waitingAll));
  const cap = maxPurchase(portfolio, settings);
  return { portfolio, inPicks, indexLeft, inThisCompany, cap, max: Math.max(0, Math.floor(Math.min(cap - inThisCompany, indexLeft))) };
}

// ---- The order ----

type Buyer = { id: string; clubId: string; plays: boolean };

/**
 * Places a buy: moves `amount` dollars from the index holding into the company
 * the player has a written thesis for. The order waits for the next market
 * close. Refused (and logged, without the player's words) when a rule says no.
 */
export async function placeBuy(buyer: Buyer, settings: GameSettings, ticker: string, amount: number): Promise<{ order: Order; thesis: Thesis; first: boolean }> {
  const refuse = async (message: string, detail: Record<string, unknown> = {}): Promise<never> => {
    await logEvent({ level: "info", kind: "trade.rejected", message, detail: { membershipId: buyer.id, ticker, amount, ...detail } });
    throw new PickError(message);
  };
  if (!buyer.plays) await refuse("You're running this club, not playing in it, so you don't have a portfolio");
  const [company] = await db
    .select({ ticker: companies.ticker })
    .from(companies)
    .where(and(eq(companies.ticker, ticker), eq(companies.status, "active")));
  if (!company) await refuse("That company isn't in the game");
  const draft = await draftFor(buyer.id, ticker);
  if (!draft) await refuse("Write your thesis first: every pick needs a reason");
  const dollars = round2(Number(amount));
  if (!Number.isFinite(dollars) || dollars < 1) await refuse("Choose how much to move into this pick");
  const money = await moneyFor(buyer.id, settings, ticker);
  if (dollars > money.indexLeft) await refuse("That's more than you have left in your index fund", { indexLeft: money.indexLeft });
  if (dollars > money.max) await refuse(`That's over this club's limit for one company`, { cap: money.cap, inThisCompany: money.inThisCompany });

  return db.transaction(async (tx) => {
    // A cancelled order was never a pick, so the next one can still be the first.
    const already = await tx.$count(orders, and(eq(orders.membershipId, buyer.id), ne(orders.status, "cancelled")));
    const [order] = await tx.insert(orders).values({ membershipId: buyer.id, ticker, side: "buy", amount: dollars }).returning();
    const [thesis] = await tx.update(theses).set({ status: "final", orderId: order.id, updatedAt: new Date() }).where(eq(theses.id, draft!.id)).returning();
    // The coach conversation that led here now belongs to this thesis; the next pick of this company starts a new one.
    const [talk] = await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.membershipId, buyer.id), eq(conversations.mode, "pick"), eq(conversations.ticker, ticker), isNull(conversations.thesisId)))
      .orderBy(desc(conversations.updatedAt))
      .limit(1);
    if (talk) await tx.update(conversations).set({ thesisId: thesis.id }).where(eq(conversations.id, talk.id));
    return { order, thesis, first: already === 0 };
  });
}

/**
 * Takes back an order before the close it is waiting for. Nothing was bought,
 * so there is no fee and no hold: the money never left the index. The thesis
 * goes back to a draft and the coach conversation reopens. Once that close has
 * passed the order is going through, even if the nightly job hasn't run yet:
 * otherwise a player could see the closing price and then decide.
 */
export async function cancelOrder(orderId: string, membershipId: string, now = new Date()): Promise<Order> {
  const [mine] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.membershipId, membershipId)));
  if (mine?.status === "waiting" && closeHasPassed(mine.placedAt, now)) throw new PickError("The market has closed on this order, so it's going through tonight and can't be cancelled");
  const cancelled = await db.transaction(async (tx) => {
    const [order] = await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.id, orderId), eq(orders.membershipId, membershipId), eq(orders.status, "waiting")))
      .returning();
    if (!order) return null;
    await releaseThesis(tx, order.id);
    return order;
  });
  if (!cancelled) throw new PickError("This order can't be cancelled: it has already gone through, or it isn't yours");
  await logEvent({ level: "info", kind: "trade.cancelled", message: "A waiting order was cancelled", detail: { membershipId, orderId, ticker: cancelled.ticker, amount: cancelled.amount } });
  return cancelled;
}

// ---- Selling ----

/**
 * Places a sell: `dollars` worth of a company at the last close, turned into
 * shares, because the price it will sell at isn't known until the close. Only
 * shares past the club's minimum hold can go, less any already in a waiting
 * sell. What it brings in goes back into the index fund.
 */
export async function placeSell(seller: Buyer, settings: GameSettings, ticker: string, dollars: number, now = new Date()): Promise<Order> {
  const refuse = async (message: string, detail: Record<string, unknown> = {}): Promise<never> => {
    await logEvent({ level: "info", kind: "trade.rejected", message, detail: { membershipId: seller.id, ticker, side: "sell", dollars, ...detail } });
    throw new PickError(message);
  };
  if (!seller.plays) await refuse("You're running this club, not playing in it, so you don't have a portfolio");
  if (ticker === INDEX_TICKER) await refuse("Your index fund money moves when you make a pick; it can't be sold on its own");
  const { holdings } = await portfolioOf(seller.id, settings, { now });
  const held = holdings.find((h) => h.ticker === ticker);
  if (!held || held.price == null) await refuse("You don't own any of that company");
  const h = held!;
  if (h.sellableShares * h.price! < 0.01) {
    await refuse(h.lockedUntil ? "This pick is still inside this club's minimum hold, so it can't be sold yet" : "All of this pick is already in a sell order that's waiting for the close", { lockedUntil: h.lockedUntil });
  }
  const asked = round2(Number(dollars));
  if (!Number.isFinite(asked) || asked < 1) await refuse("Choose how much to sell");
  const most = h.sellableShares * h.price!;
  if (asked > most + 0.01) await refuse("That's more than you can sell right now", { most: round2(most) });
  // Within a dollar of everything sells everything, so a few cents of a company aren't left behind.
  const all = most - asked < 1;
  const askedShares = all ? h.sellableShares : asked / h.price!;
  const [order] = await db
    .insert(orders)
    .values({ membershipId: seller.id, ticker, side: "sell", amount: all ? round2(most) : asked, askedShares })
    .returning();
  return order;
}

/** The fee an order will pay when it fills, at the club's rate. */
export const feeFor = (amount: number, settings: GameSettings) => tradeFee(amount, settings);

// ---- Reading picks ----

/** A player's orders, newest first, each with the thesis written for it. */
export async function ordersOf(membershipId: string) {
  return db
    .select({ order: orders, thesis: theses, name: companies.name })
    .from(orders)
    .leftJoin(theses, eq(theses.orderId, orders.id))
    .leftJoin(companies, eq(companies.ticker, orders.ticker))
    .where(eq(orders.membershipId, membershipId))
    .orderBy(desc(orders.placedAt));
}

/** One order with its thesis, only for the player who placed it. */
export async function orderOf(orderId: string, membershipId: string) {
  const [row] = await db
    .select({ order: orders, thesis: theses })
    .from(orders)
    .leftJoin(theses, eq(theses.orderId, orders.id))
    .where(and(eq(orders.id, orderId), eq(orders.membershipId, membershipId)));
  return row ?? null;
}

export async function orderCount(membershipId: string) {
  return db.$count(orders, eq(orders.membershipId, membershipId));
}

/**
 * Why clubmates bought what they bought: final theses from the same club,
 * newest first. Theses are written to be read by the club; the dollars behind
 * them are not shown here.
 */
export async function clubTheses(clubId: string, exceptMembershipId: string, limit = 8) {
  const mates = await db
    .select({ id: memberships.id, displayName: memberships.displayName, avatar: memberships.avatar })
    .from(memberships)
    .where(and(eq(memberships.clubId, clubId), ne(memberships.id, exceptMembershipId)));
  if (!mates.length) return [];
  const rows = await db
    .select({ thesis: theses, name: companies.name })
    .from(theses)
    .leftJoin(companies, eq(companies.ticker, theses.ticker))
    .where(and(inArray(theses.membershipId, mates.map((m) => m.id)), eq(theses.status, "final"), eq(theses.kind, "pick")))
    .orderBy(desc(theses.updatedAt))
    .limit(limit);
  const byId = new Map(mates.map((m) => [m.id, m]));
  return rows.map((r) => ({ who: byId.get(r.thesis.membershipId)!, ticker: r.thesis.ticker, officialName: r.name ?? r.thesis.ticker, text: thesisText(r.thesis) }));
}
