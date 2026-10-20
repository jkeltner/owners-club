import { useEffect } from 'react'
import { PeScale, PriceChart } from '../../components/charts'
import { Linked } from '../../components/terms'
import { Button, Card, FakeDataNote, Page, Stat, TopBar } from '../../components/ui'
import { MARKET_PE, lens, sectorPlural } from '../../content'
import { findCompany, marketCapB, netMargin, peRatio, yearReturn, yearSeries } from '../../data/companies'
import { lensValues } from '../../data/lens_metrics'
import { bigUsd, signedPct, usd } from '../../lib/format'
import { useGame } from '../../state/store'

export function CompanyScreen() {
  const { state, go, mark } = useGame()
  const c = findCompany(state.companyTicker ?? '') ?? findCompany('NVDA')!
  const l = lens(c.lens)
  const pe = peRatio(c)
  const values = lensValues(c)
  const lensRows = l ? [l.look_first, ...l.then] : []

  useEffect(() => {
    mark('market-cap-vs-share-price', 'encountered', `viewed ${c.ticker}`)
    mark('revenue-vs-earnings', 'encountered', `viewed ${c.ticker}`)
    if (l) mark('sector-yardsticks', 'encountered', `viewed ${c.ticker} lens`)
  }, [c.ticker, l, mark])

  return (
    <Page>
      <TopBar back={state.companyBack} title={c.ticker} />
      <h1 className="co-name">{c.name}</h1>
      <p className="muted">{c.oneLiner}</p>

      <Card>
        <div className="price-row">
          <span className="price">{usd(c.price, true)}</span>
          <span className="price-sub">for one share, at <Linked text="yesterday's close" /></span>
        </div>
        <PriceChart series={yearSeries(c)} format={(n) => `$${Math.round(n).toLocaleString('en-US')}`} />
        <p className="muted small">{signedPct(yearReturn(c))} over the past year. Prices update once a day.</p>
      </Card>

      <Card className="stats">
        <Stat label="Whole company" value={bigUsd(marketCapB(c))} conceptSlug="market-cap-vs-share-price" sub="market cap" />
        <Stat label="P/E" value={pe === null ? 'n/a' : `${pe.toFixed(0)}x`} conceptSlug="pe-ratio" sub={pe === null ? 'no profits yet' : `$${pe.toFixed(0)} per $1 of profit`} />
        <Stat label="Revenue" value={bigUsd(c.revenueB)} conceptSlug="revenue-vs-earnings" sub={`${signedPct(c.revenueGrowth, 0)} vs. last year`} />
        <Stat label="Earnings (profit)" value={bigUsd(c.earningsB)} conceptSlug="revenue-vs-earnings" sub={c.earningsB > 0 ? `keeps ${netMargin(c).toFixed(0)}¢ of each $1 of sales` : 'lost money last year'} />
      </Card>

      <Card className="pe-card">
        {pe === null ? (
          <>
            <h3>Why there's no <Linked text="P/E" /></h3>
            <p className="small">{c.name} lost money last year, so there's no profit to divide by. For a company like this, look at whether sales are growing and whether the losses are shrinking.</p>
          </>
        ) : (
          <>
            <h3>Is a <Linked text="P/E" /> of {pe.toFixed(0)} high?</h3>
            <PeScale pe={pe} market={MARKET_PE} range={l?.typical_pe} sector={sectorPlural(c.lens)} />
            <p className="small">
              Plain math: if {c.name}'s profits never grew, it would take <b>{pe.toFixed(0)} years</b> of profits to add up to what you pay.{' '}
              {pe > MARKET_PE * 1.3
                ? 'Buyers pay that much because they expect profits to grow a lot.'
                : pe < MARKET_PE * 0.8
                  ? 'Buyers are paying less than for a typical company: they expect less growth, or see more risk.'
                  : "That's close to a typical company."}
            </p>
          </>
        )}
      </Card>

      {l && (
        <Card className="lens">
          <p className="eyebrow">For {l.kind.toLowerCase()}, what matters</p>
          {lensRows.map((label, i) => (
            <div key={label} className={i <= 1 ? 'lens-section' : ''}>
              {i <= 1 && <span className={`lens-tag ${i === 0 ? 'first' : ''}`}>{i === 0 ? 'Look at first' : 'Then'}</span>}
              <div className="lens-metric">
                <span><Linked text={label} /></span>
                {values[i] && <span className="lens-value">{values[i].value}{values[i].sub && <small>{values[i].sub}</small>}</span>}
              </div>
            </div>
          ))}
          <div className="lens-section">
            <span className="lens-tag careful">Careful with</span>
            <p className="small"><Linked text={l.careful_with} /></p>
          </div>
        </Card>
      )}

      <Card className="earnings-note">
        <span>📅</span>
        <span><Linked text={`${c.name} reports earnings in`} /> <b>{c.daysToEarnings} days</b>. That's when your prediction gets checked.</span>
      </Card>

      <div className="sticky-cta">
        {state.pick ? (
          <div className="cta-pair">
            <Button kind="secondary" onClick={() => go('thesis', { draft: { thesis: '', prediction: null, amount: 0, scout: true } })}>🔭 Scout it</Button>
            <Button onClick={() => go('coach', { draft: { thesis: '', prediction: null, amount: 1000 }, coachLog: [] })}>Make a pick</Button>
          </div>
        ) : (
          <Button onClick={() => go('coach', { draft: { thesis: '', prediction: null, amount: 1000 }, coachLog: [] })}>Make a pick</Button>
        )}
      </div>
      <FakeDataNote />
    </Page>
  )
}
