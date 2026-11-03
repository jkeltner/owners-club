import { useState } from 'react'
import { tagThesis } from '../../coach/tagger'
import { Button, Card, Chip, Page, TopBar } from '../../components/ui'
import { concept } from '../../content'
import { eps, findCompany, netMargin, peRatio, type Company } from '../../data/companies'
import { useGame, type Prediction } from '../../state/store'

type Metric = { id: string; label: string; unit: string; step: number; ref: (c: Company) => number; refLabel: string }

// Measurable metrics only, so predictions grade objectively at earnings.
const METRICS: Metric[] = [
  { id: 'revenue_growth', label: 'Sales growth vs. a year ago', unit: '%', step: 1, ref: (c) => c.revenueGrowth, refLabel: 'Last year' },
  { id: 'eps', label: 'Profit per share next quarter (3 months)', unit: '$', step: 0.05, ref: (c) => eps(c) / 4, refLabel: 'Average quarter' },
  { id: 'margin', label: 'Profit per $1 of sales next quarter', unit: '%', step: 1, ref: (c) => netMargin(c), refLabel: 'Last year' },
]

// A thesis in three parts (concept doc, "The first 15 minutes"): what the
// business does well, what happens next, and the number being watched. Each
// part is free text, never a menu: the tagger marks concepts "applied" from
// the thesis text, and a template mustn't earn that for the player. The saved
// thesis is the three parts joined, so the feed, comments and tagger don't change.
type Slot = { id: 0 | 1 | 2; label: string; hint: string; placeholder: (c: Company) => string }
const SLOTS: Slot[] = [
  { id: 0, label: 'What they do well', hint: 'The thing about this business that’s hard to copy.', placeholder: (c) => `${c.name} is good at…` },
  { id: 1, label: 'What I think happens next', hint: 'And why. This is the part your club will argue with.', placeholder: () => 'I think… because…' },
  { id: 2, label: 'The number I’m watching', hint: 'Say the number and what it means. This is what counts for your rank.', placeholder: (c) => numberStarter(c) },
]

// A starter for the third part, from numbers the player can see on the company page.
function numberStarter(c: Company): string {
  const pe = peRatio(c)
  if (pe === null) return `${c.name} has no P/E yet, so I’m watching whether…`
  return `The P/E is ${pe.toFixed(0)}, which means…`
}

const NUMBER_STARTERS = (c: Company): string[] => {
  const pe = peRatio(c)
  return [
    pe === null ? `${c.name} lost money last year, so ` : `The P/E is ${pe.toFixed(0)}, which means `,
    `Sales grew ${c.revenueGrowth}% last year, so `,
    c.earningsB > 0 ? `It keeps ${netMargin(c).toFixed(0)}¢ of each $1 of sales, which ` : `Its sales are growing ${c.revenueGrowth}% while it loses money, so `,
  ]
}

// The player's own chat answers, so the thesis builds on the coach
// conversation instead of starting over. Only the player's words go into the
// draft, never the coach's.
const capFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
// Keep "I" and acronyms like "AI" capitalized.
const lowerFirst = (t: string) => (/^(I\b|[A-Z]{2})/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))
const endStop = (t: string) => (/[.!?]$/.test(t) ? t : t + '.')
const skipAnswer = (t: string) => /^(not sure|yes|no|maybe|about|what does|idk|dunno)/i.test(t)

type Parts = [string, string, string]

// A pick after the coach: the "why" answer is what the business does well,
// the "how could it beat expectations" answer is what happens next.
function partsFromChat(name: string, answers: string[]): Parts {
  const [why, , how] = answers
  const p: Parts = ['', '', '']
  if (why && !skipAnswer(why)) p[0] = why.length > 40 ? endStop(capFirst(why)) : `${name} ${endStop(lowerFirst(why))}`
  if (how && !skipAnswer(how)) p[1] = `It could do better than buyers think if ${endStop(lowerFirst(how))}`
  return p
}

