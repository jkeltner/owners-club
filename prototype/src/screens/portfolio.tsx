import { useState } from 'react'
import { DriftChart, MixBar, PriceChart } from '../components/charts'
import { Linked } from '../components/terms'
import { Button, Card, Page } from '../components/ui'
import { MARKET_PE, concept } from '../content'
import { DEMO_FEES_PAID, DEMO_SP500_RETURN, DEMO_TAXES_PAID, GAIN_SPLIT, WEEKS, YEAR_DAYS, demoLots, demoPE, demoPick, driftSeries, holdingHistory, peEffects } from '../data/demo_season'
import { findCompany } from '../data/companies'
import { signedPct, usd } from '../lib/format'
import { DEFAULT_SETTINGS, INDEX_TICKER, STARTING_VALUE, daysUntilLongTerm, daysUntilUnlocked, isLocked, taxIfSoldToday, taxRateFor, type Lot } from '../lib/rules'
import { useGame } from '../state/store'

type Holding = Lot & { name: string; pending?: boolean }

const COLORS = ['var(--primary)', 'var(--gold)', 'var(--mint)', 'var(--coral)']
const colorFor = (ticker: string, order: string[]) =>
  ticker === INDEX_TICKER ? 'var(--index)' : COLORS[order.filter((t) => t !== INDEX_TICKER).indexOf(ticker) % COLORS.length]

export function PortfolioScreen() {
  const { state, go, mark } = useGame()
  const [view, setView] = useState<'now' | 'later'>('now')
  const [decision, setDecision] = useState<string | null>(null)
  const pick = state.pick
  const ffPick = demoPick(pick?.ticker)

  const holdings: Holding[] = view === 'now'
    ? [
        { ticker: INDEX_TICKER, name: 'S&P 500 index', cost: STARTING_VALUE - (pick?.amount ?? 0), value: STARTING_VALUE - (pick?.amount ?? 0), daysHeld: 0 },
        ...(pick ? [{ ticker: pick.ticker, name: findCompany(pick.ticker)?.name ?? pick.ticker, cost: pick.amount - pick.fee, value: pick.amount - pick.fee, daysHeld: 0, pending: true }] : []),
      ]
    : demoLots(ffPick)

  const order = holdings.map((h) => h.ticker)
  const total = holdings.reduce((a, h) => a + h.value, 0)
  const tax = taxIfSoldToday(holdings)
  const afterTax = total - tax
  const fees = view === 'now' ? (pick?.fee ?? 0) : DEMO_FEES_PAID
  const taxesPaid = view === 'now' ? 0 : DEMO_TAXES_PAID
  // The S&P 500 benchmark, also after tax as if sold today.
  const spReturn = view === 'now' ? 0 : DEMO_SP500_RETURN
  const spAfterTax = STARTING_VALUE * (1 + spReturn / 100) - STARTING_VALUE * (spReturn / 100) * DEFAULT_SETTINGS.shortTermTaxRate
  const myReturn = (afterTax / STARTING_VALUE - 1) * 100
  const spAfterTaxReturn = (spAfterTax / STARTING_VALUE - 1) * 100
  const largest = holdings.filter((h) => h.ticker !== INDEX_TICKER).reduce((m, h) => Math.max(m, h.value / total), 0)

  const switchView = (v: 'now' | 'later') => {
    setView(v)
    if (v === 'later') {
      mark('diversification-concentration-risk', 'encountered', 'drift chart')
      mark('earnings-growth-vs-multiple-expansion', 'encountered', 'gain breakdown')
    }
  }

  return (
    <Page>
      <h1>Portfolio</h1>
      <div className="seg">
        <button className={view === 'now' ? 'on' : ''} onClick={() => switchView('now')}>Today</button>
        <button className={view === 'later' ? 'on' : ''} onClick={() => switchView('later')}>⏩ 5 months later</button>
      </div>
      {view === 'later' && <p className="muted small">A preview of how a season could go. Made-up numbers.</p>}

      <Card className="three-numbers">
        <div><small>Total value</small><b>{usd(total)}</b></div>
        <div><small>Tax if you sold it all today</small><b>{usd(tax)}</b></div>
        <div className="key"><small>After tax</small><b>{usd(afterTax)}</b></div>
      </Card>

      <Card className="vs-card">
        <div className="vs-row"><span>You (after tax)</span><b>{signedPct(myReturn)}</b></div>
        <div className="vs-row"><span>S&P 500 (after tax)</span><b>{signedPct(spAfterTaxReturn)}</b></div>
        <div className="vs-row total"><span>You vs. the market</span><b>{Math.abs(myReturn - spAfterTaxReturn) < 0.05 ? 'Even' : signedPct(myReturn - spAfterTaxReturn)}</b></div>
        <p className="muted small">Fees paid this season: <b>{usd(fees, true)}</b> · Taxes paid: <b>{usd(taxesPaid)}</b></p>
      </Card>

      <h2>What you own</h2>
      <MixBar parts={holdings.map((h) => ({ label: h.name, value: h.value, color: colorFor(h.ticker, order) }))} />
      <p className="muted small">Largest pick: <b>{Math.round(largest * 100)}%</b> of your portfolio. Tap 📈 on a holding to see its price over time.</p>
      {holdings.map((h) => (
        <HoldingRow key={h.ticker} h={h} total={total} color={colorFor(h.ticker, order)}
          onSell={h.ticker === 'COST' && view === 'later' ? () => go('sell') : undefined} />
      ))}

      {state.scouts.length > 0 && (
        <>
          <h2>🔭 Scouting</h2>
          <p className="muted small">Theses on companies you don't own. No money in them; they're scored at earnings like a pick.</p>
          {state.scouts.map((s) => {
            const c = findCompany(s.ticker)
            return (
              <Card key={s.at} className="scout-row">
                <div><b>{c?.name ?? s.ticker}</b><small>Checked in {c?.daysToEarnings ?? '?'} days</small></div>
                <p className="small">"{s.thesis}"</p>
                <div className="prediction-pill">🎯 {s.prediction.label}: {s.prediction.unit === '$' ? `$${s.prediction.value.toFixed(2)}` : `${s.prediction.value}%`} or more</div>
              </Card>
            )
          })}
        </>
      )}

      {view === 'later' && (
        <>
          <h2>How your mix drifted</h2>
          <Card>
            <DriftChart
              weeks={driftSeries(ffPick)}
              order={[ffPick.ticker, 'COST', 'KO', INDEX_TICKER]}
              colors={{ [ffPick.ticker]: 'var(--primary)', COST: 'var(--gold)', KO: 'var(--mint)', [INDEX_TICKER]: 'var(--index)' }}
            />
            <div className="range-ends"><span>{WEEKS} weeks ago</span><span>Today</span></div>
            <p className="small">Colors show how much of your money is in each holding. The dotted line is your average <Linked text="P/E" />. {ffPick.name} went from <b>25%</b> to <b>{Math.round((4000 / total) * 100)}%</b> of your money, and your average P/E went up with it. Bigger <i>and</i> pricier, without you buying anything.</p>
          </Card>

          <PeBreakdown holdings={holdings} pes={demoPE(ffPick)} colorOf={(t) => colorFor(t, order)} />

          <h2>What drove the {ffPick.name} gain</h2>
          <Card className="gain-split">
            <div className="gain-total">{ffPick.name}: +{GAIN_SPLIT.total}% since you bought</div>
            <SplitBar label="Earnings grew" value={GAIN_SPLIT.earnings} kind="biz" />
            <SplitBar label="Buyers paying more for each $1 of profit (a higher P/E)" value={GAIN_SPLIT.multiple} kind="mult" />
            <p className="small muted">{concept('earnings-growth-vs-multiple-expansion').kid_explanation}</p>
          </Card>

          <Card className="coach-prompt">
            <p><span className="coach-inline">🧢</span> Your 3-month hold on {ffPick.name} is over. It's now <b>{Math.round((4000 / total) * 100)}%</b> of your portfolio, up from 25% when you bought. More than half the gain came from investors paying more per dollar of earnings. Hold, trim or sell?</p>
            {decision ? (
              <p className="decision">You chose <b>{decision}</b>. Noted in your record. There's no right answer here, just your reason.</p>
            ) : (
              <div className="choice-row">
                {['Hold', 'Trim', 'Sell'].map((d) => <Button key={d} kind="secondary" onClick={() => setDecision(d.toLowerCase())}>{d}</Button>)}
              </div>
            )}
          </Card>
        </>
      )}
    </Page>
  )
}

