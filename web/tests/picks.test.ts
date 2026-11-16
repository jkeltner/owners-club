import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { appEvents, companies, conversations, orders, theses, user } from "@/db/schema";
import { createClub, createInvite, joinClub, leaveClub, makeOrganizer } from "@/clubs/clubs";
import { coachTurn, openConversation } from "@/coach/conversations";
import { cancelOrder, checkThesis, clubTheses, draftFor, moneyFor, orderOf, ordersOf, PickError, placeBuy, predictionRef, saveDraft, thesisText } from "@/game/picks";
import { joinParts, numberStarters, partsFromChat, startingValue, written, type Parts } from "@/game/thesis_text";
import { DEFAULT_SETTINGS } from "@/lib/rules";

const parts: Parts = ["It makes chips nobody else can make as fast", "I think sales keep growing because data centers need them", "The P/E is 45, which means buyers expect a lot, and I think they're right"];
const thesis = { parts, metric: "revenue_growth", value: 50 };
const starters = ["The P/E is 45, which means ", "Sales grew 56% over the last 12 months, so "];

describe("a thesis", () => {
  it("needs three parts in the player's own words", () => {
    expect(checkThesis(thesis, starters).parts).toEqual(parts);
    expect(() => checkThesis({ ...thesis, parts: ["", parts[1], parts[2]] })).toThrow(/Part 1/);
    expect(() => checkThesis({ ...thesis, parts: [parts[0], "ok", parts[2]] })).toThrow(/Part 2/);
  });

  it("doesn't count a tapped starter as the player's words", () => {
    const tapped: Parts = [parts[0], parts[1], "The P/E is 45, which means "];
    expect(written(tapped, 2, starters)).toBe(false);
    expect(() => checkThesis({ ...thesis, parts: tapped }, starters)).toThrow(/Part 3/);
    expect(written([parts[0], parts[1], "The P/E is 45, which means buyers expect a lot"], 2, starters)).toBe(true);
  });

  it("needs one prediction we can check", () => {
    expect(() => checkThesis({ ...thesis, metric: "stock_price" })).toThrow(/number to predict/);
    expect(() => checkThesis({ ...thesis, value: Number.NaN })).toThrow(/outside/);
    expect(() => checkThesis({ ...thesis, value: 5000 })).toThrow(/outside/);
    expect(checkThesis({ ...thesis, metric: "eps", value: 2.456 }).value).toBe(2.46);
  });

  it("builds starters only from numbers on the company page", () => {
    expect(numberStarters({ name: "Chipco", pe: 45.2, netIncomeTtm: 1, revenueGrowth: 56.4, netMargin: 52.6 })).toEqual([
      "The P/E is 45, which means ",
      "Sales grew 56% over the last 12 months, so ",
      "It keeps 53¢ of each $1 of sales, which ",
    ]);
    expect(numberStarters({ name: "Chipco", pe: 312, netIncomeTtm: 1, revenueGrowth: -6, netMargin: 1 })[0]).toBe("The P/E is over 100, which means ");
    expect(numberStarters({ name: "Planeco", pe: null, netIncomeTtm: -9, revenueGrowth: 12, netMargin: -11 })).toEqual([
      "Planeco lost money over the last 12 months, so ",
      "Its sales are growing 12% while it loses money, so ",
    ]);
    expect(numberStarters({ name: "Newco", pe: null, netIncomeTtm: null, revenueGrowth: null, netMargin: null })).toEqual([]);
  });

  it("starts a draft from the player's chat answers, never the coach's words", () => {
    expect(partsFromChat(["chips are in everything", "What does P/E mean?", "new customers sign up"])).toEqual([
      "Chips are in everything.",
      "It could do better than buyers think if new customers sign up.",
      "",
    ]);
    expect(partsFromChat(["Not sure yet", "Lots of growth", "Not sure"])).toEqual(["", "", ""]);
    expect(joinParts(["One thing", " two things. ", ""])).toBe("One thing. two things.");
  });

  it("starts the prediction on last quarter's number", () => {
    const last = { period: "CY2026Q3", periodEnd: "2026-09-30", revenue: 1, netIncome: 1, revenueGrowth: 12.4, eps: 2.46, netMargin: 31.6 };
    expect(startingValue("revenue_growth", predictionRef("revenue_growth", last))).toBe(12);
    expect(startingValue("eps", predictionRef("eps", last))).toBe(2.45);
    expect(startingValue("margin", predictionRef("margin", last))).toBe(32);
    expect(startingValue("eps", predictionRef("eps", null))).toBe(1);
  });
});

