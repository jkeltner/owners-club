import { useState } from 'react'
import { tagThesis } from '../../coach/tagger'
import { Button, Card, Chip, Page, TopBar } from '../../components/ui'
import { concept } from '../../content'
import { eps, findCompany, netMargin, type Company } from '../../data/companies'
import { useGame, type Prediction } from '../../state/store'

type Metric = { id: string; label: string; unit: string; step: number; ref: (c: Company) => number; refLabel: string }

// Measurable metrics only, so predictions grade objectively at earnings.
const METRICS: Metric[] = [
  { id: 'revenue_growth', label: 'Sales growth vs. a year ago', unit: '%', step: 1, ref: (c) => c.revenueGrowth, refLabel: 'Last year' },
  { id: 'eps', label: 'Profit per share next quarter (3 months)', unit: '$', step: 0.05, ref: (c) => eps(c) / 4, refLabel: 'Average quarter' },
  { id: 'margin', label: 'Profit per $1 of sales next quarter', unit: '%', step: 1, ref: (c) => netMargin(c), refLabel: 'Last year' },
]

const STARTERS = ['I think… because…', 'Everyone expects… but I think…', 'The P/E is… which means…']

// The player's own chat answers, so the thesis builds on the coach
// conversation instead of starting over. Only the player's words go into the
// draft: the tagger marks concepts "applied" from the thesis text, and a
// template mustn't earn that for them.
const capFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
// Keep "I" and acronyms like "AI" capitalized.
const lowerFirst = (t: string) => (/^(I\b|[A-Z]{2})/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1))
const endStop = (t: string) => (/[.!?]$/.test(t) ? t : t + '.')
const skipAnswer = (t: string) => /^(not sure|yes|no|maybe|about|what does|idk|dunno)/i.test(t)

function draftFromChat(name: string, answers: string[]): string {
  const [why, , how] = answers
  const parts: string[] = []
  if (why && !skipAnswer(why)) parts.push(why.length > 40 ? endStop(capFirst(why)) : `I'm buying ${name} because ${endStop(lowerFirst(why))}`)
  if (how && !skipAnswer(how)) parts.push(`What could make it do better than buyers think: ${endStop(lowerFirst(how))}`)
  parts.push("The risk I'm watching: ")
  return parts.join(' ')
}

// A scouting report after the coach: the second answer is the player's side
// ("more likely to beat the market"); the first is their read of the number.
function draftFromScoutChat(name: string, answers: string[]): string {
  const [read, side] = answers
  const parts: string[] = []
  if (side && /either way|depends/i.test(side)) parts.push(`${name} could go either way: `)
  else if (side && !skipAnswer(side)) parts.push(`${name} is ${lowerFirst(side.replace(/[.…]+$/, ''))} because `)
  else parts.push(`I think ${name} `)
  if (read && !skipAnswer(read) && read.length > 25) parts.push(`${endStop(lowerFirst(read))} `)
  return parts.join('')
}

const fmt = (m: Metric, v: number) => (m.unit === '$' ? `$${v.toFixed(2)}` : `${v.toFixed(0)}%`)

export function ThesisScreen() {
  const { state, go, update, mark } = useGame()
  const scout = !!state.draft?.scout
  const fromScout = !!state.draft?.fromScout // a saved scouting report becoming a pick
  const focus = state.draft?.focus ? concept(state.draft.focus) : null
  const c = findCompany(state.companyTicker ?? '') ?? findCompany('NVDA')!
  const [thesis, setThesis] = useState(state.draft?.thesis ?? '')
  const [metricId, setMetricId] = useState(state.draft?.prediction?.metric ?? METRICS[0].id)
  const metric = METRICS.find((m) => m.id === metricId)!
  const [value, setValue] = useState<number>(state.draft?.prediction?.value ?? Math.round(metric.ref(c)))
  const ok = thesis.trim().length >= 20
  const answers = state.coachLog.filter((m) => m.from === 'player').map((m) => m.text)
  const watch = scout ? null : state.coachLog.map((m) => m.text.match(/worth watching: (.+)$/)?.[1]).find(Boolean) ?? null
  const back = state.coachLog.length ? 'coach' : 'company'

  const pickMetric = (m: Metric) => {
    setMetricId(m.id)
    setValue(m.unit === '$' ? Math.round(m.ref(c) * 20) / 20 : Math.round(m.ref(c)))
  }

  const next = () => {
    const prediction: Prediction = { metric: metric.id, label: metric.label, value, unit: metric.unit }
    if (scout) {
      // A scouting report: no money moves, but the thesis counts the same way.
      update((s) => ({ scouts: [...s.scouts, { ticker: c.ticker, thesis: thesis.trim(), prediction, at: Date.now() }], draft: null }))
      for (const slug of tagThesis(thesis)) mark(slug, 'applied', `scouting report on ${c.ticker}`)
      go('scouted')
      return
    }
    update((s) => ({ draft: { amount: s.draft?.amount ?? 1000, thesis: thesis.trim(), prediction } }))
    go('size')
  }

  return (
    <Page>
      <TopBar back={back} title={c.name} />
      <p className="eyebrow">{scout ? '🔭 Scouting report' : fromScout ? 'From your scouting report' : 'Step 3 of 3'}</p>
      <h1>{scout ? `My take on ${c.name}` : `Why I'm buying ${c.name}`}</h1>
      <p className="muted">
        {scout
          ? answers.length
            ? "You're not buying anything. Put what you told the coach into one or two sentences, with the number in it. It's scored at earnings like a real pick, and it counts for your rank."
            : "You're not buying anything. Write what you think will happen and why, plus one prediction. It's scored at earnings like a real pick, and it counts for your rank."
          : fromScout
            ? 'Your scouting report becomes your thesis. Change it if your thinking has changed, then say how much to move into it.'
            : answers.length
              ? 'You already did the thinking with the coach. Now put it in one or two sentences your club will read.'
              : 'One or two sentences: what you think will happen, and why. Your club will see it.'}
      </p>
      {scout && focus && (
        <Card className="chat-recap focus-hint">
          <p className="eyebrow">Use {focus.name.toLowerCase()} in it</p>
          <p className="small">Say the number and what it means for {c.name}.{focus.in_a_thesis && <> Like: <i>"{focus.in_a_thesis}"</i></>}</p>
        </Card>
      )}
      {answers.length > 0 && (
        <Card className="chat-recap">
          <p className="eyebrow">What you told the coach</p>
          <ul>{answers.map((a, i) => <li key={i}>"{a}"</li>)}</ul>
          {watch && <p className="small"><b>Worth watching:</b> {capFirst(watch)}</p>}
        </Card>
      )}
      <textarea className="thesis-box" value={thesis} onChange={(e) => setThesis(e.target.value)} rows={4} placeholder="I think…" />
      <div className="chips">
        {answers.length > 0 && <Chip onClick={() => setThesis((t) => (t.trim() ? t : scout ? draftFromScoutChat(c.name, answers) : draftFromChat(c.name, answers)))}>✍️ Start from my answers</Chip>}
        {STARTERS.map((s) => <Chip key={s} onClick={() => setThesis((t) => (t ? t : s.replace(/…/g, ' ').trim() + ' '))}>{s}</Chip>)}
      </div>

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
        <Button disabled={!ok} onClick={next}>{!ok ? 'Write a bit more' : scout ? 'Save scouting report' : 'Next: how much?'}</Button>
      </div>
    </Page>
  )
}