// A scouting report after the coach: the second answer is the player's side
// ("more likely to beat the market"); the first is their read of the number.
function partsFromScoutChat(name: string, answers: string[]): Parts {
  const [read, side] = answers
  const p: Parts = ['', '', '']
  if (side && /either way|depends/i.test(side)) p[1] = `${name} could go either way: `
  else if (side && !skipAnswer(side)) p[1] = `${name} is ${lowerFirst(side.replace(/[.…]+$/, ''))} because `
  if (read && !skipAnswer(read) && read.length > 25) p[2] = endStop(capFirst(read))
  return p
}

const joinParts = (p: Parts) => p.map((t) => t.trim()).filter(Boolean).map(endStop).join(' ')
const MIN = 6 // characters per part: enough to rule out a blank, short enough not to nag

const fmt = (m: Metric, v: number) => (m.unit === '$' ? `$${v.toFixed(2)}` : `${v.toFixed(0)}%`)

export function ThesisScreen() {
  const { state, go, update, mark } = useGame()
  const scout = !!state.draft?.scout
  const fromScout = !!state.draft?.fromScout // a saved scouting report becoming a pick
  const focus = state.draft?.focus ? concept(state.draft.focus) : null
  const c = findCompany(state.companyTicker ?? '') ?? findCompany('NVDA')!
  // A saved report comes back as one text; a new thesis is written in parts.
  const [whole, setWhole] = useState(state.draft?.thesis ?? '')
  const [parts, setParts] = useState<Parts>(['', '', ''])
  const [metricId, setMetricId] = useState(state.draft?.prediction?.metric ?? METRICS[0].id)
  const metric = METRICS.find((m) => m.id === metricId)!
  const [value, setValue] = useState<number>(state.draft?.prediction?.value ?? Math.round(metric.ref(c)))
  const text = fromScout ? whole.trim() : joinParts(parts)
  // A part counts once the player has written something of their own: a
  // starter chip on its own ("The P/E is 45, which means") doesn't count, or
  // the tagger would mark P/E "applied" for a tap.
  const starters = NUMBER_STARTERS(c).map((t) => t.trim())
  const written = (i: number) => {
    const v = parts[i].trim()
    const starter = i === 2 ? starters.find((st) => v.startsWith(st)) : undefined
    return v.length - (starter?.length ?? 0) >= MIN
  }
  const missing = fromScout ? (whole.trim().length < 20 ? [1] : []) : SLOTS.filter((s) => !written(s.id)).map((s) => s.id)
  const ok = missing.length === 0
  const answers = state.coachLog.filter((m) => m.from === 'player').map((m) => m.text)
  const watch = scout ? null : state.coachLog.map((m) => m.text.match(/worth watching: (.+)$/)?.[1]).find(Boolean) ?? null
  const back = state.coachLog.length ? 'coach' : 'company'
  const setPart = (i: number, t: string) => setParts((p) => p.map((x, j) => (j === i ? t : x)) as Parts)
  const fillFrom = (draft: Parts) => setParts((p) => p.map((x, i) => (x.trim() ? x : draft[i])) as Parts)

  const pickMetric = (m: Metric) => {
    setMetricId(m.id)
    setValue(m.unit === '$' ? Math.round(m.ref(c) * 20) / 20 : Math.round(m.ref(c)))
  }

  const next = () => {
    const prediction: Prediction = { metric: metric.id, label: metric.label, value, unit: metric.unit }
    if (scout) {
      // A scouting report: no money moves, but the thesis counts the same way.
      update((s) => ({ scouts: [...s.scouts, { ticker: c.ticker, thesis: text, prediction, at: Date.now() }], draft: null }))
      for (const slug of tagThesis(text)) mark(slug, 'applied', `scouting report on ${c.ticker}`)
      go('scouted')
      return
    }
    update((s) => ({ draft: { amount: s.draft?.amount ?? 1000, thesis: text, prediction } }))
    go('size')
  }

  // The third part's prompt: the coach's "worth watching" point for a pick,
  // the focus concept's example for a coach-led scouting report.
  const thirdHint = focus
    ? `Use ${focus.name.toLowerCase()} here: say the number and what it means for ${c.name}.${focus.in_a_thesis ? ` Like: "${focus.in_a_thesis}"` : ''}`
    : watch
      ? `The coach said this was worth watching: ${capFirst(watch)}`
      : SLOTS[2].hint

  return (
    <Page>
      <TopBar back={back} title={c.name} />
      <p className="eyebrow">{scout ? '🔭 Scouting report' : fromScout ? 'From your scouting report' : 'Step 3 of 3'}</p>
      <h1>{scout ? `My take on ${c.name}` : `Why I'm buying ${c.name}`}</h1>
      <p className="muted">
        {scout
          ? "You're not buying anything. Three short parts, in your own words. It's scored at earnings like a real pick, and it counts for your rank."
          : fromScout
            ? 'Your scouting report becomes your thesis. Change it if your thinking has changed, then say how much to move into it.'
            : answers.length
              ? 'You already did the thinking with the coach. Now put it in three short parts your club will read.'
              : 'Three short parts, in your own words. Your club will see it.'}
      </p>
      {answers.length > 0 && (
        <Card className="chat-recap">
          <p className="eyebrow">What you told the coach</p>
          <ul>{answers.map((a, i) => <li key={i}>"{a}"</li>)}</ul>
          <Chip onClick={() => fillFrom(scout ? partsFromScoutChat(c.name, answers) : partsFromChat(c.name, answers))}>✍️ Start from my answers</Chip>
        </Card>
      )}

      {fromScout ? (
        <textarea className="thesis-box" value={whole} onChange={(e) => setWhole(e.target.value)} rows={4} placeholder="I think…" />
      ) : (
        <div className="thesis-slots">
          {SLOTS.map((s) => (
            <label key={s.id} className={`slot ${written(s.id) ? 'filled' : ''}`}>
              <span className="slot-label"><b>{s.id + 1}. {s.label}</b><small>{s.id === 2 ? thirdHint : s.hint}</small></span>
              <textarea
                value={parts[s.id]}
                onChange={(e) => setPart(s.id, e.target.value)}
                rows={2}
                placeholder={s.placeholder(c)}
              />
              {s.id === 2 && !parts[2].trim() && (
                <div className="chips slot-chips">
                  {NUMBER_STARTERS(c).map((t) => <Chip key={t} onClick={() => setPart(2, t)}>{t.trim()}…</Chip>)}
                </div>
              )}
            </label>
          ))}
        </div>
      )}

      <h2>My prediction</h2>
      <p className="muted">Pick one number. When {c.name} reports its results in {c.daysToEarnings} days, we'll check whether you were right.</p>
      <div className="metric-list">
        {METRICS.map((m) => (
          <button key={m.id} className={`metric ${m.id === metricId ? 'on' : ''}`} onClick={() => pickMetric(m)}>
            <b>{m.label}</b>
            <small>{m.refLabel}: {fmt(m, m.ref(c))}</small>
          </button>
        ))}
      </div>
      <Card className="stepper-card">
        <button className="step" onClick={() => setValue((v) => +(v - metric.step).toFixed(2))} aria-label="Lower">−</button>
        <div className="step-value">
          <span>{fmt(metric, value)}</span>
          <small>or more</small>
        </div>
        <button className="step" onClick={() => setValue((v) => +(v + metric.step).toFixed(2))} aria-label="Higher">+</button>
      </Card>
      <div className="sticky-cta">
        <Button disabled={!ok} onClick={next}>
          {!ok
            ? fromScout ? 'Write a bit more' : missing.length === 1 && missing[0] === 2 ? 'Add the number you’re watching' : `Fill in part ${missing[0] + 1}`
            : scout ? 'Save scouting report' : 'Next: how much?'}
        </Button>
      </div>
    </Page>
  )
}
