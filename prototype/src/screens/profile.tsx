import { Avatar, Button, Card, Page } from '../components/ui'
import { CLUB_NAME } from '../data/club'
import { RANKS, rankIndex } from '../lib/ranks'
import { DEFAULT_SETTINGS } from '../lib/rules'
import { useGame } from '../state/store'

export function ProfileScreen() {
  const { state, reset, go } = useGame()
  const ri = rankIndex(state)
  const rank = ri >= 0 ? RANKS[ri] : null

  return (
    <Page>
      <div className="profile-head">
        <Avatar emoji={state.avatar} size={72} you />
        <div>
          <h1>{state.name || 'You'}</h1>
          <p className="muted">{CLUB_NAME}</p>
        </div>
      </div>

      <Card className="rank-card" onClick={() => go('learn')}>
        <div className="rank-mini">{rank?.icon ?? '🌱'}</div>
        <div>
          <small>Rank</small>
          <b>{rank?.name ?? 'Visitor'}</b>
        </div>
        <span className="go" aria-hidden>▸</span>
      </Card>
      <p className="muted small">Your concepts, lessons and what's next for your rank are in the Learn tab.</p>

      <h2>Club rules</h2>
      <Card className="rules-mini">
        <span>Max {DEFAULT_SETTINGS.capAtPurchase * 100}% per pick</span>
        <span>Hold each pick at least 3 months</span>
        <span>{DEFAULT_SETTINGS.feeRate * 100}% fee per trade</span>
        <span>{DEFAULT_SETTINGS.shortTermTaxRate * 100}% tax under 6 months, {DEFAULT_SETTINGS.longTermTaxRate * 100}% after</span>
      </Card>

      <Button kind="ghost" onClick={() => { if (confirmReset()) reset() }}><span className="profile-reset-hint">Restart the prototype</span></Button>
    </Page>
  )
}

// Inline confirm instead of window.confirm, which blocks some test harnesses.
let armed = 0
function confirmReset() {
  const now = Date.now()
  if (now - armed < 3000) return true
  armed = now
  const el = document.querySelector('.profile-reset-hint')
  if (el) el.textContent = 'Tap again to restart'
  return false
}
