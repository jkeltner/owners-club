import { MixBar } from '../../components/charts'
import { Linked } from '../../components/terms'
import { Button, Card, Page, TopBar } from '../../components/ui'
import { tagThesis } from '../../coach/tagger'
import { findCompany } from '../../data/companies'
import { usd } from '../../lib/format'
import { DEFAULT_SETTINGS, STARTING_VALUE, maxPurchase, tradeFee } from '../../lib/rules'
import { useGame } from '../../state/store'

export function SizeScreen() {
  const { state, go, update, mark } = useGame()
  const c = findCompany(state.companyTicker ?? '') ?? findCompany('NVDA')!
  const cap = maxPurchase(STARTING_VALUE)
  const amount = Math.min(state.draft?.amount ?? 1000, cap)
  const fee = tradeFee(amount)
  const setAmount = (a: number) => update((s) => ({ draft: { ...s.draft!, amount: a } }))
  const share = amount / STARTING_VALUE

  const confirm = () => {
    const d = state.draft!
    update(() => ({
      pick: { ticker: c.ticker, amount, fee, thesis: d.thesis, prediction: d.prediction!, at: Date.now() },
      draft: null,
    }))
    // Quizzes teach; theses prove. Only the thesis marks concepts "applied".
    for (const slug of tagThesis(d.thesis)) mark(slug, 'applied', `thesis on ${c.ticker}`)
    go('done')
  }

  return (
    <Page>
      <TopBar back="thesis" title="Size your pick" />
      <h1>How much goes into {c.name}?</h1>
      <p className="muted">The money comes out of your S&P 500 index fund. Whatever you don't move stays there, matching the market.</p>

      <Card className="size-card">
        <div className="size-amount">{usd(amount)}</div>
        <div className="muted">{Math.round(share * 100)}% of your portfolio</div>
        <input
          type="range" min={100} max={cap} step={50} value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          aria-label="Amount to move into the pick"
        />
        <div className="range-ends"><span>$100</span><span>{usd(cap)} max</span></div>
        <MixBar parts={[
          { label: c.name, value: amount, color: 'var(--primary)' },
          { label: 'S&P 500', value: STARTING_VALUE - amount, color: 'var(--index)' },
        ]} />
        <div className="legend">
          <span><i style={{ background: 'var(--primary)' }} />{c.name} {usd(amount)}</span>
          <span><i style={{ background: 'var(--index)' }} />S&P 500 {usd(STARTING_VALUE - amount)}</span>
        </div>
      </Card>

      <Card className="rules-card">
        <div className="rule"><span>🧢</span><span><b>{DEFAULT_SETTINGS.capAtPurchase * 100}% limit.</b> No single pick can be more than {usd(cap)} (a quarter of your money) when you buy it, so one surprise can't sink you.</span></div>
        <div className="rule"><span>🧾</span><span><b>Fee: {usd(fee, true)}</b> ({DEFAULT_SETTINGS.feeRate * 100}% of the amount). Real trading has costs too, and they add up if you trade a lot.</span></div>
        <div className="rule"><span>🔒</span><span><b>You can't sell it for 3 months.</b> That's long enough to see at least one <Linked text="earnings report" />, when the company shares its results. Your index money can move anytime.</span></div>
        <div className="rule"><span>🌙</span><span><b>Buys at <Linked text="today's close" />.</b> Your price is the last price of the day, so there's no reason to watch the market all day.</span></div>
      </Card>

      <div className="sticky-cta">
        <Button onClick={confirm}>Buy {usd(amount)} of {c.name}</Button>
      </div>
    </Page>
  )
}
