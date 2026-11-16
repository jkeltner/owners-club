import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { companies, lots, memberships, orders, prices, user } from "@/db/schema";
import { createClub, leaveClub } from "@/clubs/clubs";
import { runFills } from "@/game/fills";
import { holdingsOf } from "@/game/holdings";
import { closeHasPassed, fillDay, planBuy, sellOldestFirst, taxForSale, taxOnRealized } from "@/game/ledger";
import { cancelOrder, draftFor, moneyFor, orderOf, placeBuy, saveDraft } from "@/game/picks";
import type { Parts } from "@/game/thesis_text";
import { DEFAULT_SETTINGS as S, INDEX_TICKER } from "@/lib/rules";

// November is Eastern Standard Time: New York is UTC minus 5.
const ny = (date: string, hour: number, minute = 0) => new Date(`${date}T${String(hour + 5).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`);

describe("when an order fills", () => {
  it("fills at that day's close if placed before 4 pm in New York, else the next weekday", () => {
    expect(fillDay(ny("2026-11-12", 9))).toBe("2026-11-12");
    expect(fillDay(ny("2026-11-12", 15, 59))).toBe("2026-11-12");
    expect(fillDay(ny("2026-11-12", 16))).toBe("2026-11-13");
    expect(fillDay(ny("2026-11-13", 17))).toBe("2026-11-16"); // Friday evening waits for Monday
    expect(fillDay(ny("2026-11-14", 11))).toBe("2026-11-16"); // Saturday
  });

  it("locks an order once its close has passed", () => {
    const placed = ny("2026-11-12", 10);
    expect(closeHasPassed(placed, ny("2026-11-12", 15, 30))).toBe(false);
    expect(closeHasPassed(placed, ny("2026-11-12", 16))).toBe(true);
    expect(closeHasPassed(ny("2026-11-13", 18), ny("2026-11-15", 12))).toBe(false); // weekend: Monday's close hasn't happened
  });
});

describe("the arithmetic of a trade", () => {
  const lotsHeld = [
    { id: "old", shares: 10, cost: 1000, boughtOn: "2026-01-05" },
    { id: "new", shares: 10, cost: 1500, boughtOn: "2026-11-02" },
  ];

  it("sells the oldest lot first and splits the gain by how long each lot was held", () => {
    const sale = sellOldestFirst(lotsHeld, 1800, 120, "2026-11-12", S);
    expect(sale.proceeds).toBe(1800);
    expect(sale.changes).toEqual([
      { id: "old", shares: 0, cost: 0 },
      { id: "new", shares: 5, cost: 750 },
    ]);
    expect(sale.realized).toEqual({ short: -150, long: 200 }); // old lot: 1200 for 1000; new lot: 600 for 750
  });

  it("sells everything when asked for all of it to the cent", () => {
    const sale = sellOldestFirst([{ id: "a", shares: 3.333333, cost: 300, boughtOn: "2026-11-02" }], 366.67, 110, "2026-11-12", S);
    expect(sale.changes).toEqual([{ id: "a", shares: 0, cost: 0 }]);
  });

  it("lets losses offset gains, and gives tax back when a loss follows a taxed gain", () => {
    expect(taxOnRealized({ short: 100, long: 100 }, S)).toBe(60); // 40% and 20%
    expect(taxOnRealized({ short: -150, long: 200 }, S)).toBe(10); // 50 of long-term gain left
    expect(taxOnRealized({ short: -300, long: 200 }, S)).toBe(0);
    expect(taxForSale({ short: 100, long: 0 }, 40, { short: -100, long: 0 }, S)).toBe(-40);
    expect(taxForSale({ short: -100, long: 0 }, 0, { short: 60, long: 0 }, S)).toBe(0); // an earlier loss carries forward
  });

  const buy = { amount: 2000, price: 50, indexPrice: 100, indexLots: [{ id: "i", shares: 100, cost: 10000, boughtOn: "2026-11-09" }], portfolioValue: 10000, companyValue: 0, date: "2026-11-10", realizedBefore: { short: 0, long: 0 }, taxPaid: 0, settings: S };

  it("charges the fee once, out of the amount moved", () => {
    const plan = planBuy(buy);
    expect(plan).toMatchObject({ ok: true, moved: 2000, trimmedBy: null, fee: 10, tax: 0, into: 1990 });
    if (plan.ok) expect(plan.shares).toBeCloseTo(39.8, 6);
  });

  it("takes the tax on the index's gain out of the amount too", () => {
    const plan = planBuy({ ...buy, indexPrice: 110, portfolioValue: 11000 });
    // 2000 of index at 110 cost 1818.18: a gain of 181.82, taxed at 40%.
    expect(plan).toMatchObject({ ok: true, moved: 2000, fee: 10, tax: 72.73, into: 1917.27, realized: { short: 181.82, long: 0 } });
  });

  it("trims an order that no longer fits, and refuses only when nothing fits", () => {
    expect(planBuy({ ...buy, amount: 2500, indexPrice: 90, portfolioValue: 9000 })).toMatchObject({ ok: true, moved: 2250, trimmedBy: "cap" });
    expect(planBuy({ ...buy, amount: 2000, indexLots: [{ ...buy.indexLots[0], shares: 15 }] })).toMatchObject({ ok: true, moved: 1500, trimmedBy: "index" });
    expect(planBuy({ ...buy, companyValue: 2500 })).toMatchObject({ ok: false });
    expect(planBuy({ ...buy, indexLots: [] })).toMatchObject({ ok: false });
  });
});

