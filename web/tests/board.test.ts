import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady } from "@/db";
import { portfolioDays, user } from "@/db/schema";
import { createClub, createInvite, joinClub } from "@/clubs/clubs";
import { boardOf, mixOf, riskOf, shiftMonths, standing, type BoardDay } from "@/game/board";

const day = (date: string, kept: number, indexKept: number, picks: Record<string, number> = {}): BoardDay => {
  const inPicks = Object.values(picks).reduce((a, v) => a + v, 0);
  const value = kept + 100; // the tax and fee that would come out; the board never reads it apart from the mix
  return { date, value, kept, indexKept, holdings: [{ ticker: "SPX", value: value - inPicks }, ...Object.entries(picks).map(([ticker, v]) => ({ ticker, value: v }))] };
};

describe("a player's standing", () => {
  const days = [day("2026-01-05", 9950, 9950), day("2026-04-06", 10500, 10200), day("2026-07-06", 11000, 10400)];

  it("measures from the first $10,000 when the window is since the start", () => {
    const s = standing(days, "start", "2026-07-06")!;
    expect(s.from).toBe("2026-01-05");
    expect(s.mine).toBeCloseTo(10, 6);
    expect(s.market).toBeCloseTo(4, 6);
    expect(s.vs).toBeCloseTo(6, 6);
  });

  it("measures a trailing window from the last day on or before its start, on both sides", () => {
    const s = standing(days, "3m", "2026-07-06")!;
    expect(s.from).toBe("2026-04-06");
    expect(s.mine).toBeCloseTo((11000 / 10500 - 1) * 100, 6);
    expect(s.market).toBeCloseTo((10400 / 10200 - 1) * 100, 6);
    expect(standing(days, "6m", "2026-07-06")?.from).toBe("2026-01-05");
  });

  it("leaves a player off a window they haven't played the whole of", () => {
    expect(standing(days, "12m", "2026-07-06")).toBeNull();
    expect(standing(days.slice(1), "6m", "2026-07-06")).toBeNull();
    expect(standing([], "start", "2026-07-06")).toBeNull();
  });

  it("counts picks and the biggest one, leaving the index out", () => {
    expect(riskOf(day("2026-07-06", 9900, 9950, { AAA: 2500, BBB: 500 }))).toEqual({ picks: 2, largest: 0.25 });
    expect(riskOf(day("2026-07-06", 9900, 9950))).toEqual({ picks: 0, largest: 0 });
  });

  it("moves by calendar months without spilling into the next one", () => {
    expect(shiftMonths("2026-05-31", -3)).toBe("2026-02-28");
    expect(shiftMonths("2026-01-05", 6)).toBe("2026-07-05");
  });
});

describe("the club's board", () => {
  let clubId: string;
  const ids: Record<string, string> = {};
  const rows = (membershipId: string, days: BoardDay[]) =>
    db.insert(portfolioDays).values(days.map((d) => ({ membershipId, date: d.date, value: d.value, taxOwed: 0, afterTax: d.kept, indexAfterTax: d.indexKept, kept: d.kept, indexKept: d.indexKept, holdings: d.holdings })));

  beforeAll(async () => {
    await dbReady;
    for (const n of ["bo-ada", "bo-ben", "bo-cy", "bo-dot"]) await db.insert(user).values({ id: n, name: n, email: `${n}@example.test` });
    const made = await createClub("bo-ada", { name: "Board Club", displayName: "Ada", plays: true });
    clubId = made.club.id;
    ids.ada = made.membership.id;
    const invite = await createInvite("bo-ada", clubId);
    ids.ben = (await joinClub("bo-ben", invite.code, { displayName: "Ben" })).id;
    ids.cy = (await joinClub("bo-cy", invite.code, { displayName: "Cy" })).id;
    ids.dot = (await joinClub("bo-dot", invite.code, { displayName: "Dot" })).id;
  });

  it("is empty until a portfolio has opened", async () => {
    expect(await boardOf(clubId)).toMatchObject({ asOf: null, window: "start", ranked: [], bell: { holder: null, firstChance: null } });
  });

  it("ranks everyone since their own start while nobody has three months", async () => {
    await rows(ids.ada, [day("2026-11-16", 9950, 9950), day("2026-11-20", 10150, 10050, { AAA: 2500 })]);
    await rows(ids.ben, [day("2026-11-18", 9950, 9950), day("2026-11-20", 9900, 9980, { BBB: 5000, CCC: 1000 })]);
    await rows(ids.cy, [day("2026-11-20", 9950, 9950)]);
    const b = await boardOf(clubId, "6m"); // asked for a window nobody has: falls back
    expect(b).toMatchObject({ window: "start", asOf: "2026-11-20", open: { start: true, "3m": false, "6m": false, "12m": false } });
    expect(b.ranked.map((r) => r.name)).toEqual(["Ada", "Cy", "Ben"]);
    expect(b.ranked[0]).toMatchObject({ picks: 1, daysPlaying: 4, started: "2026-11-16" });
    expect(b.ranked[0].standing!.vs).toBeCloseTo(1, 6);
    expect(b.ranked[0].largest).toBeCloseTo(2500 / 10250, 6);
    expect(b.ranked[1].standing!.vs).toBeCloseTo(0, 6);
    expect(b.ranked[2]).toMatchObject({ picks: 2 });
    expect(b.waiting.map((r) => r.name)).toEqual(["Dot"]);
    expect(b.bell).toEqual({ holder: null, firstChance: "2027-05-16" });
  });

  it("opens the 6-month board, and hands the Bell to its leader, once someone has played that long", async () => {
    await rows(ids.ada, [day("2027-05-20", 10400, 10600)]);
    await rows(ids.ben, [day("2027-05-20", 11200, 10600, { BBB: 6000 })]);
    await rows(ids.cy, [day("2027-05-20", 10300, 10500)]);
    const b = await boardOf(clubId);
    expect(b).toMatchObject({ window: "6m", asOf: "2027-05-20", open: { "3m": true, "6m": true, "12m": false } });
    // Ada and Ben are measured from November 20; Cy has that day too.
    expect(b.ranked.map((r) => r.name)).toEqual(["Ben", "Cy", "Ada"]);
    expect(b.ranked[0].standing!.from).toBe("2026-11-20");
    expect(b.bell).toEqual({ holder: ids.ben, firstChance: null });
    expect((await boardOf(clubId, "start")).window).toBe("start");
  });

  it("shows a clubmate's mix a week late, and an organizer's view up to date", async () => {
    expect(await mixOf(ids.dot, { late: true, today: "2026-11-21" })).toEqual({ state: "none" });
    expect(await mixOf(ids.ben, { late: true, today: "2026-11-21" })).toEqual({ state: "soon", showsOn: "2026-11-25" });
    const late = await mixOf(ids.ben, { late: true, today: "2026-11-26" });
    expect(late).toMatchObject({ state: "shown", date: "2026-11-18" }); // not the 20th, which is only six days old
    if (late.state === "shown") expect(late.parts.map((p) => p.ticker)).toEqual(["SPX"]);
    const live = await mixOf(ids.ben, { late: false, today: "2026-11-21" });
    expect(live).toMatchObject({ state: "shown", date: "2027-05-20" });
    if (live.state === "shown") {
      expect(live.parts.map((p) => p.ticker)).toEqual(["SPX", "BBB"]);
      expect(live.parts[1].share).toBeCloseTo(6000 / 11300, 6);
    }
  });
});
