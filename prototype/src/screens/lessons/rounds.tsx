// Round 2 ("Try it") of each lesson format. These are computed from the
// game's numbers, so they live in code; rounds 1 and 3 are in
// content/lessons.yaml. Each one calls onDone when the player can move on.
import { useState } from 'react'
import { PeScale } from '../../components/charts'
import { CoachSays, PickOne } from '../../components/lesson_parts'
import { Button, Card } from '../../components/ui'
import { MARKET_PE, lens, sectorPlural } from '../../content'
import { SORT_TICKERS, findCompany, netMargin, peRatio, type Company } from '../../data/companies'
import { signedPct, usd } from '../../lib/format'
import { DEFAULT_SETTINGS } from '../../lib/rules'

type Round = { onDone: () => void }

// ---------- Talk it through: P/E ----------

export function TalkPE({ a, b, onDone }: Round & { a: Company; b: Company }) {
  return (
    <>
      {[a, b].map((c) => (
        <Card key={c.ticker} className="pe-card">
          <h3>{c.name}: P/E {peRatio(c)!.toFixed(0)}</h3>
          <PeScale pe={peRatio(c)!} market={MARKET_PE} range={lens(c.lens)?.typical_pe} sector={sectorPlural(c.lens)} />
        </Card>
      ))}
      <PickOne
        question={`Why would anyone pay more years of profit for ${a.name}?`}
        options={[
          { text: `${a.name} is a bigger company`, say: "Size doesn't change P/E. It's the price for each $1 of profit, so a giant company and a small one can have the same P/E." },
          { text: 'Its share price is higher', say: "A $700 share and a $70 share can have the same P/E. It's the price compared with the profit, not the price by itself." },
          { text: 'Buyers expect its profits to grow faster', right: true, say: 'Right. Paying for more years of today\'s profit only makes sense if profit is going to grow. A high P/E is a bet on growth; a low one means buyers expect less of it.' },
        ]}
        onAnswered={onDone}
      />
    </>
  )
}

// ---------- Sort it: profit margins ----------

