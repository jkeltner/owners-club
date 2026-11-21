import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { companies, dividendCredits, lots, memberships, prices, user } from "@/db/schema";
import { createClub } from "@/clubs/clubs";
import { creditDividends, planDividend, setDividendChoice, storeDividends } from "@/game/dividends";
import { runFills } from "@/game/fills";
import { sellableLots } from "@/game/ledger";
import { portfolioOf } from "@/game/portfolio";
import { DEFAULT_SETTINGS as S, INDEX_TICKER } from "@/lib/rules";

const ny = (date: string, hour: number) => new Date(`${date}T${String(hour + 5).padStart(2, "0")}:00:00Z`);
const close = (ticker: string, date: string, c: number) => ({ ticker, date, close: c, source: "test" });
const div = (id: string, ticker: string, exDate: string, cash: number, kind = "CD") => ({ id, ticker, exDate, payDate: null, cash, kind, perYear: 4 });

describe("the arithmetic of a dividend", () => {
  it("pays shares times the dividend, takes the long-term rate, and buys with the rest", () => {
    expect(planDividend(10, 1.5, 100, S)).toEqual({ amount: 15, tax: 3, net: 12, intoShares: 0.12 });
  });
});

describe("crediting dividends", () => {
  let pat: { id: string };
  let quinn: { id: string };

  beforeAll(async () => {
    await dbReady;
    await db.insert(user).values([
      { id: "div-pat", name: "div-pat", email: "div-pat@example.test" },
      { id: "div-quinn", name: "div-quinn", email: "div-quinn@example.test" },
    ]);
    pat = (await createClub("div-pat", { name: "Dividend Club", displayName: "Pat", plays: true }, ny("2026-12-01", 10))).membership;
    quinn = (await createClub("div-quinn", { name: "Index Only Club", displayName: "Quinn", plays: true }, ny("2026-12-01", 10))).membership;
    await db.update(memberships).set({ joinedAt: ny("2026-12-01", 10) }).where(eq(memberships.id, pat.id));
    await db.insert(companies).values([
      { ticker: "DVA1", name: "Payco", cik: 900400, sector: "Consumer Staples", subIndustry: "Food Retail" },
      { ticker: "DVA2", name: "Payco Two", cik: 900401, sector: "Utilities", subIndustry: "Electric Utilities" },
    ]);
    await db.insert(prices).values([close("SPY", "2026-12-01", 500), close("DVA1", "2026-12-01", 100), close("DVA2", "2026-12-01", 50)]);
    expect(await runFills()).toMatchObject({ opened: 2 });
    // Pat owns 10 shares of each company, bought Dec 1 (as if a pick had filled).
    await db.insert(lots).values([
      { membershipId: pat.id, ticker: "DVA1", shares: 10, cost: 1000, boughtOn: "2026-12-01" },
      { membershipId: pat.id, ticker: "DVA2", shares: 10, cost: 500, boughtOn: "2026-12-01" },
    ]);
  });

  it("keeps only dividends for companies in the game and the index fund", async () => {
    expect(await storeDividends([div("d1", "DVA1", "2026-12-02", 1.5), div("d2", "DVA2", "2026-12-02", 0.5), div("dx", "NOTINGAME", "2026-12-02", 9)])).toBe(2);
  });

  it("waits for the ex-date's close", async () => {
    expect(await creditDividends()).toEqual({ credited: 0, waitingForAClose: 0 }); // the latest close is before the ex-date
  });

  it("credits shares held before the ex-date: taxed at the long-term rate, the rest where the player chose", async () => {
    await setDividendChoice(pat.id, "DVA2", "reinvest");
    await db.insert(prices).values([close("SPY", "2026-12-02", 400), close("DVA1", "2026-12-02", 98.5), close("DVA2", "2026-12-02", 40)]);
    expect(await creditDividends()).toEqual({ credited: 2, waitingForAClose: 0 });
    const credits = await db.select().from(dividendCredits).where(eq(dividendCredits.membershipId, pat.id));
    expect(credits.find((c) => c.ticker === "DVA1")).toMatchObject({ shares: 10, perShare: 1.5, amount: 15, tax: 3, into: "index", intoPrice: 400 });
    expect(credits.find((c) => c.ticker === "DVA2")).toMatchObject({ amount: 5, tax: 1, into: "reinvest", intoPrice: 40, intoShares: 0.1 });
    const intoIndex = await db.select().from(lots).where(and(eq(lots.membershipId, pat.id), eq(lots.ticker, INDEX_TICKER), eq(lots.boughtOn, "2026-12-02")));
    expect(intoIndex).toHaveLength(1);
    expect(intoIndex[0]).toMatchObject({ cost: 12, shares: 0.03 });
    // Running it again changes nothing.
    expect(await creditDividends()).toEqual({ credited: 0, waitingForAClose: 0 });
  });

  it("doesn't pay shares bought on the ex-date", async () => {
    await db.insert(lots).values({ membershipId: pat.id, ticker: "DVA1", shares: 5, cost: 492.5, boughtOn: "2026-12-02" });
    await storeDividends([div("d3", "DVA1", "2026-12-03", 1)]);
    await db.insert(prices).values([close("SPY", "2026-12-03", 400), close("DVA1", "2026-12-03", 98), close("DVA2", "2026-12-03", 40)]);
    await creditDividends();
    const [c] = await db.select().from(dividendCredits).where(and(eq(dividendCredits.membershipId, pat.id), eq(dividendCredits.dividendId, "d3")));
    expect(c.shares).toBe(15); // the 5 bought Dec 2 were held before Dec 3; this checks the boundary the other way
    await storeDividends([div("d4", "DVA1", "2026-12-02", 0.25, "SC")]); // same ex-date as the Dec 2 purchase
    await creditDividends();
    const [c4] = await db.select().from(dividendCredits).where(and(eq(dividendCredits.membershipId, pat.id), eq(dividendCredits.dividendId, "d4")));
    expect(c4.shares).toBe(10);
  });

  it("never holds back shares a dividend bought, whatever the club's wait", async () => {
    const reinvested = await db.select().from(lots).where(and(eq(lots.membershipId, pat.id), eq(lots.ticker, "DVA2")));
    const free = sellableLots(reinvested, "2026-12-03", S);
    expect(free).toHaveLength(1);
    expect(free[0].creditId).not.toBeNull();
  });

  it("gives the untouched index the same dividends, so a player who never moves stays even", async () => {
    await storeDividends([div("spy1", "SPY", "2026-12-03", 2)]);
    await creditDividends();
    const p = await portfolioOf(quinn.id, S, { date: "2026-12-03" });
    expect(p.holdings).toHaveLength(1);
    expect(p.holdings[0].lots).toHaveLength(2); // the starting money and the dividend
    expect(p.index).not.toBeNull();
    expect(p.kept).toBe(p.index!.kept);
    expect(p.index!.value).toBeGreaterThan(8000); // 20 shares at 400, plus the dividend put back in
    expect(p.dividendTax).toBe(8); // 20 shares × $2 = $40, 20%
    expect(p.taxesPaid).toBe(8);
  });
});
