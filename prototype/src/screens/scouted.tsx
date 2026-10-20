// After saving a scouting report: when it gets checked, and what it used.
import { tagThesis } from '../coach/tagger'
import { Button, Card, Page } from '../components/ui'
import { concept } from '../content'
import { findCompany } from '../data/companies'
import { useGame } from '../state/store'

export function ScoutedScreen() {
  const { state, go } = useGame()
  const s = state.scouts[state.scouts.length - 1]
  const c = findCompany(s?.ticker ?? '') ?? findCompany('KO')!
  const used = s ? tagThesis(s.thesis) : []
  return (
    <Page>
      <p className="eyebrow">🔭 Scouted</p>
      <h1>{c.name}</h1>
      <Card className="countdown">
        <div className="countdown-days">{c.daysToEarnings}</div>
        <div>
          <b>{c.name} reports in {c.daysToEarnings} days.</b>
          <p>We'll check your prediction then, just like a real pick.</p>
        </div>
      </Card>
      {s && (
        <Card className="my-thesis">
          <p className="eyebrow">Your scouting report</p>
          <p className="quote">"{s.thesis}"</p>
          <div className="prediction-pill">🎯 {s.prediction.label}: {s.prediction.unit === '$' ? `$${s.prediction.value.toFixed(2)}` : `${s.prediction.value}%`} or more</div>
          {used.length > 0 ? (
            <div className="used">
              <span className="muted small">You used:</span>
              {used.map((slug) => <span key={slug} className="used-chip">🛠️ {concept(slug).name}</span>)}
            </div>
          ) : (
            <p className="muted small">This one didn't use a concept from your list yet. Try mentioning a number, like the P/E or how fast sales are growing.</p>
          )}
        </Card>
      )}
      <Button onClick={() => go('learn')}>Back to Learn</Button>
      <Button kind="ghost" onClick={() => go('portfolio')}>See it in your portfolio</Button>
    </Page>
  )
}