function HoldingRow({ h, total, color, onSell }: { h: Holding; total: number; color: string; onSell?: () => void }) {
  const [open, setOpen] = useState(false)
  const gain = h.value - h.cost
  const isIndex = h.ticker === INDEX_TICKER
  const rate = taxRateFor(h)
  return (
    <Card className={`holding ${open ? 'open' : ''}`}>
      <button className="holding-top" onClick={() => setOpen(!open)} aria-expanded={open}>
        <i className="swatch" style={{ background: color }} />
        <div className="holding-name"><b>{h.name}</b><small>{Math.round((h.value / total) * 100)}% of portfolio</small></div>
        <div className="holding-value"><b>{usd(h.value)}</b><small>{gain === 0 ? '—' : `${gain > 0 ? '+' : '−'}${usd(Math.abs(gain))}`}</small></div>
      </button>
      {!h.pending && gain !== 0 && (
        <p className="holding-tax">
          {gain > 0
            ? <>Tax if sold today: <b>{usd(gain * rate)}</b> ({rate * 100}% of the {usd(gain)} gain)</>
            : <>A {usd(-gain)} loss. If sold, it lowers the tax on your other gains.</>}
        </p>
      )}
      <div className="holding-tags">
        {h.pending && <span className="tag">🌙 Buys at today's closing price</span>}
        {isIndex && <span className="tag">Sell anytime · no 25% limit</span>}
        {!isIndex && (h.pending || isLocked(h)) && <span className="tag lock">🔒 Can't sell for {h.pending ? 91 : daysUntilUnlocked(h)} more days</span>}
        {!isIndex && !h.pending && !isLocked(h) && <span className="tag">Can sell now</span>}
        {!h.pending && h.daysHeld > 0 && gain > 0 && (
          daysUntilLongTerm(h) > 0
            ? <span className="tag">40% tax rate · 20% in {daysUntilLongTerm(h)} days</span>
            : <span className="tag">20% tax rate</span>
        )}
      </div>
      <button className={`chart-toggle ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} aria-expanded={open}>
        📈 {open ? 'Hide price chart' : 'Show price chart'} <span className="chev" aria-hidden>⌄</span>
      </button>
      {open && <HoldingChart h={h} />}
      {onSell && <Button kind="secondary" onClick={onSell}>Sell?</Button>}
    </Card>
  )
}

const PERIODS = [3, 6, 9, 12] // months

function HoldingChart({ h }: { h: Holding }) {
  const { series, buyAt, buyPrice, nowPrice } = holdingHistory(h.ticker, h.cost, h.value, h.daysHeld)
  const isIndex = h.ticker === INDEX_TICKER
  const fmt = (n: number) => (isIndex ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : usd(n, true))
  const axis = (n: number) => (isIndex ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : `$${n.toLocaleString('en-US', { maximumFractionDigits: n < 20 ? 1 : 0 })}`)
  const daysFor = (m: number) => Math.round((YEAR_DAYS * m) / 12)
  // Start on the shortest period that still shows the buy day.
  const [months, setMonths] = useState(PERIODS.find((m) => YEAR_DAYS - daysFor(m) <= buyAt) ?? 12)
  const from = YEAR_DAYS - daysFor(months)
  const shown = series.slice(from)
  const first = shown[0]
  return (
    <div className="holding-chart pop-in">
      <div className="period-row" role="group" aria-label="Time period">
        {PERIODS.map((m) => (
          <button key={m} className={`chip ${m === months ? 'chip-active' : ''}`} onClick={() => setMonths(m)}>{m === 12 ? '1Y' : `${m}M`}</button>
        ))}
      </div>
      <PriceChart series={shown} marker={buyAt - from} format={axis} />
      <p className="small">
        {months === 12 ? 'Over the last year' : `Over the last ${months} months`} it went from {fmt(first)} to {fmt(nowPrice)} ({signedPct((nowPrice / first - 1) * 100)}).{' '}
        {h.daysHeld === 0
          ? <>The dot is today: your {isIndex ? 'money starts tracking the index' : 'buy goes through'} at today's closing price.</>
          : buyAt >= from
            ? <>The dot is when you bought, at {fmt(buyPrice)}{isIndex ? '' : ' a share'}: {signedPct((nowPrice / buyPrice - 1) * 100)} since then.</>
            : <>You bought before this window, at {fmt(buyPrice)}{isIndex ? '' : ' a share'}.</>}
      </p>
    </div>
  )
}

function PeBreakdown({ holdings, pes, colorOf }: { holdings: Holding[]; pes: Record<string, number>; colorOf: (t: string) => string }) {
  const { avg, rows } = peEffects(holdings, pes)
  const maxEffect = Math.max(...rows.map((r) => Math.abs(r.effect)), 1)
  return (
    <>
      <h2>What each holding does to your P/E</h2>
      <Card className="pe-breakdown">
        <p className="small">Your average <Linked text="P/E" /> is <b>{avg.toFixed(0)}</b> (a typical company is about {MARKET_PE}). It's each holding's P/E, weighted by how much money is in it. Here's how far each one pulls it up or down:</p>
        {rows.map((r) => {
          const h = holdings.find((x) => x.ticker === r.ticker)!
          return (
            <div key={r.ticker} className="pe-row">
              <i className="swatch" style={{ background: colorOf(r.ticker) }} />
              <span className="pe-name"><b>{h.name}</b><small>P/E {r.pe} · {Math.round(r.share * 100)}% of your money</small></span>
              <span className="pe-effect">
                <span className="pe-bar"><span className={r.effect >= 0 ? 'up' : 'down'} style={{ width: `${(Math.abs(r.effect) / maxEffect) * 50}%` }} /></span>
                <b>{r.effect >= 0 ? '+' : '−'}{Math.abs(r.effect).toFixed(1)}</b>
              </span>
            </div>
          )
        })}
        <p className="muted small">The bigger a holding and the further its P/E from your average, the more it moves the average.</p>
      </Card>
    </>
  )
}

function SplitBar({ label, value, kind }: { label: string; value: number; kind: 'biz' | 'mult' }) {
  return (
    <div className="split-bar">
      <div className="split-label"><span>{label}</span><b>+{value}%</b></div>
      <div className="split-track"><span className={kind} style={{ width: `${(value / 30) * 100}%` }} /></div>
    </div>
  )
}
