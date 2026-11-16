// The arithmetic of a trade, with no database in it: when an order fills, which
// lots a sale comes out of, what gain that makes real, the tax on it, and what
// a buy ends up moving. The nightly fill step and the tests share it.
import { round2, tradeFee, type GameSettings } from "@/lib/rules";

// ---- When ----

const DAY = 86_400_000;
const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY);

const NY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" });
/** The date and hour where the market is. */
export function inNewYork(at: Date): { date: string; hour: number } {
  const parts = Object.fromEntries(NY.formatToParts(at).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) };
}

export const CLOSE_HOUR = 16; // 4 pm in New York

/**
 * The first day whose close an order placed at `placedAt` can fill at: that
 * day if the market hadn't closed yet, else the next weekday. Holidays aren't
 * known here; the fill step moves on to the first day that has closes.
 */
export function fillDay(placedAt: Date): string {
  const { date, hour } = inNewYork(placedAt);
  let day = hour < CLOSE_HOUR ? date : addDays(date, 1);
  while (isWeekend(day)) day = addDays(day, 1);
  return day;
}

/**
 * A club's opening day from what the organizer asked for: a weekday, no
 * earlier than the next close and no more than a year out. Nothing asked (or
 * nonsense) means the next close.
 */
export function openingDay(asked: unknown, now = new Date()): string {
  const first = fillDay(now);
  const text = String(asked ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) return first;
  let day = text;
  while (isWeekend(day)) day = addDays(day, 1);
  const last = addDays(first, 366);
  return day < first ? first : day > last ? last : day;
}

/** Whether the club's opening day has come (in New York): from then on orders can be placed. */
export const clubIsOpen = (opensOn: string, now = new Date()) => inNewYork(now).date >= opensOn;

/** Whether the close an order was waiting for has passed: from then on it can't be taken back. */
export function closeHasPassed(placedAt: Date, now = new Date()): boolean {
  const day = fillDay(placedAt);
  const here = inNewYork(now);
  return here.date > day || (here.date === day && here.hour >= CLOSE_HOUR);
}

// ---- Lots ----

export type OpenLot = { id: string; shares: number; cost: number; boughtOn: string };
export type Realized = { short: number; long: number };
export type LotChange = { id: string; shares: number; cost: number }; // what is left of the lot

/**
 * Sells `dollars` worth at `price`, oldest lot first. Returns what is left of
 * each lot it touched and the gain made real, split by whether the lot was
 * held past the long-term line.
 */
export function sellOldestFirst(lots: OpenLot[], dollars: number, price: number, onDate: string, s: GameSettings): { changes: LotChange[]; realized: Realized; proceeds: number } {
  const held = lots.reduce((a, l) => a + l.shares, 0);
  // Selling within a cent of everything sells everything, so no dust is left behind.
  let toSell = Math.abs(held * price - dollars) < 0.01 ? held : Math.min(held, dollars / price);
  const proceeds = round2(toSell * price);
  const realized: Realized = { short: 0, long: 0 };
  const changes: LotChange[] = [];
  for (const lot of [...lots].sort((a, b) => a.boughtOn.localeCompare(b.boughtOn))) {
    if (toSell <= 0) break;
    if (lot.shares <= 0) continue;
    const take = Math.min(lot.shares, toSell);
    const costOut = lot.cost * (take / lot.shares);
    const gain = take * price - costOut;
    if (daysBetween(lot.boughtOn, onDate) >= s.longTermAfterDays) realized.long += gain;
    else realized.short += gain;
    changes.push({ id: lot.id, shares: take === lot.shares ? 0 : lot.shares - take, cost: take === lot.shares ? 0 : lot.cost - costOut });
    toSell -= take;
  }
  return { changes, realized: { short: round2(realized.short), long: round2(realized.long) }, proceeds };
}

// ---- Tax ----

/** Tax on gains made real so far. Losses offset gains: a net loss on one side comes off the other. */
export function taxOnRealized(r: Realized, s: GameSettings): number {
  let { short, long } = r;
  if (short < 0) {
    long += short;
    short = 0;
  }
  if (long < 0) {
    short += long;
    long = 0;
  }
  return round2(Math.max(0, short) * s.shortTermTaxRate + Math.max(0, long) * s.longTermTaxRate);
}

/**
 * The tax a sale adds, given everything made real before it and the tax
 * already paid. Negative when the sale is a loss that offsets gains already
 * taxed: that tax comes back.
 */
export function taxForSale(before: Realized, paid: number, sale: Realized, s: GameSettings): number {
  return round2(taxOnRealized({ short: before.short + sale.short, long: before.long + sale.long }, s) - paid);
}

// ---- A buy ----

export type BuyInput = {
  amount: number; // what the player asked to move
  price: number; // the company's close
  indexPrice: number; // the index fund's close
  indexLots: OpenLot[];
  portfolioValue: number; // everything, at this close
  companyValue: number; // already in this company, at this close
  date: string;
  realizedBefore: Realized;
  taxPaid: number;
  settings: GameSettings;
};

export type BuyPlan =
  | { ok: false; reason: string }
  | {
      ok: true;
      moved: number; // out of the index
      trimmedBy: "cap" | "index" | null;
      fee: number;
      tax: number;
      realized: Realized;
      into: number; // what bought shares: moved, less the fee and the tax
      shares: number;
      indexChanges: LotChange[];
    };

/**
 * Moving money from the index into a company at one close. It is one trade:
 * the fee is charged once, on the amount moved. Selling the index makes its
 * gain real, so the tax on that comes out too. An order for more than the cap
 * or the index allows at this close is trimmed to what fits, not refused.
 */
