// The club's board: each player's return against the S&P 500 over the same
// stretch, with how the return was made beside it. Everything comes from the
// nightly `portfolio_days` rows, so the board can't disagree with a player's
// own portfolio page. Also what a clubmate may see of someone else's holdings:
// the mix at the last close, as shares of the whole.
import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { companies, memberships, portfolioDays, type DayHolding } from "@/db/schema";
import { INDEX_TICKER, STARTING_VALUE } from "@/lib/rules";
import { displayName } from "@/market/names";
import { daysBetween } from "./ledger";
import { INDEX_NAME } from "./portfolio";

/** How far back the board looks. "start" is since the club's opening day, when everyone's $10,000 went into the index. */
export const WINDOWS = ["start", "3m", "6m", "12m"] as const;
export type BoardWindow = (typeof WINDOWS)[number];
const MONTHS: Record<Exclude<BoardWindow, "start">, number> = { "3m": 3, "6m": 6, "12m": 12 };
/** The board the Bell follows. */
export const BELL_WINDOW: BoardWindow = "6m";

export type BoardDay = { date: string; value: number; kept: number; indexKept: number; holdings: DayHolding[] };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const at = (date: string) => new Date(`${date}T12:00:00Z`);

/** The same day of the month, `months` earlier or later (the 31st becomes the month's last day). */
export function shiftMonths(date: string, months: number): string {
  const d = at(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return iso(d);
}

export type Standing = {
  from: string; // the day the stretch is measured from
  mine: number; // percent
  market: number; // percent: the same $10,000 left in the index, over the same stretch
  vs: number; // percentage points ahead of (or behind) the market
};

/**
 * One player's return against the market over a window ending at their latest
 * day. Both sides are "what you'd keep": after tax and the fee to sell. Never
 * annualized. `indexLine` is the club's untouched $10,000, day by day: a
 * player who joined after a window began was the index until then (their
 * money is dated the club's opening day), so the window starts from that
 * line. Null when neither they nor the club go back far enough.
 */
export function standing(days: BoardDay[], window: BoardWindow, asOf: string, indexLine: { date: string; indexKept: number }[] = []): Standing | null {
  const last = days.at(-1);
  if (!last) return null;
  let from: string, mineBase: number, marketBase: number;
  if (window === "start") {
    [from, mineBase, marketBase] = [days[0].date, STARTING_VALUE, STARTING_VALUE];
  } else {
    const start = shiftMonths(asOf, -MONTHS[window]);
    const base = days.filter((d) => d.date <= start).at(-1);
    const before = base ? null : indexLine.filter((d) => d.date <= start).at(-1);
    if (base) [from, mineBase, marketBase] = [base.date, base.kept, base.indexKept];
    else if (before) [from, mineBase, marketBase] = [before.date, before.indexKept, before.indexKept];
    else return null;
  }
  const mine = (last.kept / mineBase - 1) * 100;
  const market = (last.indexKept / marketBase - 1) * 100;
  return { from, mine, market, vs: mine - market };
}

/** How the return was made: how many picks, and how much of the portfolio the biggest one is. */
export function riskOf(day: BoardDay) {
  const picks = day.holdings.filter((h) => h.ticker !== INDEX_TICKER && h.value >= 1);
  return { picks: picks.length, largest: day.value > 0 ? picks.reduce((m, h) => Math.max(m, h.value), 0) / day.value : 0 };
}

export type BoardRow = {
  membershipId: string;
  name: string;
  avatar: string;
  standing: Standing | null; // null: not playing long enough for this window, or no portfolio yet
  started: string | null; // their first day
  daysPlaying: number;
  picks: number;
  largest: number; // 0 to 1
};

export type Board = {
  window: BoardWindow;
  asOf: string | null; // the latest close anyone is valued at
  ranked: BoardRow[]; // best first
  waiting: BoardRow[]; // in the club, but not on this board yet
  open: Record<BoardWindow, boolean>; // which windows have at least one player
  bell: { holder: string | null; firstChance: string | null }; // who leads the 6-month board, or when someone first can
};

async function clubDays(clubId: string) {
  const members = await db
    .select({ id: memberships.id, name: memberships.displayName, avatar: memberships.avatar })
    .from(memberships)
    .where(and(eq(memberships.clubId, clubId), eq(memberships.plays, true)))
    .orderBy(asc(memberships.joinedAt));
  const rows = members.length
    ? await db
        .select()
        .from(portfolioDays)
        .where(and(inArray(portfolioDays.membershipId, members.map((m) => m.id)), isNotNull(portfolioDays.kept), isNotNull(portfolioDays.indexKept)))
        .orderBy(asc(portfolioDays.date))
    : [];
  const byMember = new Map<string, BoardDay[]>(members.map((m) => [m.id, []]));
  for (const r of rows) byMember.get(r.membershipId)!.push({ date: r.date, value: r.value, kept: r.kept!, indexKept: r.indexKept!, holdings: r.holdings });
  return { members, byMember };
}

/**
 * The club's board. Without a window it picks the longest of 6 and 3 months
 * the club has been open, and "since the club opened" before that.
 */
export async function boardOf(clubId: string, asked?: string | null): Promise<Board> {
  const { members, byMember } = await clubDays(clubId);
  const asOf = [...byMember.values()].map((d) => d.at(-1)?.date).filter((d): d is string => !!d).sort().at(-1) ?? null;
  // The untouched $10,000 since opening is the same line for everyone in the club; take each day from whoever has it.
  const line = new Map<string, number>();
  for (const days of byMember.values()) for (const d of days) if (!line.has(d.date)) line.set(d.date, d.indexKept);
  const indexLine = [...line].map(([date, indexKept]) => ({ date, indexKept })).sort((a, b) => a.date.localeCompare(b.date));
  const standings = (w: BoardWindow) => new Map(members.map((m) => [m.id, asOf ? standing(byMember.get(m.id)!, w, asOf, indexLine) : null]));
  const all = Object.fromEntries(WINDOWS.map((w) => [w, standings(w)])) as Record<BoardWindow, Map<string, Standing | null>>;
  const open = Object.fromEntries(WINDOWS.map((w) => [w, [...all[w].values()].some(Boolean)])) as Record<BoardWindow, boolean>;
  const wanted = WINDOWS.find((w) => w === asked);
  const window: BoardWindow = wanted && open[wanted] ? wanted : open["6m"] ? "6m" : open["3m"] ? "3m" : "start";

  const rows: BoardRow[] = members.map((m) => {
    const days = byMember.get(m.id)!;
    const last = days.at(-1);
    return {
      membershipId: m.id,
      name: m.name,
      avatar: m.avatar,
      standing: all[window].get(m.id) ?? null,
      started: days[0]?.date ?? null,
      daysPlaying: last ? daysBetween(days[0].date, last.date) : 0,
      ...(last ? riskOf(last) : { picks: 0, largest: 0 }),
    };
  });
  const byLead = (a: { standing: Standing | null; name: string }, b: { standing: Standing | null; name: string }) => b.standing!.vs - a.standing!.vs || a.name.localeCompare(b.name);
  const bellRows = members.map((m) => ({ id: m.id, name: m.name, standing: all[BELL_WINDOW].get(m.id) ?? null })).filter((r) => r.standing).sort(byLead);
  const firstStart = rows.map((r) => r.started).filter((d): d is string => !!d).sort()[0];
  return {
    window,
    asOf,
    ranked: rows.filter((r) => r.standing).sort(byLead),
    waiting: rows.filter((r) => !r.standing),
    open,
    bell: { holder: bellRows[0]?.id ?? null, firstChance: bellRows.length || !firstStart ? null : shiftMonths(firstStart, MONTHS["6m"]) },
  };
}

export type MixPart = { ticker: string; name: string; isIndex: boolean; share: number; value: number };
export type Mix =
  | { state: "none" } // no portfolio yet
  | { state: "shown"; date: string; total: number; parts: MixPart[] };

/**
 * What a player held at their latest close, as shares of their whole
 * portfolio. The screen decides whether the dollars are shown too.
 */
export async function mixOf(membershipId: string): Promise<Mix> {
  const [day] = await db.select().from(portfolioDays).where(eq(portfolioDays.membershipId, membershipId)).orderBy(desc(portfolioDays.date)).limit(1);
  if (!day) return { state: "none" };
  const tickers = day.holdings.map((h) => h.ticker).filter((t) => t !== INDEX_TICKER);
  const named = tickers.length ? await db.select({ ticker: companies.ticker, name: companies.name }).from(companies).where(inArray(companies.ticker, tickers)) : [];
  const nameOf = new Map(named.map((c) => [c.ticker, c.name]));
  const parts = day.holdings
    .filter((h) => h.value >= 1)
    .map((h) => {
      const isIndex = h.ticker === INDEX_TICKER;
      return { ticker: h.ticker, name: isIndex ? INDEX_NAME : displayName(h.ticker, nameOf.get(h.ticker) ?? h.ticker), isIndex, share: day.value > 0 ? h.value / day.value : 0, value: h.value };
    })
    .sort((a, b) => Number(b.isIndex) - Number(a.isIndex) || b.value - a.value);
  return { state: "shown", date: day.date, total: day.value, parts };
}