describe("the nightly fill step", () => {
  const parts: Parts = ["It makes chips nobody else can make as fast", "I think sales keep growing because data centers need them", "The P/E is 45, which means buyers expect a lot, and I think they're right"];
  const thesis = { parts, metric: "revenue_growth", value: 50 };
  let dee: { id: string; clubId: string; plays: boolean };
  const close = (ticker: string, date: string, c: number) => ({ ticker, date, close: c, source: "test" });
  const placedAt = (orderId: string, at: Date) => db.update(orders).set({ placedAt: at }).where(eq(orders.id, orderId));

  beforeAll(async () => {
    await dbReady;
    await db.insert(user).values({ id: "fill-dee", name: "fill-dee", email: "fill-dee@example.test" });
    dee = (await createClub("fill-dee", { name: "Fill Club", displayName: "Dee", plays: true }, ny("2026-11-09", 10))).membership; // opens at that day's close
    await db.update(memberships).set({ joinedAt: ny("2026-11-09", 10) }).where(eq(memberships.id, dee.id));
    await db.insert(companies).values([
      { ticker: "FIL", name: "Fillco", cik: 900300, sector: "Information Technology", subIndustry: "Semiconductors", lens: "Chipmakers" },
      { ticker: "FIL2", name: "Second Fillco", cik: 900301, sector: "Energy", subIndustry: "Oil & Gas Drilling" },
    ]);
    await db.insert(prices).values([close("SPY", "2026-11-09", 500), close("FIL", "2026-11-09", 100), close("FIL2", "2026-11-09", 40)]);
  });

  it("puts a new player's $10,000 into the index at the first close after joining, once", async () => {
    expect((await moneyFor(dee.id, S, "FIL")).portfolio).toBe(10000); // before any close
    expect(await runFills()).toMatchObject({ opened: 1 });
    expect(await runFills()).toMatchObject({ opened: 0 });
    const held = await db.select().from(lots).where(eq(lots.membershipId, dee.id));
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ ticker: INDEX_TICKER, shares: 20, cost: 10000, boughtOn: "2026-11-09", orderId: null });
  });

  it("leaves an order waiting until its close is stored", async () => {
    await saveDraft(dee.id, "FIL", thesis);
    const { order } = await placeBuy(dee, S, "FIL", 2000);
    await placedAt(order.id, ny("2026-11-09", 17)); // after Monday's close: fills Tuesday
    expect(await runFills()).toMatchObject({ filled: 0, stillWaiting: 1 });
    expect((await orderOf(order.id, dee.id))?.order.status).toBe("waiting");
  });

  it("won't cancel once the close has passed, even before the job runs", async () => {
    const [{ order }] = await db.select({ order: orders }).from(orders).where(eq(orders.membershipId, dee.id));
    await expect(cancelOrder(order.id, dee.id, ny("2026-11-10", 16, 5))).rejects.toThrow(/market has closed/);
  });

  it("fills at the next close: index out, fee and tax out, shares in", async () => {
    await db.insert(prices).values([close("SPY", "2026-11-10", 510), close("FIL", "2026-11-10", 100), close("FIL2", "2026-11-10", 40)]);
    expect(await runFills()).toMatchObject({ filled: 1, trimmed: 0, rejected: 0, stillWaiting: 0 });
    const [{ order }] = await db.select({ order: orders }).from(orders).where(eq(orders.membershipId, dee.id));
    // 2000 of index at 510 cost 1960.78: a gain of 39.22, taxed at 40% = 15.69. Fee 10.
    expect(order).toMatchObject({ status: "filled", fillDate: "2026-11-10", fillPrice: 100, filledAmount: 2000, fee: 10, gainShort: 39.22, gainLong: 0, tax: 15.69, note: null });
    expect(order.shares).toBeCloseTo(19.7431, 4);
    const { holdings, total } = await holdingsOf(dee.id);
    const index = holdings.find((h) => h.ticker === INDEX_TICKER)!;
    const pick = holdings.find((h) => h.ticker === "FIL")!;
    expect(index.value).toBeCloseTo(10200 - 2000, 1);
    expect(index.cost).toBeCloseTo(10000 - 1960.78, 1);
    expect(pick).toMatchObject({ cost: 1974.31, value: 1974.31, firstBought: "2026-11-10" });
    expect(total).toBeCloseTo(10200 - 10 - 15.69, 1); // the market's gain, less the fee and the tax
    // Running it again changes nothing.
    expect(await runFills()).toMatchObject({ opened: 0, filled: 0 });
    expect((await holdingsOf(dee.id)).total).toBe(total);
  });

  it("measures the buying limits against what the portfolio is worth now", async () => {
    const money = await moneyFor(dee.id, S, "FIL");
    expect(money.portfolio).toBeCloseTo(10174.31, 1);
    expect(money.cap).toBe(2543); // a quarter of it, in whole dollars
    expect(money.inThisCompany).toBe(1974.31);
    expect(money.max).toBe(568);
    expect((await moneyFor(dee.id, S, "FIL2")).max).toBe(2543);
  });

  it("skips a day with no closes (a holiday) and fills at the next one", async () => {
    await saveDraft(dee.id, "FIL2", thesis);
    const { order } = await placeBuy(dee, S, "FIL2", 1000);
    await placedAt(order.id, ny("2026-11-10", 18)); // would fill on the 11th; the 11th has no closes
    await db.insert(prices).values([close("SPY", "2026-11-12", 510), close("FIL", "2026-11-12", 100), close("FIL2", "2026-11-12", 50)]);
    expect(await runFills()).toMatchObject({ filled: 1 });
    expect((await orderOf(order.id, dee.id))?.order).toMatchObject({ status: "filled", fillDate: "2026-11-12", fillPrice: 50, tax: 7.84 }); // the index money still carries its gain from 500 to 510: 19.61 on this 1000
  });

  it("hands the thesis back when the company left the index before the close", async () => {
    await db.insert(companies).values({ ticker: "FIL3", name: "Third Fillco", cik: 900302, sector: "Energy", subIndustry: "Oil & Gas Drilling" });
    await db.insert(prices).values([close("FIL3", "2026-11-12", 10), close("SPY", "2026-11-13", 510), close("FIL3", "2026-11-13", 10)]);
    await saveDraft(dee.id, "FIL3", thesis);
    const { order } = await placeBuy(dee, S, "FIL3", 500);
    await placedAt(order.id, ny("2026-11-12", 18));
    await db.update(companies).set({ status: "removed" }).where(eq(companies.ticker, "FIL3"));
    const before = (await holdingsOf(dee.id)).total;
    expect(await runFills()).toMatchObject({ filled: 0, rejected: 1 });
    const found = await orderOf(order.id, dee.id);
    expect(found?.order.status).toBe("rejected");
    expect(found?.order.note).toMatch(/left the S&P 500/);
    expect(await draftFor(dee.id, "FIL3")).not.toBeNull();
    expect((await holdingsOf(dee.id)).total).toBe(before);
  });

  it("deletes a player's holdings when they leave", async () => {
    await leaveClub("fill-dee", dee.clubId);
    expect(await db.select().from(lots).where(eq(lots.membershipId, dee.id))).toHaveLength(0);
  });
});
