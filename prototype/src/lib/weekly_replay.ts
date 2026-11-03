// Picks the club's replay for the week: one time machine scenario, the same
// for everyone in the club, chosen to run counter to what the club believes.
// Each scenario scores against the club's positions (concentration, sector
// overlap, valuation, index sitters), with a penalty for replays most of the
// club has already had. This is the swap point for the weekly job: in the
// real app it runs before the recap goes out, over the club's holdings and
// each player's replay history, and writes the pick and the reason.
import { MARKET_PE } from '../content'
import { clubReplaysHad, friendHoldings, friends } from '../data/club'
import { findCompany } from '../data/companies'
import { INDEX_TICKER } from './rules'
import type { Pick } from '../state/store'

export type WeeklyReplay = { slug: string; reason: string }

type Position = { who: string; ticker: string; pct: number }

const TECH_LENSES = new Set(['Software', 'Chipmakers'])

export function pickWeeklyReplay(playerName: string, playerPicks: Pick[]): WeeklyReplay {
  // Everyone's positions as a share of their own portfolio, index excluded.
  const positions: Position[] = []
  for (const f of friends) for (const h of friendHoldings[f.id] ?? []) if (h.ticker !== INDEX_TICKER) positions.push({ who: f.name, ticker: h.ticker, pct: h.pct })
  for (const p of playerPicks) positions.push({ who: playerName || 'You', ticker: p.ticker, pct: Math.round((p.amount / 10_000) * 100) })

  const members = friends.length + (playerPicks.length ? 1 : 0)
  const penalty = (slug: string) => 1 - (clubReplaysHad[slug] ?? 0) / Math.max(members, 1)
  const candidates: { slug: string; score: number; reason: string }[] = []

  // Concentration: someone has a lot riding on one company.
  const biggest = [...positions].sort((a, b) => b.pct - a.pct)[0]
  if (biggest && biggest.pct >= 40) {
    const others = positions.filter((p) => p.pct >= 25 && p.who !== biggest.who).length
    candidates.push({
      slug: 'single-big-tech-2022', score: biggest.pct,
      reason: `${biggest.who} has ${biggest.pct}% in one company${others ? `, and ${others} more of you have a pick over 25%` : ''}.`,
    })
  }

  // Correlation: the club's pick money leans on one kind of business.
  const total = positions.reduce((a, p) => a + p.pct, 0)
  const tech = positions.filter((p) => TECH_LENSES.has(findCompany(p.ticker)?.lens ?? '')).reduce((a, p) => a + p.pct, 0)
  const techShare = total ? Math.round((tech / total) * 100) : 0
  if (techShare >= 35) {
    candidates.push({
      slug: 'tech-basket-2022', score: techShare,
      reason: `${techShare}% of the club's pick money is in software and chip companies. Different names, same weather.`,
    })
  }

  // Valuation: theses that lean on growth everyone already expects.
  const pricey = friends.filter((f) => f.weightedPE >= MARKET_PE * 1.5).sort((a, b) => b.weightedPE - a.weightedPE)[0]
  const aiTheses = positions.filter((p) => findCompany(p.ticker)?.ai).length
  if (pricey) {
    candidates.push({
      slug: 'dot-com-valuation-2000', score: Math.round((pricey.weightedPE / MARKET_PE - 1) * 50),
      reason: `${aiTheses} picks across the club ride on AI, and the average P/E of ${pricey.name}'s stocks is ${pricey.weightedPE}, against a typical ${MARKET_PE}. This one is about a company everyone agreed would own the future.`,
    })
  }

  // Peak-cycle: a chipmaker that looks cheap because profits are at a peak.
  const cheapChip = positions.find((p) => {
    const c = findCompany(p.ticker)
    const pe = c && c.earningsB > 0 ? (c.price * c.sharesB) / c.earningsB : null
    return c?.lens === 'Chipmakers' && pe !== null && pe < 10
  })
  if (cheapChip) candidates.push({ slug: 'peak-cycle-chips-2018', score: 70, reason: `${cheapChip.who} owns a chipmaker with a P/E under 10. Cheap, or peak profits?` })

  // Index sitters next to pickers: is picking worth it?
  const sitters = friends.filter((f) => (friendHoldings[f.id] ?? []).every((h) => h.ticker === INDEX_TICKER))
  if (sitters.length && sitters.length < friends.length) {
    candidates.push({
      slug: 'index-vs-picking-decade', score: 30,
      reason: `${sitters.map((s) => s.name).join(' and ')} ${sitters.length === 1 ? 'is' : 'are'} still all in the index while the rest of you pick. Ten years decides who was right.`,
    })
  }

  // Always something to play: the crash is the fallback when nothing else fits.
  candidates.push({ slug: 'covid-crash-2020', score: 10, reason: 'A quiet week on the market is the right time to practice a loud one.' })

  const best = candidates.map((c) => ({ ...c, score: c.score * penalty(c.slug) })).sort((a, b) => b.score - a.score)[0]
  return { slug: best.slug, reason: best.reason }
}
