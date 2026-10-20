// Fake but plausible company numbers for the prototype. NOT real data.
// Money figures are in billions; revenue and earnings are the last 12 months.
import { pathThrough, seedFrom } from '../lib/random'

export type Company = {
  ticker: string
  name: string
  oneLiner: string
  lens: string // matches a `kind` in content/sector_lenses.yaml
  price: number
  priceYearAgo: number
  sharesB: number
  revenueB: number
  earningsB: number
  revenueGrowth: number // % vs. a year ago
  fcfMargin: number // free cash flow as % of revenue
  grossMargin: number
  daysToEarnings: number
  ai?: boolean
}

export const companies: Company[] = [
  { ticker: 'NVDA', name: 'Nvidia', oneLiner: 'Makes the chips that power AI', lens: 'Chipmakers', price: 182, priceYearAgo: 128, sharesB: 24.3, revenueB: 187, earningsB: 99, revenueGrowth: 56, fcfMargin: 45, grossMargin: 72, daysToEarnings: 23, ai: true },
  { ticker: 'MSFT', name: 'Microsoft', oneLiner: 'Windows, Xbox, and the cloud behind ChatGPT', lens: 'Software', price: 515, priceYearAgo: 420, sharesB: 7.43, revenueB: 293, earningsB: 104, revenueGrowth: 15, fcfMargin: 25, grossMargin: 69, daysToEarnings: 9, ai: true },
  { ticker: 'GOOGL', name: 'Alphabet (Google)', oneLiner: 'Google search, YouTube, and Gemini AI', lens: 'Software', price: 245, priceYearAgo: 165, sharesB: 12.1, revenueB: 385, earningsB: 115, revenueGrowth: 13, fcfMargin: 19, grossMargin: 59, daysToEarnings: 10, ai: true },
  { ticker: 'META', name: 'Meta', oneLiner: 'Instagram, WhatsApp, Facebook and Meta AI', lens: 'Software', price: 720, priceYearAgo: 590, sharesB: 2.52, revenueB: 190, earningsB: 70, revenueGrowth: 21, fcfMargin: 25, grossMargin: 82, daysToEarnings: 9, ai: true },
  { ticker: 'AMD', name: 'AMD', oneLiner: 'Chips for gaming PCs, consoles and AI', lens: 'Chipmakers', price: 165, priceYearAgo: 150, sharesB: 1.62, revenueB: 32, earningsB: 3.1, revenueGrowth: 28, fcfMargin: 14, grossMargin: 52, daysToEarnings: 15, ai: true },
  { ticker: 'AVGO', name: 'Broadcom', oneLiner: 'Custom AI chips and networking gear', lens: 'Chipmakers', price: 340, priceYearAgo: 180, sharesB: 4.7, revenueB: 60, earningsB: 23, revenueGrowth: 22, fcfMargin: 42, grossMargin: 77, daysToEarnings: 46, ai: true },
  { ticker: 'LMT', name: 'Lockheed Martin', oneLiner: 'Fighter jets, missiles and spacecraft', lens: 'Aerospace and defense', price: 480, priceYearAgo: 560, sharesB: 0.235, revenueB: 73, earningsB: 5.4, revenueGrowth: 4, fcfMargin: 8, grossMargin: 11, daysToEarnings: 2 },
  { ticker: 'NOC', name: 'Northrop Grumman', oneLiner: 'Stealth bombers, satellites and the James Webb telescope', lens: 'Aerospace and defense', price: 570, priceYearAgo: 510, sharesB: 0.144, revenueB: 41, earningsB: 3.9, revenueGrowth: 3, fcfMargin: 7, grossMargin: 20, daysToEarnings: 3 },
  { ticker: 'RTX', name: 'RTX', oneLiner: 'Jet engines and defense systems', lens: 'Aerospace and defense', price: 158, priceYearAgo: 122, sharesB: 1.34, revenueB: 84, earningsB: 6.2, revenueGrowth: 9, fcfMargin: 6, grossMargin: 20, daysToEarnings: 2 },
  { ticker: 'BA', name: 'Boeing', oneLiner: 'Passenger planes, plus rockets and space capsules', lens: 'Aerospace and defense', price: 215, priceYearAgo: 160, sharesB: 0.76, revenueB: 78, earningsB: -9, revenueGrowth: 12, fcfMargin: -6, grossMargin: 4, daysToEarnings: 8 },
  { ticker: 'NKE', name: 'Nike', oneLiner: 'Sneakers, jerseys and sports gear', lens: 'Consumer brands', price: 72, priceYearAgo: 80, sharesB: 1.48, revenueB: 46, earningsB: 3.0, revenueGrowth: -6, fcfMargin: 7, grossMargin: 42, daysToEarnings: 64 },
  { ticker: 'EA', name: 'Electronic Arts', oneLiner: 'EA Sports FC, Madden and The Sims', lens: 'Media and streaming', price: 168, priceYearAgo: 150, sharesB: 0.25, revenueB: 7.5, earningsB: 1.1, revenueGrowth: 3, fcfMargin: 28, grossMargin: 79, daysToEarnings: 9 },
  { ticker: 'DIS', name: 'Disney', oneLiner: 'Marvel, Pixar, Disney+ and theme parks', lens: 'Media and streaming', price: 112, priceYearAgo: 98, sharesB: 1.8, revenueB: 94, earningsB: 10, revenueGrowth: 4, fcfMargin: 10, grossMargin: 37, daysToEarnings: 24 },
  { ticker: 'MCD', name: "McDonald's", oneLiner: 'Burgers and fries in 100+ countries', lens: 'Retailers and restaurants', price: 302, priceYearAgo: 295, sharesB: 0.715, revenueB: 26, earningsB: 8.3, revenueGrowth: 3, fcfMargin: 27, grossMargin: 57, daysToEarnings: 16 },
  { ticker: 'CMG', name: 'Chipotle', oneLiner: 'Burritos and bowls', lens: 'Retailers and restaurants', price: 42, priceYearAgo: 58, sharesB: 1.34, revenueB: 11.6, earningsB: 1.6, revenueGrowth: 7, fcfMargin: 13, grossMargin: 26, daysToEarnings: 3 },
  { ticker: 'KO', name: 'Coca-Cola', oneLiner: 'Coke, Sprite, and 200 other drink brands', lens: 'Consumer brands', price: 69, priceYearAgo: 70, sharesB: 4.3, revenueB: 47, earningsB: 12.5, revenueGrowth: 3, fcfMargin: 18, grossMargin: 61, daysToEarnings: 2 },
  { ticker: 'AAPL', name: 'Apple', oneLiner: 'iPhone, Mac, AirPods and the App Store', lens: 'Consumer brands', price: 250, priceYearAgo: 232, sharesB: 14.8, revenueB: 410, earningsB: 112, revenueGrowth: 6, fcfMargin: 24, grossMargin: 47, daysToEarnings: 11 },
  { ticker: 'AMZN', name: 'Amazon', oneLiner: 'Online shopping, Prime Video and the AWS cloud', lens: 'Retailers and restaurants', price: 220, priceYearAgo: 188, sharesB: 10.7, revenueB: 690, earningsB: 70, revenueGrowth: 11, fcfMargin: 3, grossMargin: 50, daysToEarnings: 11 },
  { ticker: 'COST', name: 'Costco', oneLiner: 'Warehouse stores with paid memberships', lens: 'Retailers and restaurants', price: 920, priceYearAgo: 890, sharesB: 0.443, revenueB: 275, earningsB: 8.1, revenueGrowth: 8, fcfMargin: 3, grossMargin: 13, daysToEarnings: 51 },
  { ticker: 'NFLX', name: 'Netflix', oneLiner: 'Streaming shows, movies and live sports', lens: 'Media and streaming', price: 1180, priceYearAgo: 760, sharesB: 0.425, revenueB: 44, earningsB: 10.5, revenueGrowth: 16, fcfMargin: 20, grossMargin: 48, daysToEarnings: 86 },
  { ticker: 'TGT', name: 'Target', oneLiner: 'Big-box stores for almost everything', lens: 'Retailers and restaurants', price: 95, priceYearAgo: 150, sharesB: 0.455, revenueB: 106, earningsB: 3.8, revenueGrowth: -2, fcfMargin: 3, grossMargin: 28, daysToEarnings: 30 },
]

