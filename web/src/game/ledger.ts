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
