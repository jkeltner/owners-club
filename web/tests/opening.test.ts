import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { clubs, lots, prices, user } from "@/db/schema";
import { createClub, createInvite, joinClub, updateSettings } from "@/clubs/clubs";
import { boardOf, standing, type BoardDay } from "@/game/board";
import { openLateJoiner, runFills } from "@/game/fills";
import { clubIsOpen, openingDay } from "@/game/ledger";
import { placeBuy } from "@/game/picks";
import { daysOf, portfolioOf } from "@/game/portfolio";
import { DEFAULT_SETTINGS as S } from "@/lib/rules";

// November is Eastern Standard Time: New York is UTC minus 5.
const ny = (date: string, hour: number) => new Date(`${date}T${String(hour + 5).padStart(2, "0")}:00:00Z`);

describe("a club's opening day", () => {
  it("is the next market close unless a later weekday is asked for", () => {
    const sunday = ny("2026-11-15", 12);
    expect(openingDay("", sunday)).toBe("2026-11-16");
    expect(openingDay(undefined, ny("2026-11-16", 10))).toBe("2026-11-16"); // before the close: today
    expect(openingDay(undefined, ny("2026-11-16", 17))).toBe("2026-11-17"); // after it: tomorrow
    expect(openingDay("2026-12-01", sunday)).toBe("2026-12-01");
    expect(openingDay("2026-11-28", sunday)).toBe("2026-11-30"); // a Saturday moves to Monday
    expect(openingDay("2026-11-01", sunday)).toBe("2026-11-16"); // not in the past
    expect(openingDay("2031-01-01", sunday)).toBe("2027-11-17"); // not more than a year out
    expect(openingDay("soon", sunday)).toBe("2026-11-16");
  });

  it("opens in New York's day", () => {
    expect(clubIsOpen("2026-11-16", new Date("2026-11-16T04:00:00Z"))).toBe(false);
    expect(clubIsOpen("2026-11-16", new Date("2026-11-16T06:00:00Z"))).toBe(true);
  });
});

describe("a late joiner's standing", () => {
  const day = (date: string, kept: number, indexKept: number): BoardDay => ({ date, value: kept, kept, indexKept, holdings: [] });
  it("starts a trailing window from the club's index line when they weren't there yet", () => {
    const line = [{ date: "2026-01-05", indexKept: 9950 }, { date: "2026-04-06", indexKept: 10200 }, { date: "2026-07-06", indexKept: 10400 }];
    const late = [day("2026-06-01", 10300, 10300), day("2026-07-06", 10700, 10400)];
    const s = standing(late, "3m", "2026-07-06", line)!;
    expect(s.from).toBe("2026-04-06");
    expect(s.mine).toBeCloseTo((10700 / 10200 - 1) * 100, 6);
    expect(s.market).toBeCloseTo((10400 / 10200 - 1) * 100, 6);
    expect(standing(late, "12m", "2026-07-06", line)).toBeNull(); // the club isn't that old either
  });
});

describe("opening a club", () => {
  let clubId: string;
  let founder: { id: string; clubId: string; plays: boolean };
  const spy = (date: string, close: number) => db.insert(prices).values({ ticker: "SPY", date, close, source: "test" });

  beforeAll(async () => {
    await dbReady;
    for (const n of ["open-ada", "open-ben"]) await db.insert(user).values({ id: n, name: n, email: `${n}@example.test` });
    // Made on Monday the 2nd, to open on Monday the 9th.
    const made = await createClub("open-ada", { name: "Opening Club", displayName: "Ada", plays: true, opensOn: "2026-11-09" }, ny("2026-11-02", 10));
    clubId = made.club.id;
    founder = made.membership;
    await spy("2026-11-02", 480);
  });

  it("takes no orders and opens no portfolio before the day", async () => {
    await expect(made()).resolves.toMatchObject({ opensOn: "2026-11-09" });
    await expect(placeBuy(founder, S, "NOPE", 500, ny("2026-11-06", 10))).rejects.toThrow(/opens on Monday, November 9/);
    await runFills(); // a close exists for the 2nd, but the club isn't open
    expect(await db.$count(lots, eq(lots.membershipId, founder.id))).toBe(0);
  });

  it("lets the organizer move the day until it arrives, and not after", async () => {
    await updateSettings("open-ada", clubId, {}, undefined, "2026-11-10", ny("2026-11-06", 10));
    expect((await made()).opensOn).toBe("2026-11-10");
    await updateSettings("open-ada", clubId, {}, undefined, "2026-11-09", ny("2026-11-06", 10));
    await updateSettings("open-ada", clubId, {}, undefined, "2026-11-20", ny("2026-11-09", 10)); // opening day: too late
    expect((await made()).opensOn).toBe("2026-11-09");
  });

  it("puts the founder's $10,000 in at the opening close", async () => {
    await spy("2026-11-09", 500);
    await runFills();
    const [lot] = await db.select().from(lots).where(eq(lots.membershipId, founder.id));
    expect(lot).toMatchObject({ boughtOn: "2026-11-09", cost: 10000, shares: 20 });
    // The gate is the club's, not the company's: now the refusal is about the company.
    await expect(placeBuy(founder, S, "NOPE", 500, ny("2026-11-09", 10))).rejects.toThrow(/isn't in the game/);
  });

  it("dates a late joiner's $10,000 to the opening close, so both are measured over the same stretch", async () => {
    await spy("2026-11-20", 525);
    await runFills();
    const invite = await createInvite("open-ada", clubId);
    const ben = await joinClub("open-ben", invite.code, { displayName: "Ben" }, ny("2026-11-21", 10));
    expect(await openLateJoiner(ben.id)).toBe(true);
    expect(await openLateJoiner(ben.id)).toBe(false); // once
    const [lot] = await db.select().from(lots).where(eq(lots.membershipId, ben.id));
    expect(lot).toMatchObject({ boughtOn: "2026-11-09", cost: 10000, shares: 20 });
    const [mine, theirs] = await Promise.all([portfolioOf(founder.id, S), portfolioOf(ben.id, S)]);
    expect(theirs).toMatchObject({ total: 10500, taxOwed: 200, kept: mine.kept, index: mine.index });
    // Ben is on the board straight away, level with the index and with Ada.
    expect((await daysOf(ben.id)).map((d) => d.date)).toEqual(["2026-11-20"]);
    const board = await boardOf(clubId);
    expect(board.ranked.map((r) => r.name).sort()).toEqual(["Ada", "Ben"]);
    for (const r of board.ranked) expect(r.standing!.vs).toBeCloseTo(0, 6);
  });

  async function made() {
    const [club] = await db.select().from(clubs).where(eq(clubs.id, clubId));
    return club;
  }
});