describe("placing a pick", () => {
  let ana: { id: string; clubId: string; plays: boolean };
  let bo: { id: string; clubId: string; plays: boolean };
  let teacher: { id: string; clubId: string; plays: boolean };
  let clubId = "";
  let inviteCode = "";

  beforeAll(async () => {
    await dbReady;
    await db.insert(user).values(["pick-ana", "pick-bo", "pick-cy", "pick-teach"].map((p) => ({ id: p, name: p, email: `${p}@example.test` })));
    const made = await createClub("pick-teach", { name: "Period 3", displayName: "Ms. T", plays: false }, new Date("2026-01-05T15:00:00Z")); // long open
    clubId = made.club.id;
    teacher = made.membership;
    inviteCode = (await createInvite("pick-teach", clubId)).code;
    ana = await joinClub("pick-ana", inviteCode, { displayName: "Ana" });
    bo = await joinClub("pick-bo", inviteCode, { displayName: "Bo" });
    await db.insert(companies).values([
      { ticker: "PCK", name: "Pickco", cik: 900200, sector: "Information Technology", subIndustry: "Semiconductors", lens: "Chipmakers" },
      { ticker: "PCK2", name: "Second Pickco Corporation", cik: 900201, sector: "Consumer Staples", subIndustry: "Soft Drinks & Non-alcoholic Beverages", lens: "Consumer brands" },
      { ticker: "GONE", name: "Left The Index", cik: 900202, sector: "Energy", subIndustry: "Oil & Gas Drilling", status: "removed" },
    ]);
  });

  it("starts everyone with the whole $10,000 in the index and a quarter of it per company", async () => {
    expect(await moneyFor(ana.id, DEFAULT_SETTINGS, "PCK")).toEqual({ portfolio: 10000, inPicks: 0, indexLeft: 10000, inThisCompany: 0, cap: 2500, max: 2500 });
    expect((await moneyFor(ana.id, { ...DEFAULT_SETTINGS, capAtPurchase: 0.1 }, "PCK")).max).toBe(1000);
  });

  it("refuses a buy with no written thesis, and logs it without the player's words", async () => {
    await expect(placeBuy(ana, DEFAULT_SETTINGS, "PCK", 1000)).rejects.toThrow(/thesis first/);
    await expect(placeBuy(ana, DEFAULT_SETTINGS, "PCK", 1000)).rejects.toBeInstanceOf(PickError);
    const [event] = await db.select().from(appEvents).where(eq(appEvents.kind, "trade.rejected"));
    expect(event.detail).toMatchObject({ membershipId: ana.id, ticker: "PCK", amount: 1000 });
  });

  it("keeps one draft per player per company", async () => {
    const first = await saveDraft(ana.id, "PCK", thesis, starters);
    const second = await saveDraft(ana.id, "PCK", { ...thesis, value: 60 }, starters);
    expect(second.id).toBe(first.id);
    expect((await draftFor(ana.id, "PCK"))?.predictionValue).toBe(60);
    expect(await draftFor(bo.id, "PCK")).toBeNull();
  });

  it("refuses more than the cap, more than the index holds, and companies outside the game", async () => {
    await expect(placeBuy(ana, DEFAULT_SETTINGS, "PCK", 2501)).rejects.toThrow(/limit for one company/);
    await expect(placeBuy(ana, { ...DEFAULT_SETTINGS, capAtPurchase: 1 }, "PCK", 10001)).rejects.toThrow(/left in your index fund/);
    await expect(placeBuy(ana, DEFAULT_SETTINGS, "PCK", 0)).rejects.toThrow(/how much/);
    await expect(placeBuy(ana, DEFAULT_SETTINGS, "GONE", 100)).rejects.toThrow(/isn't in the game/);
    await expect(placeBuy(ana, DEFAULT_SETTINGS, "NOPE", 100)).rejects.toThrow(/isn't in the game/);
    expect(await ordersOf(ana.id)).toHaveLength(0);
  });

  it("doesn't give an organizer who isn't playing a portfolio", async () => {
    await saveDraft(teacher.id, "PCK", thesis);
    await expect(placeBuy(teacher, DEFAULT_SETTINGS, "PCK", 500)).rejects.toThrow(/not playing/);
  });

  it("places the order to wait for the next close, with its thesis and the conversation behind it", async () => {
    const talk = await openConversation(ana.id, "pick", "PCK");
    const { order, thesis: saved, first } = await placeBuy(ana, DEFAULT_SETTINGS, "PCK", 2000);
    expect(first).toBe(true);
    expect(order).toMatchObject({ ticker: "PCK", side: "buy", amount: 2000, status: "waiting", fillDate: null, fillPrice: null, fee: null });
    expect(saved).toMatchObject({ status: "final", orderId: order.id, predictionMetric: "revenue_growth", predictionValue: 60, predictionUnit: "%" });
    expect(thesisText(saved)).toBe(joinParts(parts));
    expect(await draftFor(ana.id, "PCK")).toBeNull();
    // The conversation now belongs to that thesis; the next pick of this company starts a new one.
    const [linked] = await db.select().from(conversations).where(eq(conversations.id, talk.id));
    expect(linked.thesisId).toBe(saved.id);
    expect((await openConversation(ana.id, "pick", "PCK")).id).not.toBe(talk.id);
    expect((await orderOf(order.id, ana.id))?.thesis?.id).toBe(saved.id);
  });

  it("counts what's already in a company toward the cap, and what's left in the index", async () => {
    expect(await moneyFor(ana.id, DEFAULT_SETTINGS, "PCK")).toMatchObject({ inPicks: 2000, indexLeft: 8000, inThisCompany: 2000, max: 500 });
    await saveDraft(ana.id, "PCK", thesis, starters);
    await expect(placeBuy(ana, DEFAULT_SETTINGS, "PCK", 600)).rejects.toThrow(/limit for one company/);
    const { first } = await placeBuy(ana, DEFAULT_SETTINGS, "PCK", 500);
    expect(first).toBe(false);
    expect((await moneyFor(ana.id, DEFAULT_SETTINGS, "PCK")).max).toBe(0);
    expect((await moneyFor(ana.id, DEFAULT_SETTINGS, "PCK2")).max).toBe(2500);
  });

  it("shows clubmates why you bought, and nothing else", async () => {
    const seen = await clubTheses(clubId, bo.id);
    expect(seen).toHaveLength(2);
    expect(seen[0]).toMatchObject({ ticker: "PCK", officialName: "Pickco", text: joinParts(parts) });
    expect(seen[0].who.displayName).toBe("Ana");
    expect(JSON.stringify(seen)).not.toMatch(/2000|amount/); // the dollars aren't part of it
    // Not your own, not drafts, not other clubs.
    expect(await clubTheses(clubId, ana.id)).toHaveLength(0);
    await saveDraft(bo.id, "PCK2", thesis);
    expect(await clubTheses(clubId, ana.id)).toHaveLength(0);
    const elsewhere = await createClub("pick-cy", { name: "Other Club", displayName: "Cy", plays: true }, new Date("2026-01-05T15:00:00Z"));
    expect(await clubTheses(elsewhere.club.id, elsewhere.membership.id)).toHaveLength(0);
  });

  it("lets a player cancel a waiting order: the money, the draft and the conversation come back", async () => {
    // Bo already has a PCK2 draft from the test above.
    const talk = await openConversation(bo.id, "pick", "PCK2");
    const { order, thesis: placed, first } = await placeBuy(bo, DEFAULT_SETTINGS, "PCK2", 1500);
    expect(first).toBe(true);
    expect((await moneyFor(bo.id, DEFAULT_SETTINGS, "PCK2")).indexLeft).toBe(8500);
    // Not someone else's order.
    await expect(cancelOrder(order.id, ana.id)).rejects.toThrow(PickError);
    const cancelled = await cancelOrder(order.id, bo.id);
    expect(cancelled).toMatchObject({ status: "cancelled", fee: null, fillDate: null });
    expect(await moneyFor(bo.id, DEFAULT_SETTINGS, "PCK2")).toMatchObject({ inPicks: 0, indexLeft: 10000, inThisCompany: 0, max: 2500 });
    expect((await draftFor(bo.id, "PCK2"))?.id).toBe(placed.id);
    expect((await openConversation(bo.id, "pick", "PCK2")).id).toBe(talk.id);
    expect((await orderOf(order.id, bo.id))?.thesis).toBeNull();
    // Clubmates no longer see a thesis nothing was bought with.
    expect((await clubTheses(clubId, ana.id)).filter((t) => t.who.displayName === "Bo")).toHaveLength(0);
    const [logged] = await db.select().from(appEvents).where(and(eq(appEvents.kind, "trade.cancelled")));
    expect(JSON.stringify(logged.detail)).not.toMatch(/chips|data centers/);
    // Once is enough, and a filled order stays bought.
    await expect(cancelOrder(order.id, bo.id)).rejects.toThrow(/can't be cancelled/);
    const again = await placeBuy(bo, DEFAULT_SETTINGS, "PCK2", 1000);
    expect(again.first).toBe(true); // the cancelled one was never a pick
    await db.update(orders).set({ status: "filled" }).where(eq(orders.id, again.order.id));
    await expect(cancelOrder(again.order.id, bo.id)).rejects.toThrow(/can't be cancelled/);
    await db.delete(orders).where(eq(orders.membershipId, bo.id));
    await db.delete(theses).where(eq(theses.membershipId, bo.id));
  });

  it("keeps an order to the player who placed it", async () => {
    const [mine] = await ordersOf(ana.id);
    expect(await orderOf(mine.order.id, bo.id)).toBeNull();
    expect(await ordersOf(bo.id)).toHaveLength(0);
  });

  it("deletes a player's picks, theses and coach conversations when they leave the club", async () => {
    const talk = await openConversation(ana.id, "pick", "PCK2");
    await coachTurn(talk.id, { membershipId: ana.id, name: "Ana" }, null).catch(() => {}); // no price or filings needed to open
    await makeOrganizer("pick-teach", clubId, bo.id);
    await leaveClub("pick-ana", clubId);
    expect(await db.select().from(orders).where(eq(orders.membershipId, ana.id))).toHaveLength(0);
    expect(await db.select().from(theses).where(eq(theses.membershipId, ana.id))).toHaveLength(0);
    expect(await db.select().from(conversations).where(and(eq(conversations.membershipId, ana.id)))).toHaveLength(0);
    expect(await clubTheses(clubId, bo.id)).toHaveLength(0);
  });
});
