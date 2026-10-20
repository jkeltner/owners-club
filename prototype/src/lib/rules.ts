// Game rules from docs/concept.md. Settings are per club; these are the defaults.

export type GameSettings = {
  capAtPurchase: number
  minHoldDays: number
  feeRate: number
  shortTermTaxRate: number
  longTermTaxRate: number
  longTermAfterDays: number
}

export const DEFAULT_SETTINGS: GameSettings = {
  capAtPurchase: 0.25,
  minHoldDays: 91, // 3 months
  feeRate: 0.005,
  shortTermTaxRate: 0.4,
  longTermTaxRate: 0.2,
  longTermAfterDays: 182, // 6 months
}

export const STARTING_VALUE = 10_000
export const INDEX_TICKER = 'SPX'

export type Lot = {
  ticker: string
  cost: number
  value: number
  daysHeld: number
}

export const tradeFee = (amount: number, s = DEFAULT_SETTINGS) => round2(amount * s.feeRate)

export const maxPurchase = (portfolioValue: number, s = DEFAULT_SETTINGS) =>
  Math.floor(portfolioValue * s.capAtPurchase)

// The index holding is exempt from the minimum hold.
export const isLocked = (lot: Lot, s = DEFAULT_SETTINGS) =>
  lot.ticker !== INDEX_TICKER && lot.daysHeld < s.minHoldDays

export const daysUntilUnlocked = (lot: Lot, s = DEFAULT_SETTINGS) =>
  Math.max(0, s.minHoldDays - lot.daysHeld)

export const daysUntilLongTerm = (lot: Lot, s = DEFAULT_SETTINGS) =>
  Math.max(0, s.longTermAfterDays - lot.daysHeld)

export const taxRateFor = (lot: Lot, s = DEFAULT_SETTINGS) =>
  lot.daysHeld >= s.longTermAfterDays ? s.longTermTaxRate : s.shortTermTaxRate

// Tax owed if every lot were sold today. Losses offset gains: net each bucket,
// then let a net loss in one bucket offset gains in the other.
export function taxIfSoldToday(lots: Lot[], s = DEFAULT_SETTINGS): number {
  let short = 0
  let long = 0
  for (const lot of lots) {
    const gain = lot.value - lot.cost
    if (lot.daysHeld >= s.longTermAfterDays) long += gain
    else short += gain
  }
  if (short < 0) { long += short; short = 0 }
  if (long < 0) { short += long; long = 0 }
  return round2(Math.max(0, short) * s.shortTermTaxRate + Math.max(0, long) * s.longTermTaxRate)
}

// What you keep from selling one lot, before the trade fee.
export const keepIfSold = (lot: Lot, rate: number) =>
  round2(lot.value - Math.max(0, lot.value - lot.cost) * rate)

export const round2 = (n: number) => Math.round(n * 100) / 100
