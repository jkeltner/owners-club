import { useState } from 'react'
import { CoachChat } from '../components/coach_chat'
import { Button, Card, Page, TopBar } from '../components/ui'
import { demoLots, demoPick } from '../data/demo_season'
import { usd } from '../lib/format'
import { DEFAULT_SETTINGS, daysUntilLongTerm, keepIfSold, tradeFee } from '../lib/rules'
import { useGame } from '../state/store'

export function SellScreen() {
  const { state, update, mark } = useGame()
  const lot = demoLots(demoPick(state.pick?.ticker)).find((l) => l.ticker === 'COST')!
  const wait = daysUntilLongTerm(lot)
  const keepNow = keepIfSold(lot, DEFAULT_SETTINGS.shortTermTaxRate)
  const keepLater = keepIfSold(lot, DEFAULT_SETTINGS.longTermTaxRate)
  const fee = tradeFee(lot.value)
  const [asking, setAsking] = useState(false)
  const [finished, setFinished] = useState(false)

  return (
    <Page>
      <TopBar back="portfolio" title={`Sell ${lot.name}?`} />
      <p className="muted">Bought {Math.round(lot.daysHeld / 30)} months ago for {usd(lot.cost)}. Worth {usd(lot.value)} today: a {usd(lot.value - lot.cost)} gain.</p>

      <div className="sell-compare">
        <Card className="sell-option">
          <small>Sell now</small>
          <div className="keep">{usd(keepNow)}</div>
          <p>you keep</p>
          <span className="tag">40% tax on the gain: {usd(lot.value - lot.cost - (keepNow - lot.cost))}</span>
        </Card>
        <Card className="sell-option later">
          <small>Wait {wait} more days</small>
          <div className="keep">{usd(keepLater)}</div>
          <p>you keep</p>
          <span className="tag">20% tax on the gain: {usd(lot.value - keepLater)}</span>
        </Card>
      </div>
      <p className="muted small center">If the price stays the same. Either way there's a {usd(fee, true)} trading fee.</p>

      {!asking && !state.soldDemo && (
        <div className="choice-row">
          <Button kind="secondary" onClick={() => { update(() => ({ soldDemo: 'waited' })); mark('costs-and-taxes', 'encountered', 'chose to wait') }}>Wait</Button>
          <Button onClick={() => setAsking(true)}>Sell now</Button>
        </div>
      )}
      {asking && !state.soldDemo && (
        <CoachChat
          mode="sell"
          facts={{ extraTax: usd(keepLater - keepNow), daysToWait: String(wait) }}
          voiceSample="I think it might drop after earnings"
          onDone={() => setFinished(true)}
        />
      )}
      {asking && finished && !state.soldDemo && (
        <div className="choice-row pop-in">
          <Button kind="secondary" onClick={() => { setAsking(false); update(() => ({ soldDemo: 'waited' })) }}>Actually, wait</Button>
          <Button onClick={() => update(() => ({ soldDemo: 'sold' }))}>Sell now</Button>
        </div>
      )}
      {state.soldDemo && (
        <Card className="result-card pop-in">
          {state.soldDemo === 'sold'
            ? <p>The sale goes through at today's closing price. You keep about <b>{usd(keepNow - fee, true)}</b> after tax and fee, and it goes back into your index holding.</p>
            : <p>Holding. In {wait} days your tax rate on this gain drops to 20%. We'll remind you.</p>}
          <Button kind="ghost" onClick={() => update(() => ({ soldDemo: null }))}>Try the other choice</Button>
        </Card>
      )}
    </Page>
  )
}
