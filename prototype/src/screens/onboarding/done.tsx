import { Button, Card, Page } from '../../components/ui'
import { tagThesis } from '../../coach/tagger'
import { concept } from '../../content'
import { findCompany } from '../../data/companies'
import { usd } from '../../lib/format'
import { useGame } from '../../state/store'

export function DoneScreen() {
  const { state, go } = useGame()
  const pick = state.pick
  const c = findCompany(pick?.ticker ?? '') ?? findCompany('NVDA')!
  const p = pick?.prediction
  return (
    <Page className="done-screen">
      <div className="rank-reveal">
        <div className="rank-badge">
          <span className="rank-icon">📜</span>
        </div>
        <p className="eyebrow">Rank earned</p>
        <h1 className="rank-name">Shareholder</h1>
        <p className="muted">You made a pick with a real reason. Next up: Owner.</p>
      </div>

      <Card className="countdown">
        <div className="countdown-days">{c.daysToEarnings}</div>
        <div>
          <b>{c.name} reports in {c.daysToEarnings} days.</b>
          <p>We'll see if you were right.</p>
        </div>
      </Card>

      {pick && p && (
        <Card className="my-thesis">
          <p className="eyebrow">Your thesis · {usd(pick.amount)} of {c.ticker}</p>
          <p className="quote">"{pick.thesis}"</p>
          <div className="prediction-pill">🎯 {p.label}: {p.unit === '$' ? `$${p.value.toFixed(2)}` : `${p.value}%`} or more</div>
          {tagThesis(pick.thesis).length > 0 && (
            <div className="used">
              <span className="muted small">You used:</span>
              {tagThesis(pick.thesis).map((slug) => <span key={slug} className="used-chip">🛠️ {concept(slug).name}</span>)}
            </div>
          )}
          <p className="muted small">Your buy goes through at today's closing price. Your thesis is now in the club feed.</p>
        </Card>
      )}

      <Button onClick={() => go('feed')}>See it in the club</Button>
    </Page>
  )
}
