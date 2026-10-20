import { useState } from 'react'
import { tagThesis } from '../../coach/tagger'
import { Button, Card, Chip, Page, TopBar } from '../../components/ui'
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

const fmt = (m: Metric, v: number) => (m.unit === '$' ? `$${v.toFixed(2)}` : `${v.toFixed(0)}%`)

export function ThesisScreen() {
  const { state, go, update, mark } = useGame()
  const scout = !!state.draft?.scout
  const c = findCompany(state.companyTicker ?? '') ?? findCompany('NVDA')!
  const [thesis, setThesis] = useState(state.draft?.thesis ?? '')
  const [metricId, setMetricId] = useState(state.draft?.prediction?.metric ?? METRICS[0].id)
  const metric = METRICS.find((m) => m.id === metricId)!
  const [value, setValue] = useState<number>(state.draft?.prediction?.value ?? Math.round(metric.ref(c)))
  const ok = thesis.trim().length >= 20

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
      <TopBar back={scout ? 'company' : 'coach'} title={c.name} />
      <p className="eyebrow">{scout ? '🔭 Scouting report' : 'Step 3 of 3'}</p>
      <h1>{scout ? `My take on ${c.name}` : `Why I'm buying ${c.name}`}</h1>
      <p className="muted">
        {scout
          ? "You're not buying anything. Write what you think will happen and why, plus one prediction. It's scored at earnings like a real pick, and it counts for your rank."
          : 'One or two sentences: what you think will happen, and why. Your club will see it.'}
      </p>
      <textarea className="thesis-box" value={thesis} onChange={(e) => setThesis(e.target.value)} rows={4} placeholder="I think…" />
      <div className="chips">
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