// The four companies the profit-margins lesson asks players to sort.
export const SORT_TICKERS = ['AAPL', 'COST', 'NVDA', 'NKE']

export const findCompany = (ticker: string) => companies.find((c) => c.ticker === ticker)

export const marketCapB = (c: Company) => c.price * c.sharesB
export const eps = (c: Company) => c.earningsB / c.sharesB
// null when there are no earnings: P/E doesn't apply.
export const peRatio = (c: Company) => (c.earningsB > 0 ? marketCapB(c) / c.earningsB : null)
export const netMargin = (c: Company) => (c.earningsB / c.revenueB) * 100
export const yearReturn = (c: Company) => (c.price / c.priceYearAgo - 1) * 100
export const fcfB = (c: Company) => (c.revenueB * c.fcfMargin) / 100

// 252 trading days ending at today's price, with a couple of made-up bumps.
const cache = new Map<string, number[]>()
export function yearSeries(c: Company): number[] {
  const hit = cache.get(c.ticker)
  if (hit) return hit
  const seed = seedFrom(c.ticker)
  const mid1 = c.priceYearAgo * (0.92 + ((seed >>> 3) % 20) / 100)
  const mid2 = c.price * (0.9 + ((seed >>> 7) % 18) / 100)
  const series = pathThrough(
    [[0, c.priceYearAgo], [80, mid1], [170, mid2], [251, c.price]],
    seed,
    0.011,
  )
  cache.set(c.ticker, series)
  return series
}

// Search: by ticker or name, forgiving about case and punctuation.
export function searchCompanies(q: string): Company[] {
  const n = norm(q)
  if (!n) return []
  return companies.filter((c) => norm(c.ticker).startsWith(n) || norm(c.name).includes(n))
}
export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
