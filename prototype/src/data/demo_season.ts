// "Fast-forward" demo: the player's portfolio five months into a season, so a
// playtester can see the drift chart, after-tax view and sell-now-vs-wait
// screen without waiting five months. Fake numbers.
import { findCompany, peRatio, yearSeries, type Company } from './companies'
import { pathThrough, seedFrom } from '../lib/random'
import { INDEX_TICKER, type Lot } from '../lib/rules'

export const WEEKS = 22

// The pick grows from $2,500 to $4,000 (+60%): earnings up 25%, and investors
// paying 28% more per dollar of earnings (1.25 x 1.28 = 1.60).
export const GAIN_SPLIT = { total: 60, earnings: 25, multiple: 28 }

// The demo uses the player's own pick when it fits the story (profitable, and
// not one of the demo's other holdings); otherwise Nvidia.
export function demoPick(ticker: string | undefined): Company {
  const c = ticker ? findCompany(ticker) : undefined
  if (c && peRatio(c) !== null && c.ticker !== 'COST' && c.ticker !== 'KO') return c
  return findCompany('NVDA')!
}

export function demoLots(pick: Company): (Lot & { name: string; boughtWeeksAgo: number })[] {
  return [
    { ticker: INDEX_TICKER, name: 'S&P 500 index', cost: 5700, value: 6042, daysHeld: 150, boughtWeeksAgo: 22 },
    { ticker: pick.ticker, name: pick.name, cost: 2500, value: 4000, daysHeld: 150, boughtWeeksAgo: 22 },
    { ticker: 'COST', name: 'Costco', cost: 1000, value: 1200, daysHeld: 159, boughtWeeksAgo: 22 },
    { ticker: 'KO', name: 'Coca-Cola', cost: 800, value: 776, daysHeld: 29, boughtWeeksAgo: 4 },
  ]
}

export const DEMO_FEES_PAID = 21.5 // 0.5% of $4,300 of purchases
export const DEMO_TAXES_PAID = 0
export const DEMO_SP500_RETURN = 6 // %, same five months

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// Each holding's P/E today in the demo. The pick's P/E rose from 35 to 44
// while it was held (investors paying more per dollar of earnings).
const PICK_PE_START = 35
export const demoPE = (pick: Company): Record<string, number> => ({ [pick.ticker]: 44, COST: 50, KO: 24, [INDEX_TICKER]: 23 })

// Weekly value of each holding, for the drift chart.
export function driftSeries(pick: Company) {
  const pes = demoPE(pick)
  const pickPE0 = PICK_PE_START
  const pickPE1 = pes[pick.ticker]
  const weeks = Array.from({ length: WEEKS + 1 }, (_, w) => {
    const t = w / WEEKS
    const bump = Math.sin(w * 1.3) * 0.03
    const pickV = 2500 * Math.pow(1.6, t) * (1 + bump * t)
    const costV = lerp(1000, 1200, t) * (1 + Math.sin(w * 0.9) * 0.01)
    const koBought = w >= WEEKS - 4
    const koV = koBought ? lerp(800, 776, (w - (WEEKS - 4)) / 4) : 0
    const indexV = lerp(6500, 6842, t) - (koBought ? 800 : 0)
    const total = pickV + costV + koV + indexV
    const pe =
      (pickV * lerp(pickPE0, pickPE1, t) + costV * pes.COST + koV * pes.KO + indexV * pes[INDEX_TICKER]) / total
    return {
      week: w,
      shares: { [pick.ticker]: pickV / total, COST: costV / total, KO: koV / total, [INDEX_TICKER]: indexV / total },
      weightedPE: pe,
    }
  })
  return weeks
}

// A made-up level for the S&P 500 index, for its price chart.
export const INDEX_LEVEL = 6000

export const YEAR_DAYS = 252 // trading days in a year

// A year of daily prices for one holding, ending today, with the day it was
// bought. Bought today: the company's own year of prices.
export function holdingHistory(ticker: string, cost: number, value: number, daysHeld: number) {
  const now = ticker === INDEX_TICKER ? INDEX_LEVEL : findCompany(ticker)?.price ?? 100
  const seed = seedFrom(`${ticker}-held`)
  const last = YEAR_DAYS - 1
  if (daysHeld === 0) {
    const c = findCompany(ticker)
    const series = c ? yearSeries(c) : pathThrough([[0, now * 0.88], [90, now * 0.93], [170, now * 0.97], [last, now]], seed, 0.006)
    return { series, buyAt: last, buyPrice: now, nowPrice: now }
  }
  const held = Math.min(last - 10, Math.max(5, Math.round((daysHeld * 5) / 7)))
  const buyAt = last - held
  const buyPrice = (now * cost) / value
  const start = buyPrice * (0.9 + ((seed >>> 0) % 12) / 100)
  const mid = buyPrice * (1 + (value / cost - 1) * 0.35)
  const wiggle = ticker === INDEX_TICKER ? 0.006 : 0.012
  const series = pathThrough([[0, start], [Math.round(buyAt / 2), (start + buyPrice) / 2 * 1.02], [buyAt, buyPrice], [buyAt + Math.round(held / 2), mid], [last, now]], seed, wiggle)
  return { series, buyAt, buyPrice, nowPrice: now }
}

// How much each holding pulls the portfolio's average P/E up or down: the
// average with it, minus the average of everything else.
export function peEffects(lots: { ticker: string; value: number }[], pes: Record<string, number>) {
  const total = lots.reduce((a, l) => a + l.value, 0)
  const sum = lots.reduce((a, l) => a + l.value * (pes[l.ticker] ?? 0), 0)
  const avg = sum / total
  return {
    avg,
    rows: lots.map((l) => {
      const without = (sum - l.value * pes[l.ticker]) / (total - l.value)
      return { ticker: l.ticker, pe: pes[l.ticker], share: l.value / total, effect: avg - without }
    }),
  }
}
