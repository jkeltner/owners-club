import { useState } from 'react'
import { CoachChat } from '../../components/coach_chat'
import { Button, Page, TopBar } from '../../components/ui'
import { findCompany } from '../../data/companies'
import { useGame } from '../../state/store'

export function CoachScreen() {
  const { state, go, update } = useGame()
  const c = findCompany(state.companyTicker ?? '') ?? findCompany('NVDA')!
  const [done, setDone] = useState(false)
  // A scouting report from the Learn tab: the coach walks one concept through
  // this company's numbers first (draft.focus), then hands over to the report.
  const scout = !!state.draft?.scout
  return (
    <Page className="coach-screen">
      <TopBar back={scout ? state.companyBack : 'company'} title={scout ? `Scouting ${c.name}` : `Coach · ${c.name}`} />
      <CoachChat
        mode={scout ? 'scout' : 'pick'}
        company={c}
        facts={scout ? { focus: state.draft?.focus ?? '' } : undefined}
        voiceSample={scout ? `More likely, its sales are still growing fast` : c.ai ? 'AI is gonna be huge and everybody needs their chips' : `I use ${c.name} all the time and so do my friends`}
        onDone={(log) => { update(() => ({ coachLog: log })); setDone(true) }}
      />
      {done && (
        <div className="sticky-cta pop-in">
          <Button onClick={() => go('thesis')}>{scout ? 'Write my scouting report' : 'Write my thesis'}</Button>
        </div>
      )}
    </Page>
  )
}
