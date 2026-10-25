import { useState } from 'react'
import { Button, Page, TopBar } from '../../components/ui'
import { EXPERIENCE } from '../../data/experience'
import { useGame, type Experience } from '../../state/store'

export function LevelScreen() {
  const { state, go, update } = useGame()
  const [pick, setPick] = useState<Experience | null>(state.experience)
  const chosen = EXPERIENCE.find((e) => e.id === pick)
  return (
    <Page>
      <TopBar back="join" />
      <h1>How much do you know about stocks?</h1>
      <p className="muted">There's no wrong answer. It sets how much the coach explains. You can change it later in your profile.</p>
      <div className="metric-list level-list">
        {EXPERIENCE.map((e) => (
          <button key={e.id} className={`metric ${pick === e.id ? 'on' : ''}`} onClick={() => setPick(e.id)}>
            <b>{e.icon} {e.label}</b>
            <small>{e.detail}</small>
          </button>
        ))}
      </div>
      {chosen && <p className="level-changes pop-in">{chosen.changes}</p>}
      <Button disabled={!pick} onClick={() => { update(() => ({ experience: pick })); go('market') }}>Next</Button>
    </Page>
  )
}
