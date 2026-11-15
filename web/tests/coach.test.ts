import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, dbReady } from "@/db";
import { companies, financials, messages, prices, user } from "@/db/schema";
import { createClub } from "@/clubs/clubs";
import { coachTurn, MAX_MESSAGE, openConversation, readConversation } from "@/coach/conversations";
import { classify, coachReply, PRIVATE_SCRIPTS, worthWatching, type CoachCompany, type CoachContext } from "@/coach/script";
import { cardsFor, forgetCompanyCards } from "@/market/read";

const nvidiaLike: CoachCompany = {
  name: "Chipco",
  isAi: true,
  pe: 45.2,
  marketCap: 4.5e12,
  revenueTtm: 300e9,
  netIncomeTtm: 100e9,
  revenueGrowth: 56,
  usualPe: [23, 42],
  kindPlural: "chipmakers",
};
const ctx = (over: Partial<CoachContext> = {}, company: Partial<CoachCompany> = {}): CoachContext => ({
  mode: "pick",
  playerName: "Ana",
  experience: "new",
  marketPe: 24.1,
  turn: 0,
  company: { ...nvidiaLike, ...company },
  ...over,
});
const said = (r: { bubbles: string[] }) => r.bubbles.join(" ");

// Every line the script can say for a pick, across the kinds of company and
// player, so a rule can be checked against all of them at once.
function everyLine(): string[] {
  const out: string[] = [];
  const kinds: Partial<CoachCompany>[] = [
    {},
    { pe: 18, isAi: false },
    { pe: 24 },
    { pe: 312 },
    { pe: null, netIncomeTtm: -9e9 },
    { pe: null, netIncomeTtm: null, revenueTtm: null, revenueGrowth: null, marketCap: null },
    { revenueGrowth: -6, pe: 20 },
  ];
  const answers = ["AI is huge", "I use their stuff", "The stock keeps going up", "Not sure yet", "What does P/E mean?", "Maybe they're wrong", "Lots of growth", "ok"];
  for (const company of kinds)
    for (const experience of ["new", "some", "lots"])
      for (const marketPe of [24.1, null])
        for (const turn of [0, 1, 2, 3]) for (const a of answers) out.push(...coachReply(ctx({ turn, experience, marketPe }, company), turn ? a : null).bubbles);
  return out;
}

