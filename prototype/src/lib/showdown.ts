// Earnings showdowns: before a clubmate's company reports, the club votes on
// whether their prediction holds or breaks. Derived from the club's theses and
// each company's earnings countdown, so a showdown exists exactly when a
// thesis is about to be checked. Rules (concept doc, "Staying engaged"):
// votes hide until the report, you can't vote on your own call, voting closes
// at the last close before the report, and votes never count toward rank.
import { friendTheses, showdownResults, showdownVotesIn, type Thesis } from '../data/club'
import { findCompany } from '../data/companies'
import type { Pick, Scout } from '../state/store'

export const SHOWDOWN_WINDOW_DAYS = 7

export type Showdown = {
  thesis: Thesis
  daysToReport: number
  votesIn: number
}

// A player's own call that's about to be checked: shown, never voted on by them.
export type OwnCall = { ticker: string; companyName: string; prediction: string; daysToReport: number; scouting: boolean }

export function upcomingShowdowns(): Showdown[] {
  return friendTheses
    .map((t) => ({ thesis: t, daysToReport: findCompany(t.ticker)?.daysToEarnings ?? 999, votesIn: showdownVotesIn[t.id] ?? 0 }))
    .filter((s) => s.daysToReport <= SHOWDOWN_WINDOW_DAYS && !showdownResults.some((r) => r.thesisId === s.thesis.id))
    .sort((a, b) => a.daysToReport - b.daysToReport)
}

export function ownCalls(picks: Pick[], scouts: Scout[]): OwnCall[] {
  const fmt = (p: Pick['prediction']) => `${p.label}: ${p.unit === '$' ? `$${p.value.toFixed(2)}` : `${p.value}%`} or more`
  const all: OwnCall[] = [
    ...picks.map((p) => ({ ticker: p.ticker, companyName: findCompany(p.ticker)?.name ?? p.ticker, prediction: fmt(p.prediction), daysToReport: findCompany(p.ticker)?.daysToEarnings ?? 999, scouting: false })),
    ...scouts.map((s) => ({ ticker: s.ticker, companyName: findCompany(s.ticker)?.name ?? s.ticker, prediction: fmt(s.prediction), daysToReport: findCompany(s.ticker)?.daysToEarnings ?? 999, scouting: true })),
  ]
  return all.filter((c) => c.daysToReport <= SHOWDOWN_WINDOW_DAYS).sort((a, b) => a.daysToReport - b.daysToReport)
}

export const recentResults = () => [...showdownResults].sort((a, b) => a.daysAgo - b.daysAgo)
