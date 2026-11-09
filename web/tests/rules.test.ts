import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  INDEX_TICKER,
  daysUntilLongTerm,
  daysUntilUnlocked,
  isLocked,
  keepIfSold,
  maxPurchase,
  taxIfSoldToday,
  taxRateFor,
  tradeFee,
  type Lot,
} from "@/lib/rules";

const lot = (over: Partial<Lot>): Lot => ({ ticker: "NVDA", cost: 1000, value: 1000, daysHeld: 0, ...over });

// The defaults in docs/concept.md and CLAUDE.md.
describe("club defaults", () => {
  it("match the concept doc", () => {
    expect(DEFAULT_SETTINGS).toEqual({
      capAtPurchase: 0.25,
      minHoldDays: 91,
      feeRate: 0.005,
      shortTermTaxRate: 0.4,
      longTermTaxRate: 0.2,
      longTermAfterDays: 182,
    });
  });
});

describe("fees and the cap", () => {
  it("charges 0.5% per trade, to the cent", () => {
    expect(tradeFee(1000)).toBe(5);
    expect(tradeFee(333.33)).toBe(1.67);
  });
  it("caps a purchase at 25% of the portfolio, in whole dollars", () => {
    expect(maxPurchase(10_000)).toBe(2500);
    expect(maxPurchase(10_333.99)).toBe(2583);
  });
  it("respects per-club settings", () => {
    expect(tradeFee(1000, { ...DEFAULT_SETTINGS, feeRate: 0.01 })).toBe(10);
    expect(maxPurchase(10_000, { ...DEFAULT_SETTINGS, capAtPurchase: 0.5 })).toBe(5000);
  });
});

describe("the minimum hold", () => {
  it("locks a stock for 91 days", () => {
    expect(isLocked(lot({ daysHeld: 0 }))).toBe(true);
    expect(isLocked(lot({ daysHeld: 90 }))).toBe(true);
    expect(isLocked(lot({ daysHeld: 91 }))).toBe(false);
    expect(daysUntilUnlocked(lot({ daysHeld: 30 }))).toBe(61);
    expect(daysUntilUnlocked(lot({ daysHeld: 200 }))).toBe(0);
  });
  it("never locks the index holding", () => {
    expect(isLocked(lot({ ticker: INDEX_TICKER, daysHeld: 0 }))).toBe(false);
  });
});

describe("taxes", () => {
  it("uses 40% under six months and 20% after", () => {
    expect(taxRateFor(lot({ daysHeld: 181 }))).toBe(0.4);
    expect(taxRateFor(lot({ daysHeld: 182 }))).toBe(0.2);
    expect(daysUntilLongTerm(lot({ daysHeld: 100 }))).toBe(82);
  });
  it("taxes gains in each bucket at its rate", () => {
    const lots = [lot({ value: 1100, daysHeld: 10 }), lot({ value: 1100, daysHeld: 200 })];
    expect(taxIfSoldToday(lots)).toBe(100 * 0.4 + 100 * 0.2);
  });
  it("lets losses offset gains across buckets", () => {
    // Short gain 100, long loss 50: the loss eats half the short gain.
    expect(taxIfSoldToday([lot({ value: 1100, daysHeld: 10 }), lot({ value: 950, daysHeld: 200 })])).toBe(20);
    // Long gain 100, short loss 30.
    expect(taxIfSoldToday([lot({ value: 1100, daysHeld: 200 }), lot({ value: 970, daysHeld: 10 })])).toBe(14);
  });
  it("owes nothing on a net loss", () => {
    expect(taxIfSoldToday([lot({ value: 900, daysHeld: 10 }), lot({ value: 1050, daysHeld: 200 })])).toBe(0);
    expect(taxIfSoldToday([])).toBe(0);
  });
  it("taxes the index holding like any other lot", () => {
    expect(taxIfSoldToday([lot({ ticker: INDEX_TICKER, value: 1100, daysHeld: 10 })])).toBe(40);
  });
});

describe("keepIfSold", () => {
  it("takes the tax off the gain only", () => {
    expect(keepIfSold(lot({ value: 1200 }), 0.4)).toBe(1120);
    expect(keepIfSold(lot({ value: 800 }), 0.4)).toBe(800);
  });
});