describe("the scripted coach", () => {
  it("reads what the player meant", () => {
    expect(classify("AI is huge")).toBe("hype");
    expect(classify("I use their stuff")).toBe("customer");
    expect(classify("The stock keeps going up")).toBe("momentum");
    expect(classify("What does P/E mean?")).toBe("confused");
    expect(classify("Not sure yet")).toBe("unsure");
    expect(classify("People don't see it")).toBe("contrarian");
  });

  it("opens by asking why, never by saying what to buy", () => {
    const r = coachReply(ctx(), null);
    expect(said(r)).toContain("I won't tell you what to buy");
    expect(said(r)).toContain("why Chipco?");
    expect(r.chips).toContain("AI is huge");
    expect(coachReply(ctx({}, { isAi: false }), null).chips).toContain("Everyone knows Chipco");
  });

  it("puts the company's P/E next to a typical company and its own kind", () => {
    const r = coachReply(ctx({ turn: 1 }), "AI is huge");
    expect(said(r)).toContain("about 45 times");
    expect(said(r)).toContain("A typical S&P 500 company is about 24, and chipmakers are usually 23 to 42.");
    expect(said(r)).toContain("priced in");
    expect(r.marks?.map((m) => m.slug)).toContain("already-priced-in");
  });

  it("tells a customer what the company took in and kept, from the numbers on its page", () => {
    const r = coachReply(ctx({ turn: 1 }), "I use their stuff");
    expect(said(r)).toContain("took in $300B from customers over the last 12 months and kept $100B of it as profit");
  });

  it("says 'over 100' above 100 and asks which reason it is, never the figure", () => {
    const r = coachReply(ctx({ turn: 1 }, { pe: 312.4 }), "AI is huge");
    expect(said(r)).toContain("over 100");
    expect(said(r)).not.toContain("312");
    expect(said(r)).toContain("Which do you think it is?");
    expect(r.chips).toContain("Something unusual hit profit");
  });

  it("explains why a company that lost money has no P/E", () => {
    const r = coachReply(ctx({ turn: 1 }, { pe: null, netIncomeTtm: -9e9 }), "ok");
    expect(said(r)).toContain("lost $9.0B over the last 12 months, so it has no P/E");
    const wrap = coachReply(ctx({ turn: 3 }, { pe: null, netIncomeTtm: -9e9 }), "ok");
    expect(said(wrap)).toContain("losing money right now");
  });

  it("doesn't invent a number it doesn't have", () => {
    const blank = { pe: null, netIncomeTtm: null, revenueTtm: null, revenueGrowth: null, marketCap: null };
    for (const turn of [1, 2, 3]) {
      const text = said(coachReply(ctx({ turn, marketPe: null }, blank), "I use their stuff"));
      expect(text).not.toMatch(/null|undefined|NaN|\$0/);
    }
  });

  it("doesn't call a P/E near the market's a lot of growth", () => {
    const near = coachReply(ctx({ turn: 2 }, { pe: 25 }), "Lots of growth");
    expect(said(near)).toContain("about what they expect from a typical company");
    const low = coachReply(ctx({ turn: 2 }, { pe: 12 }), "Lots of growth");
    expect(said(low)).toContain("aren't expecting much growth");
    const high = coachReply(ctx({ turn: 2 }), "Lots of growth");
    expect(said(high)).toContain("already expect a lot of growth");
  });

  it("gives experienced players the math behind 'priced in'", () => {
    const r = coachReply(ctx({ turn: 2, experience: "lots" }), "Lots of growth");
    // 45.2 / 1.56^5 is about 5, lower than a typical 24.
    expect(said(r)).toContain("fall to about 5");
    expect(said(coachReply(ctx({ turn: 2, experience: "new" }), "Lots of growth"))).not.toContain("five years");
  });

  it("ends by naming one thing to watch and handing over to the thesis", () => {
    const r = coachReply(ctx({ turn: 3 }), "New customers");
    expect(r.done).toBe(true);
    expect(said(r)).toContain("It's your call either way.");
    expect(worthWatching(r.bubbles.map((text) => ({ from: "coach" as const, text })))).toContain("buyers may not keep paying 45 times profit");
  });

  it("never recommends: no line says a stock is good or bad, or what to do with it", () => {
    for (const line of everyLine()) {
      expect(line).not.toMatch(/\b(you should|i recommend|i'd buy|i would buy|good (stock|buy|pick|investment)|bad (stock|buy|pick|investment)|great (stock|buy|pick)|don't buy|sell it|overvalued|undervalued|cheap stock|a bargain)\b/i);
      expect(line).not.toMatch(/null|undefined|NaN/);
    }
  });

  it("turns a private company into a picks-and-shovels question", () => {
    const facts = PRIVATE_SCRIPTS.SpaceX;
    const first = coachReply({ mode: "private", playerName: "Ana", marketPe: null, turn: 0, facts }, null);
    expect(said(first)).toContain("which public companies would do well?");
    const second = coachReply({ mode: "private", playerName: "Ana", marketPe: null, turn: 1, facts }, "No idea");
    expect(said(second)).toContain("Hint:");
    expect(second.tickers).toEqual(["LMT", "NOC", "RTX", "BA"]);
    expect(second.done).toBe(true);
  });
});

// One invented company with two years of quarters and a price.
const quarter = (i: number) => {
  // i = 0 is the oldest: 2024 Q4 through 2026 Q3.
  const q = (3 + i) % 4;
  const year = 2024 + Math.floor((3 + i) / 4);
  const starts = ["01-01", "04-01", "07-01", "10-01"];
  const ends = ["03-31", "06-30", "09-30", "12-31"];
  return { period: `CY${year}Q${q + 1}`, periodStart: `${year}-${starts[q]}`, periodEnd: `${year}-${ends[q]}` };
};

