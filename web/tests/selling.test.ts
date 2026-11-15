import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { clubs, companies, memberships, orders, prices, user } from "@/db/schema";
import { createClub } from "@/clubs/clubs";
import { runFills } from "@/game/fills";
import { planSell, taxIfAllSold } from "@/game/ledger";
import { cancelOrder, moneyFor, orderOf, placeBuy, placeSell, saveDraft } from "@/game/picks";
import { daysOf, portfolioOf } from "@/game/portfolio";
import type { Parts } from "@/game/thesis_text";
import { DEFAULT_SETTINGS as S, INDEX_TICKER } from "@/lib/rules";

// November is Eastern Standard Time: New York is UTC minus 5.
const ny = (date: string, hour: number) => new Date(`${date}T${String(hour + 5).padStart(2, "0")}:00:00Z`);

describe("the arithmetic of a sell", () => {
  const lots = [
    { id: "old", shares: 10, cost: 1000, boughtOn: "2026-01-05" },
    { id: "new", shares: 10, cost: 1500, boughtOn: "2026-11-02" },
  ];
  const sell = { shares: 5, price: 120, indexPrice: 600, lots, date: "2026-11-12", realizedBefore: { short: 0, long: 0 }, taxPaid: 0, settings: S };

  it("sells the oldest shares, takes the fee and the tax out, and puts the rest in the index", () => {
    const plan = planSell(sell);
    // 5 shares at 120 = 600; they cost 500; held since January, so the 100 gain is taxed at 20%.
    expect(plan).toMatchObject({ ok: true, shares: 5, trimmed: false, proceeds: 600, fee: 3, tax: 20, into: 577, realized: { short: 0, long: 100 } });
    if (plan.ok) expect(plan.indexShares).toBeCloseTo(577 / 600, 8);
  });

  it("sells only what is past the minimum hold, and says so", () => {
    expect(planSell({ ...sell, shares: 15 })).toMatchObject({ ok: true, shares: 10, trimmed: true, proceeds: 1200, changes: [{ id: "old", shares: 0, cost: 0 }] });
    expect(planSell({ ...sell, lots: [lots[1]] })).toMatchObject({ ok: false });
    expect(planSell({ ...sell, lots: [] })).toMatchObject({ ok: false });
  });

  it("gives tax back when a loss follows a gain that was already taxed", () => {
    const plan = planSell({ ...sell, price: 80, realizedBefore: { short: 200, long: 0 }, taxPaid: 80 });
    // 5 shares at 80 = 400 against a cost of 500: a 100 long-term loss, which comes off the 200 short-term gain.
    expect(plan).toMatchObject({ ok: true, proceeds: 400, fee: 2, tax: -40, into: 438 });
  });

  it("works out the tax still owed if everything were sold today", () => {
    const held = [
      { cost: 1000, value: 1200, boughtOn: "2026-01-05" }, // +200, long-term
      { cost: 1500, value: 1400, boughtOn: "2026-11-02" }, // −100, short-term
    ];
    expect(taxIfAllSold(held, "2026-11-12", { short: 0, long: 0 }, 0, S)).toBe(20); // 100 of long-term gain left
    expect(taxIfAllSold(held, "2026-11-12", { short: 50, long: 0 }, 20, S)).toBe(10); // the 50 loss left on the short side comes off the 200: 150 × 20% = 30, less the 20 already paid
  });
});