export function planBuy(b: BuyInput): BuyPlan {
  const s = b.settings;
  const indexValue = round2(b.indexLots.reduce((a, l) => a + l.shares, 0) * b.indexPrice);
  const capRoom = round2(b.portfolioValue * s.capAtPurchase - b.companyValue);
  let moved = round2(b.amount);
  let trimmedBy: "cap" | "index" | null = null;
  if (moved > capRoom) {
    moved = capRoom;
    trimmedBy = "cap";
  }
  if (moved > indexValue) {
    moved = indexValue;
    trimmedBy = "index";
  }
  if (moved < 1) {
    return { ok: false, reason: trimmedBy === "index" || indexValue < 1 ? "There was nothing left in your index fund to move at that close" : "You were already at this club's limit for one company at that close" };
  }
  const sale = sellOldestFirst(b.indexLots, moved, b.indexPrice, b.date, s);
  const fee = tradeFee(moved, s);
  const tax = taxForSale(b.realizedBefore, b.taxPaid, sale.realized, s);
  const into = round2(moved - fee - tax);
  if (into <= 0) return { ok: false, reason: "The fee and tax would have used up the whole amount" };
  return { ok: true, moved, trimmedBy, fee, tax, realized: sale.realized, into, shares: into / b.price, indexChanges: sale.changes };
}

// ---- A sell ----

const addDaysTo = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** The first day a lot can be sold: its purchase day plus the club's minimum hold. */
export const unlockDay = (boughtOn: string, s: GameSettings) => addDaysTo(boughtOn, s.minHoldDays);
/** The first day a lot's gain is taxed at the lower rate. */
export const longTermDay = (boughtOn: string, s: GameSettings) => addDaysTo(boughtOn, s.longTermAfterDays);

/** The lots whose minimum hold is over by `onDate`. */
export const sellableLots = <L extends { boughtOn: string }>(lots: L[], onDate: string, s: GameSettings) => lots.filter((l) => unlockDay(l.boughtOn, s) <= onDate);

/** The lots with `shares` taken off the oldest first: what is left to sell once a waiting sell has its share. */
export function lessShares(lots: OpenLot[], shares: number): OpenLot[] {
  const left: OpenLot[] = [];
  let taken = Math.max(0, shares);
  for (const l of [...lots].sort((a, b) => a.boughtOn.localeCompare(b.boughtOn))) {
    const out = Math.min(l.shares, taken);
    taken -= out;
    if (l.shares - out > 1e-9) left.push({ id: l.id, shares: l.shares - out, cost: l.cost * (1 - out / l.shares), boughtOn: l.boughtOn });
  }
  return left;
}

export type SellInput = {
  shares: number; // what the player asked to sell
  price: number; // the company's close
  indexPrice: number; // the index fund's close
  lots: OpenLot[]; // every open lot of the company
  date: string;
  realizedBefore: Realized;
  taxPaid: number;
  settings: GameSettings;
};

export type SellPlan =
  | { ok: false; reason: string }
  | {
      ok: true;
      shares: number; // sold
      trimmed: boolean; // fewer than asked: the rest was still inside its hold, or already sold
      proceeds: number;
      fee: number;
      tax: number; // negative when tax comes back against a loss
      realized: Realized;
      into: number; // what goes back into the index: proceeds, less the fee and the tax
      indexShares: number;
      changes: LotChange[];
    };

/**
 * Selling shares of a company at one close. The oldest lots go first, and only
 * lots past the club's minimum hold can go. Like a buy it is one trade: the
 * fee is charged once, on what the shares sold for; the tax on the gain comes
 * out too (or comes back, on a loss that offsets gains already taxed), and the
 * rest goes into the index fund.
 */
export function planSell(b: SellInput): SellPlan {
  const s = b.settings;
  const free = sellableLots(b.lots, b.date, s);
  const available = free.reduce((a, l) => a + l.shares, 0);
  if (available <= 0) return { ok: false, reason: b.lots.length ? "These shares were still inside this club's minimum hold at that close" : "You didn't own any of this company at that close" };
  // Asking for all but a sliver sells it all, so no dust is left behind.
  const shares = b.shares >= available - 1e-6 ? available : b.shares;
  if (shares * b.price < 0.01) return { ok: false, reason: "There was nothing to sell at that close" };
  const sale = sellOldestFirst(free, shares * b.price, b.price, b.date, s);
  const fee = tradeFee(sale.proceeds, s);
  const tax = taxForSale(b.realizedBefore, b.taxPaid, sale.realized, s);
  const into = round2(sale.proceeds - fee - tax);
  if (into <= 0) return { ok: false, reason: "The fee and tax would have used up everything the sale brought in" };
  return { ok: true, shares, trimmed: b.shares > available + 1e-6, proceeds: sale.proceeds, fee, tax, realized: sale.realized, into, indexShares: into / b.indexPrice, changes: sale.changes };
}

// ---- If sold today ----

/** Gains not yet made real, split the way a sale on `onDate` would split them. */
export function unrealized(lots: { cost: number; value: number; boughtOn: string }[], onDate: string, s: GameSettings): Realized {
  const r: Realized = { short: 0, long: 0 };
  for (const l of lots) {
    if (longTermDay(l.boughtOn, s) <= onDate) r.long += l.value - l.cost;
    else r.short += l.value - l.cost;
  }
  return { short: round2(r.short), long: round2(r.long) };
}

/**
 * The tax still owed if everything were sold on `onDate`: tax on all gains,
 * real and not yet real, less the tax already paid. Negative when the
 * portfolio is sitting on losses that would bring earlier tax back.
 */
export function taxIfAllSold(lots: { cost: number; value: number; boughtOn: string }[], onDate: string, before: Realized, paid: number, s: GameSettings): number {
  return taxForSale(before, paid, unrealized(lots, onDate, s), s);
}