describe("coach conversations", () => {
  let membershipId = "";
  let otherId = "";
  const player = () => ({ membershipId, name: "Ana", experience: "new" });

  beforeAll(async () => {
    await dbReady;
    await db.insert(user).values([
      { id: "coach-ana", name: "Ana", email: "coach-ana@example.test" },
      { id: "coach-bo", name: "Bo", email: "coach-bo@example.test" },
    ]);
    membershipId = (await createClub("coach-ana", { name: "Talkers", displayName: "Ana", plays: true })).membership.id;
    otherId = (await createClub("coach-bo", { name: "Others", displayName: "Bo", plays: true })).membership.id;
    await db.insert(companies).values([
      { ticker: "TALK", name: "Talkco, Inc.", cik: 900100, sector: "Information Technology", subIndustry: "Semiconductors", lens: "Chipmakers" },
      { ticker: "LMT", name: "Lockheed Martin", cik: 900101, sector: "Industrials", subIndustry: "Aerospace & Defense", lens: "Aerospace and defense" },
    ]);
    await db.insert(financials).values(
      Array.from({ length: 8 }, (_, i) => ({ cik: 900100, ...quarter(i), revenue: (100 + i * 10) * 1e6, netIncome: (20 + i) * 1e6, epsDiluted: 0.2 + i / 100, sharesOutstanding: 100e6 })),
    );
    await db.insert(prices).values({ ticker: "TALK", date: "2026-11-12", close: 30, source: "test" });
    forgetCompanyCards();
  });

  it("opens with the coach's first lines and saves them", async () => {
    const c = await openConversation(membershipId, "pick", "TALK");
    const turn = await coachTurn(c.id, player(), null);
    expect(turn.log).toHaveLength(2);
    expect(turn.log.every((m) => m.from === "coach")).toBe(true);
    expect(turn.state.chips).toContain("Not sure yet");
    // Asking again with nothing owed changes nothing: a refresh doesn't repeat the opener.
    expect((await coachTurn(c.id, player(), null)).log).toHaveLength(2);
    expect(await db.select().from(messages).where(eq(messages.conversationId, c.id))).toHaveLength(2);
  });

  it("stores each turn and answers from the company's real numbers", async () => {
    const c = await openConversation(membershipId, "pick", "TALK");
    const turn = await coachTurn(c.id, player(), "  I use   their stuff ");
    expect(turn.log[2]).toEqual({ from: "player", text: "I use their stuff" });
    // Trailing four quarters: revenue 140+150+160+170 = $620M, profit 24+25+26+27 = $102M;
    // price 30 × 100M shares = $3.0B, so the P/E is 3,000 / 102 = 29.4.
    expect(turn.log.map((m) => m.text).join(" ")).toContain("took in $620M from customers over the last 12 months and kept $102M of it as profit");
    expect(turn.log.map((m) => m.text).join(" ")).toContain("about 29 times");
  });

  it("picks up where it left off: the same conversation, and a reply still owed gets written", async () => {
    const again = await openConversation(membershipId, "pick", "TALK");
    const before = (await readConversation(again.id, membershipId))!;
    expect(before.log.length).toBeGreaterThan(3);
    // The page was closed after the player's message was saved and before the coach answered.
    await db.insert(messages).values({ conversationId: again.id, seq: before.log.length, from: "player", text: "What does P/E mean?" });
    const resumed = await coachTurn(again.id, player(), null);
    expect(resumed.log[resumed.log.length - 1].from).toBe("coach");
    expect(resumed.log.map((m) => m.text).join(" ")).toContain("lemonade stand");
  });

  it("finishes, then stops taking messages", async () => {
    const c = await openConversation(membershipId, "pick", "TALK");
    const end = await coachTurn(c.id, player(), "New customers");
    expect(end.done).toBe(true);
    const after = await coachTurn(c.id, player(), "one more thing");
    expect(after.log).toHaveLength(end.log.length);
  });

  it("starts over when asked, and keeps long messages short", async () => {
    const fresh = await openConversation(membershipId, "pick", "TALK", true);
    await coachTurn(fresh.id, player(), null);
    const turn = await coachTurn(fresh.id, player(), "x".repeat(2000));
    expect(turn.log[2].text).toHaveLength(MAX_MESSAGE);
    expect((await openConversation(membershipId, "pick", "TALK")).id).toBe(fresh.id);
  });

  it("is private to the player: no one else can read or continue it", async () => {
    const c = await openConversation(membershipId, "pick", "TALK");
    expect(await readConversation(c.id, otherId)).toBeNull();
    await expect(coachTurn(c.id, { membershipId: otherId, name: "Bo" }, "hello")).rejects.toThrow(/isn't yours/);
  });

  it("runs the private-company lesson and points at companies in the game", async () => {
    const c = await openConversation(membershipId, "private", "SpaceX");
    await coachTurn(c.id, player(), null);
    const end = await coachTurn(c.id, player(), "Defense companies");
    expect(end.done).toBe(true);
    expect(end.state.tickers).toContain("LMT");
    // Only current members come back as cards.
    expect((await cardsFor(end.state.tickers!)).map((x) => x.ticker)).toEqual(["LMT"]);
  });
});