describe("selling a pick", () => {
  const parts: Parts = ["It makes chips nobody else can make as fast", "I think sales keep growing because data centers need them", "The P/E is 45, which means buyers expect a lot, and I think they're right"];
  const settings = { ...S, minHoldDays: 14 };
  let dee: { id: string; clubId: string; plays: boolean };
  const day = (date: string, spy: number, sel: number) => db.insert(prices).values([{ ticker: "SPY", date, close: spy, source: "test" }, { ticker: "SEL", date, close: sel, source: "test" }]);
  const placedAt = (orderId: string, at: Date) => db.update(orders).set({ placedAt: at }).where(eq(orders.id, orderId));

  beforeAll(async () => {
    await dbReady;
    await db.insert(user).values({ id: "sell-dee", name: "sell-dee", email: "sell-dee@example.test" });
    dee = (await createClub("sell-dee", { name: "Sell Club", displayName: "Dee", plays: true })).membership;
    await db.update(clubs).set({ settings }).where(eq(clubs.id, dee.clubId));
    await db.update(memberships).set({ joinedAt: ny("2026-11-09", 10) }).where(eq(memberships.id, dee.id));
    await db.insert(companies).values({ ticker: "SEL", name: "Sellco", cik: 900400, sector: "Information Technology", subIndustry: "Semiconductors", lens: "Chipmakers" });
    await day("2026-11-09", 500, 100);
    await runFills();
    await saveDraft(dee.id, "SEL", { parts, metric: "revenue_growth", value: 50 });
    const { order } = await placeBuy(dee, settings, "SEL", 2000);
    await placedAt(order.id, ny("2026-11-09", 17));
    await day("2026-11-10", 500, 100);
    await runFills(); // 2000 moved, fee 10: 19.9 shares, bought on the 10th
  });

  it("refuses while the pick is inside the club's minimum hold", async () => {
    await expect(placeSell(dee, settings, "SEL", 500, ny("2026-11-12", 10))).rejects.toThrow(/minimum hold/);
    await expect(placeSell(dee, settings, INDEX_TICKER, 500, ny("2026-11-12", 10))).rejects.toThrow(/index fund/);
  });

  it("shows the portfolio at the last close, with the tax owed and the untouched index beside it", async () => {
    await day("2026-11-23", 500, 120);
    const p = await portfolioOf(dee.id, settings, { now: ny("2026-11-23", 17) });
    expect(p).toMatchObject({ opened: true, asOf: "2026-11-23", total: 10388, taxOwed: 159.2, afterTax: 10228.8, feesPaid: 10, taxesPaid: 0, index: { value: 10000, afterTax: 10000 } });
    expect(p.holdings.map((h) => h.ticker)).toEqual([INDEX_TICKER, "SEL"]);
    const pick = p.holdings[1];
    expect(pick).toMatchObject({ name: "Sellco", value: 2388, cost: 1990, lockedUntil: null });
    expect(pick.sellableShares).toBeCloseTo(19.9, 6); // an order placed after the 23rd's close fills on the 24th, when the 14 days are up
    expect(pick.lots[0]).toMatchObject({ boughtOn: "2026-11-10", unlockOn: "2026-11-24", longTermOn: "2027-05-11" });
  });

  it("sells half at the next close: fee and tax out, the rest into the index", async () => {
    const order = await placeSell(dee, settings, "SEL", 1194, ny("2026-11-23", 17));
    expect(order).toMatchObject({ side: "sell", status: "waiting", amount: 1194 });
    expect(order.askedShares).toBeCloseTo(9.95, 6);
    await placedAt(order.id, ny("2026-11-23", 17));
    // The shares in a waiting sell can't be sold twice.
    await expect(placeSell(dee, settings, "SEL", 1500, ny("2026-11-23", 18))).rejects.toThrow(/more than you can sell/);
    await day("2026-11-24", 500, 120);
    expect(await runFills()).toMatchObject({ filled: 1, rejected: 0, snapshots: 1 });
    // 9.95 shares at 120 = 1194; they cost 995: a 199 gain held two weeks, taxed at 40%.
    expect((await orderOf(order.id, dee.id))?.order).toMatchObject({ status: "filled", fillDate: "2026-11-24", fillPrice: 120, filledAmount: 1194, fee: 5.97, gainShort: 199, gainLong: 0, tax: 79.6, note: null });
    const p = await portfolioOf(dee.id, settings, { now: ny("2026-11-24", 17) });
    const index = p.holdings[0];
    expect(index.value).toBeCloseTo(8000 + 1108.43, 2);
    expect(index.lots).toHaveLength(2);
    expect(p.holdings[1].value).toBeCloseTo(1194, 2);
    expect(p).toMatchObject({ total: 10302.43, taxOwed: 79.6, afterTax: 10222.83, feesPaid: 15.97, taxesPaid: 79.6 });
  });

  it("records each day for the board", async () => {
    const days = await daysOf(dee.id);
    expect(days.map((d) => d.date)).toEqual(["2026-11-09", "2026-11-10", "2026-11-24"]);
    expect(days.at(-1)).toMatchObject({ value: 10302.43, taxOwed: 79.6, afterTax: 10222.83, indexAfterTax: 10000 });
    expect(days.at(-1)!.holdings.map((h) => h.ticker)).toEqual([INDEX_TICKER, "SEL"]);
  });

  it("lets a waiting sell be cancelled before the close, and frees the shares", async () => {
    const order = await placeSell(dee, settings, "SEL", 1194, ny("2026-11-24", 17));
    expect(order.askedShares).toBeCloseTo(9.95, 6); // the whole of what is left
    await placedAt(order.id, ny("2026-11-24", 17));
    expect((await portfolioOf(dee.id, settings, { now: ny("2026-11-24", 18) })).holdings[1].sellableShares).toBe(0);
    await cancelOrder(order.id, dee.id, ny("2026-11-25", 10));
    expect((await portfolioOf(dee.id, settings, { now: ny("2026-11-25", 10) })).holdings[1].sellableShares).toBeCloseTo(9.95, 6);
  });

  it("gives tax back when the rest is sold at a loss", async () => {
    const order = await placeSell(dee, settings, "SEL", 1194, ny("2026-11-24", 18));
    await placedAt(order.id, ny("2026-11-24", 18));
    await day("2026-11-25", 500, 90);
    expect(await runFills()).toMatchObject({ filled: 1 });
    // 9.95 shares at 90 = 895.50 against a cost of 995: a 99.50 loss, which halves the earlier gain, so half the tax comes back.
    expect((await orderOf(order.id, dee.id))?.order).toMatchObject({ status: "filled", filledAmount: 895.5, fee: 4.48, gainShort: -99.5, tax: -39.8 });
    const p = await portfolioOf(dee.id, settings);
    expect(p.holdings.map((h) => h.ticker)).toEqual([INDEX_TICKER]);
    expect(p).toMatchObject({ total: 10039.25, taxOwed: 0, afterTax: 10039.25, feesPaid: 20.45, taxesPaid: 39.8 });
    expect((await moneyFor(dee.id, settings, "SEL")).inThisCompany).toBe(0);
  });
});