export function SortMargins({ onDone }: Round) {
  const items = SORT_TICKERS.map((t) => findCompany(t)!)
  const right = [...items].sort((x, y) => netMargin(y) - netMargin(x))
  const [order, setOrder] = useState<string[]>([])
  const done = order.length === items.length
  const tap = (t: string) => {
    if (done) return
    const next = order.includes(t) ? order.filter((x) => x !== t) : [...order, t]
    setOrder(next)
    if (next.length === items.length) onDone()
  }
  const correct = order.filter((t, i) => right[i].ticker === t).length
  return (
    <>
      {!done ? (
        <>
          <p className="muted small">Tap them in order: the one that keeps the most of each $1 first. Tap again to undo.</p>
          <div className="sort-list">
            {items.map((c) => {
              const pos = order.indexOf(c.ticker)
              return (
                <button key={c.ticker} className={`sort-item ${pos >= 0 ? 'on' : ''}`} onClick={() => tap(c.ticker)}>
                  <span className="sort-pos">{pos >= 0 ? pos + 1 : ''}</span>
                  <span><b>{c.name}</b><small>{c.oneLiner}</small></span>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <Card>
            <p className="eyebrow">{correct === items.length ? 'All four in the right spot' : `${correct} of 4 in the right spot`}</p>
            {right.map((c, i) => (
              <div key={c.ticker} className="margin-row">
                <span>{i + 1}. {c.name}{order[i] === c.ticker ? ' ✓' : ''}</span>
                <span className="decade-track"><i style={{ width: `${netMargin(c)}%` }} /></span>
                <b>{Math.round(netMargin(c))}¢</b>
              </div>
            ))}
            <p className="muted small">Profit kept from each $1 of sales, last year.</p>
          </Card>
          <CoachSays text={`Surprised by ${right[3].name}? It keeps about ${Math.round(netMargin(right[3]))}¢ of each $1, but it sells an enormous amount, and its members pay a yearly fee. ${right[0].name} keeps ${Math.round(netMargin(right[0]))}¢ because nobody else can make chips like its chips right now.`} />
        </>
      )}
    </>
  )
}

// ---------- What if: costs and taxes ----------

export function WhatIfTaxes({ onDone }: Round) {
  const s = DEFAULT_SETTINGS
  const [days, setDays] = useState(60)
  const [gainPct, setGainPct] = useState(30)
  const [moved, setMoved] = useState(false)
  const cost = 1000
  const keep = (d: number) => {
    const value = cost * (1 + gainPct / 100)
    const gain = value - cost
    const rate = d >= s.longTermAfterDays ? s.longTermTaxRate : s.shortTermTaxRate
    const tax = Math.max(0, gain) * rate
    const fee = value * s.feeRate
    return { value, gain, rate, tax, fee, keep: value - tax - fee }
  }
  const k = keep(days)
  const waited = keep(s.longTermAfterDays)
  const touch = () => { if (!moved) { setMoved(true); onDone() } }
  return (
    <>
      <Card className="whatif">
        <label>
          <span>Days you held it: <b>{days}</b></span>
          <input type="range" min={1} max={365} value={days} onChange={(e) => { setDays(Number(e.target.value)); touch() }} aria-label="Days held" />
          <span className="range-ends"><span>1 day</span><span>6 months</span><span>1 year</span></span>
        </label>
        <label>
          <span>The stock is: <b>{signedPct(gainPct, 0)}</b></span>
          <input type="range" min={-30} max={100} step={5} value={gainPct} onChange={(e) => { setGainPct(Number(e.target.value)); touch() }} aria-label="Gain or loss" />
          <span className="range-ends"><span>−30%</span><span>+100%</span></span>
        </label>
      </Card>
      <Card className="whatif-math">
        <div><span>You paid</span><b>{usd(cost)}</b></div>
        <div><span>It's worth</span><b>{usd(k.value)}</b></div>
        <div><span>Tax ({k.gain > 0 ? `${k.rate * 100}% of the ${usd(k.gain)} gain` : 'none on a loss'})</span><b>−{usd(k.tax)}</b></div>
        <div><span>Fee to sell ({s.feeRate * 100}%)</span><b>−{usd(k.fee, true)}</b></div>
        <div className="total"><span>You keep</span><b>{usd(k.keep)}</b></div>
      </Card>
      <p className="small">
        {k.gain <= 0
          ? 'No tax on a loss. In this game, a loss also lowers the tax on your other gains.'
          : days < s.longTermAfterDays
            ? <>Wait until day {s.longTermAfterDays} and you'd keep <b>{usd(waited.keep)}</b>: <b>{usd(waited.keep - k.keep)} more</b>, for doing nothing.</>
            : <>Past 6 months, the tax is {s.longTermTaxRate * 100}% instead of {s.shortTermTaxRate * 100}%.</>}
        {days < s.minHoldDays && ' (In the club you can\'t sell a pick before 3 months. Here we pretend you can, to see the math.)'}
      </p>
    </>
  )
}

// ---------- Run it 100 times: luck vs. skill ----------

type Style = 'one' | 'three' | 'index'
const STYLES: Record<Style, { label: string; icon: string; spread: number }> = {
  one: { label: 'All in one stock', icon: '🎯', spread: 40 },
  three: { label: 'Three stocks', icon: '🧺', spread: 24 },
  index: { label: 'Mostly the index', icon: '📈', spread: 8 },
}
const PLAYERS: Style[] = Array.from({ length: 30 }, (_, i) => (['one', 'three', 'index'] as Style[])[i % 3])

const gauss = () => Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random())

// Each player's result vs. the index: pure chance, minus about 1% in fees.
const season = () => PLAYERS.map((style, i) => ({ id: i + 1, style, vs: gauss() * STYLES[style].spread - 1 }))

export function SimulateLuck({ onDone }: Round) {
  const [one, setOne] = useState<ReturnType<typeof season> | null>(null)
  const [many, setMany] = useState<{ byStyle: Record<Style, number>; mostWins: number; avgWin: number } | null>(null)
  const runOne = () => setOne(season().sort((a, b) => b.vs - a.vs))
  const runMany = () => {
    const byStyle: Record<Style, number> = { one: 0, three: 0, index: 0 }
    const wins = new Map<number, number>()
    let total = 0
    for (let n = 0; n < 100; n++) {
      const top = season().sort((a, b) => b.vs - a.vs)[0]
      byStyle[top.style]++
      wins.set(top.id, (wins.get(top.id) ?? 0) + 1)
      total += top.vs
    }
    setMany({ byStyle, mostWins: Math.max(...wins.values()), avgWin: total / 100 })
    onDone()
  }
  return (
    <>
      <Card className="sim-legend">
        {(Object.keys(STYLES) as Style[]).map((k) => <span key={k}>{STYLES[k].icon} {STYLES[k].label}: 10 players</span>)}
      </Card>
      {!one && <Button onClick={runOne}>Run one season</Button>}
      {one && (
        <Card>
          <p className="eyebrow">One season: the top 5 and the last</p>
          {[...one.slice(0, 5), one[one.length - 1]].map((p, i) => (
            <div key={p.id} className={`sim-row ${i === 5 ? 'last' : ''}`}>
              <span>{i === 5 ? '30.' : `${i + 1}.`} Player {p.id} {STYLES[p.style].icon}</span>
              <b>{signedPct(p.vs, 0)} vs. index</b>
            </div>
          ))}
          <p className="small">
            Nobody here knows anything. Player {one[0].id} won by luck.
            {one[0].style === one[one.length - 1].style && ' And last place picked exactly the same way.'}
          </p>
          {!many && <Button kind="secondary" onClick={runOne}>Run another season</Button>}
        </Card>
      )}
      {one && !many && <Button onClick={runMany}>Run 100 seasons</Button>}
      {many && (
        <Card>
          <p className="eyebrow">Who won, in 100 seasons</p>
          {(Object.keys(STYLES) as Style[]).map((k) => (
            <div key={k} className="margin-row">
              <span>{STYLES[k].icon} {STYLES[k].label}</span>
              <span className="decade-track"><i style={{ width: `${many.byStyle[k]}%` }} /></span>
              <b>{many.byStyle[k]}</b>
            </div>
          ))}
          <p className="small">
            The winner beat the index by <b>{signedPct(many.avgWin, 0)}</b> on average, with zero skill. A one-stock player won <b>{many.byStyle.one} of 100</b> seasons,
            though only a third of the players bet that way. Bigger bets don't mean better picks, just bigger swings. No single player won more than <b>{many.mostWins}</b> times.
          </p>
          <Button kind="ghost" onClick={runMany}>Run 100 more</Button>
        </Card>
      )}
    </>
  )
}

// ---------- Spot the flaw: already priced in ----------

export function SpotFlaw({ c, onDone }: Round & { c: Company }) {
  const [first, setFirst] = useState(false)
  const pe = peRatio(c)!.toFixed(0)
  return (
    <>
      <Card className="my-thesis">
        <p className="eyebrow">🔥 Jordan's thesis · {c.name}</p>
        <p className="quote">"{c.name} makes the chips that power AI, and AI is the future. Everyone is using it. The stock will keep going up."</p>
      </Card>
      <PickOne
        question="Every sentence is true. So what's the problem?"
        options={[
          { text: "It's too short", say: 'Short is fine. A great thesis can be two sentences. Look at what it says, not how long it is.' },
          { text: 'It only says what every investor already knows', right: true, say: `Right. Everyone knows AI is huge, so buyers have already paid for that: ${c.name}'s P/E is ${pe}, while a typical company's is ${MARKET_PE}. That's what "priced in" means.` },
          { text: `${c.name} isn't really an AI company`, say: `It is: its chips power most AI. The facts are fine. What's missing is anything other investors don't already know.` },
        ]}
        onAnswered={() => setFirst(true)}
      />
      {first && (
        <PickOne
          question="Which rewrite is stronger?"
          options={[
            { text: `"${c.name} is the best AI company and everyone will keep buying its chips, so the stock will keep going up."`, say: 'That still only says what everyone knows. It never says why the price is too low today.' },
            { text: `"Buyers pay about ${pe} times ${c.name}'s profit, so they expect fast growth. I think data-center sales will grow even faster, because big tech companies keep raising what they spend on AI."`, right: true, say: "That one says what the price expects, and why the writer thinks it's wrong. You can check it at the next earnings report." },
          ]}
          onAnswered={onDone}
        />
      )}
    </>
  )
}
