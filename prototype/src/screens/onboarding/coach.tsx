import { useState } from 'react'
import { CoachChat } from '../../components/coach_chat'
import { Button, Page, TopBar } from '../../components/ui'
import { findCompany } from '../../data/companies'
import { useGame } from '../../state/store'

export function CoachScreen() {
  const { state, go, update } = useGame()
  const c = findCompany(state.companyTicker ?? '') ?? findCompany('NVDA')!
  const [done, setDone] = useState(false)
  return (
    <Page className="coach-screen">
      <TopBar back="company" title={`Coach · ${c.name}`} />
      <CoachChat
        mode="pick"
        company={c}
        voiceSample={c.ai ? 'AI is gonna be huge and everybody needs their chips' : `I use ${c.name} all the time and so do my friends`}
        onDone={(log) => { update(() => ({ coachLog: log })); setDone(true) }}
      />
      {done && (
        <div className="sticky-cta pop-in">
          <Button onClick={() => go('thesis')}>Write my thesis</Button>
        </div>
      )}
    </Page>
  )
}
