// The numbers behind each sector lens's "what matters" panel, so every metric
// the panel names is one the player can actually see. Values line up with the
// lens's [look_first, ...then] in content/sector_lenses.yaml. Fake numbers;
// the ones not computed from the company record are made up per company.
import { fcfB, netMargin, type Company } from './companies'
import { bigUsd } from '../lib/format'

export type LensValue = { value: string; sub?: string }

const cents = (pct: number) => `${Math.round(pct)}¢ of each $1 of sales`

const fcf = (c: Company): LensValue =>
  c.fcfMargin < 0
    ? { value: bigUsd(fcfB(c)), sub: 'more cash went out than came in' }
    : { value: bigUsd(fcfB(c)), sub: cents(c.fcfMargin) }

const gross = (c: Company): LensValue => ({ value: `${c.grossMargin}%`, sub: cents(c.grossMargin) })

// Made-up per-company numbers for metrics the company record doesn't hold.
const EXTRA: Record<string, Record<string, LensValue>> = {
  MSFT: { retention: { value: 'About 95%', sub: 'of business customers renew' } },
  GOOGL: { retention: { value: 'About 90%', sub: 'of advertisers stay each year' } },
  META: { retention: { value: '3.4B', sub: 'people use its apps every day, up 6%' } },
  NVDA: { roic: { value: '75%', sub: 'profit a year per $1 invested' } },
  AMD: { roic: { value: '6%', sub: 'profit a year per $1 invested' } },
  AVGO: { roic: { value: '22%', sub: 'profit a year per $1 invested' } },
  MCD: { sss: { value: '+2%' }, opm: { value: '45%' }, inventory: { value: 'Tiny', sub: 'restaurants keep little food on hand' } },
  CMG: { sss: { value: '−1%' }, opm: { value: '17%' }, inventory: { value: 'Tiny', sub: 'restaurants keep little food on hand' } },
  AMZN: { sss: { value: '+6%', sub: 'online store sales' }, opm: { value: '11%' }, inventory: { value: '+5%', sub: 'vs. sales up 11%' } },
  COST: { sss: { value: '+6%' }, opm: { value: '3.8%' }, inventory: { value: '+3%', sub: 'vs. sales up 8%' } },
  TGT: { sss: { value: '−3%' }, opm: { value: '5%' }, inventory: { value: '+2%', sub: 'vs. sales down 2%' } },
  NKE: { organic: { value: '−6%' } },
  KO: { organic: { value: '+5%' } },
  AAPL: { organic: { value: '+6%' } },
  NFLX: { subs: { value: '+8% subscribers', sub: 'about 2% cancel each month' } },
  DIS: { subs: { value: '+3% on Disney+', sub: 'about 4% cancel each month' } },
  EA: { subs: { value: '+2% EA Play members', sub: 'about 5% cancel each month' } },
  LMT: { backlog: { value: '$166B', sub: 'about 2.3 years of sales' }, roic: { value: '18%', sub: 'profit a year per $1 invested' } },
  NOC: { backlog: { value: '$90B', sub: 'about 2.2 years of sales' }, roic: { value: '11%', sub: 'profit a year per $1 invested' } },
  RTX: { backlog: { value: '$236B', sub: 'about 2.8 years of sales' }, roic: { value: '7%', sub: 'profit a year per $1 invested' } },
  BA: { backlog: { value: '$600B', sub: 'mostly planes, about 7.7 years of sales' }, roic: { value: 'Negative', sub: 'losing money right now' } },
}

const extra = (c: Company, key: string): LensValue => EXTRA[c.ticker]?.[key] ?? { value: 'n/a' }

const BY_LENS: Record<string, (c: Company) => LensValue[]> = {
  Software: (c) => [
    { value: String(c.revenueGrowth + c.fcfMargin), sub: `${c.revenueGrowth}% growth + ${c.fcfMargin}% free-cash margin` },
    gross(c),
    extra(c, 'retention'),
  ],
  Chipmakers: (c) => [{ ...fcf(c), sub: `${cents(c.fcfMargin)} this year; check the bad years too` }, gross(c), extra(c, 'roic')],
  'Retailers and restaurants': (c) => [extra(c, 'sss'), extra(c, 'opm'), extra(c, 'inventory')],
  'Consumer brands': (c) => [
    extra(c, 'organic'),
    { value: `${netMargin(c).toFixed(0)}%`, sub: 'profit from each $1 of sales' },
    { value: `${Math.round((fcfB(c) / c.earningsB) * 100)}%`, sub: 'of profit showed up as cash' },
  ],
  'Media and streaming': (c) => [fcf(c), extra(c, 'subs')],
  'Aerospace and defense': (c) => [extra(c, 'backlog'), fcf(c), extra(c, 'roic')],
}

export function lensValues(c: Company): LensValue[] {
  return BY_LENS[c.lens]?.(c) ?? []
}
