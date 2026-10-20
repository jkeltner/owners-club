// A lesson: three rounds on one concept (see content/lessons.yaml).
// 1. See it: an everyday example. 2. Try it: a real company, in one of six
// formats. 3. Your turn: a coach conversation with one push back.
// Finishing marks the concept "explained"; only a thesis marks it "applied".
import { useEffect, useState } from 'react'
import { CoachChat } from '../components/coach_chat'
import { CoachSays, PickOne } from '../components/lesson_parts'
import { Button, Card, Page, TopBar } from '../components/ui'
import { concept, fill, lessonFor, scenarios, type Lesson } from '../content'
import { SORT_TICKERS, findCompany, netMargin, peRatio, type Company } from '../data/companies'
import { replay, type CheckpointReplay } from '../data/time_machine'
import { useGame, type GameState } from '../state/store'
import { SimulateLuck, SortMargins, SpotFlaw, TalkPE, WhatIfTaxes } from './lessons/rounds'
import { CheckpointRun } from './replay'

const ROUNDS = ['See it', 'Try it', 'Your turn']

// The two companies the P/E lesson compares: the player's pick if it has a
// high P/E, else Nvidia, against a company near the market's P/E.
function peCompanies(s: GameState): [Company, Company] {
  const own = findCompany(s.pick?.ticker ?? '')
  const a = own && (peRatio(own) ?? 0) >= 30 ? own : findCompany('NVDA')!
  return [a, findCompany(a.ticker === 'KO' ? 'MCD' : 'KO')!]
}

// Numbers for the {placeholders} in each lesson, plus a company to scout after.
function lessonFacts(l: Lesson, s: GameState): Record<string, string> {
  const cents = (c: Company) => `${Math.round(netMargin(c))}¢`
  switch (l.concept) {
    case 'pe-ratio': {
      const [a, b] = peCompanies(s)
      const pe = peRatio(a)!
      return { company: a.name, pe: pe.toFixed(0), company_b: b.name, pe_b: peRatio(b)!.toFixed(0), pe5: (pe / 1.1 ** 5).toFixed(0), scout: b.ticker }
    }
    case 'profit-margins': {
      const sorted = SORT_TICKERS.map((t) => findCompany(t)!).sort((x, y) => netMargin(x) - netMargin(y))
      const low = sorted[0]
      const high = sorted[sorted.length - 1]
      return { low: low.name, low_margin: cents(low), high: high.name, high_margin: cents(high), scout: low.ticker }
    }
    case 'already-priced-in': {
      const c = findCompany('NVDA')!
      return { company: c.name, pe: peRatio(c)!.toFixed(0), scout: 'NFLX' }
    }
    default:
      return { scout: 'KO' }
  }
}

export function LessonScreen() {
  const { state, go, mark, update } = useGame()
  const l = lessonFor(state.lessonSlug ?? '') ?? lessonFor('pe-ratio')!
  const c = concept(l.concept)
  const facts: Record<string, string> = { ...lessonFacts(l, state), slug: l.concept }
  const [round, setRound] = useState(0)
  const [ready, setReady] = useState(false)
  const [finished, setFinished] = useState(false)

  useEffect(() => { window.scrollTo({ top: 0 }) }, [round, finished])
  useEffect(() => { mark(l.concept, 'encountered', 'started lesson') }, [l.concept, mark])

  const next = () => { setRound((r) => r + 1); setReady(false) }
  const finish = () => {
    mark(l.concept, 'explained', 'lesson')
    update((s) => ({ lessonsDone: s.lessonsDone.includes(l.concept) ? s.lessonsDone : [...s.lessonsDone, l.concept] }))
    setFinished(true)
  }
  const scoutCo = findCompany(facts.scout)!

  return (
    <Page>
      <TopBar back={state.lessonBack} title={c.name} />
      <div className="rounds" aria-label="Lesson rounds">
        {ROUNDS.map((name, i) => (
          <span key={name} className={i < round || finished ? 'done' : i === round ? 'on' : ''}>{i + 1}. {name}</span>
        ))}
      </div>

      {finished ? (
        <Card className="lesson-done pop-in">
          <p className="eyebrow">💡 Learned</p>
          <h2>{c.name}</h2>
          <p>{c.kid_explanation}</p>
          {c.in_a_thesis && <div className="term-box"><b>In a thesis, it sounds like</b><p>"{c.in_a_thesis}"</p></div>}
          <p className="small"><b>To count it for your rank, use it in a thesis.</b> A scouting report counts too, and you don't have to buy anything.</p>
          <Button onClick={() => go('company', { companyTicker: scoutCo.ticker, companyBack: 'learn' })}>Scout {scoutCo.name}</Button>
          <Button kind="ghost" onClick={() => go(state.lessonBack)}>{state.lessonBack === 'learn' ? 'Back to Learn' : 'Back to where you were'}</Button>
        </Card>
      ) : round === 0 ? (
        <>
          <CoachSays text={fill(l.see_it.setup, facts)} />
          <PickOne question={fill(l.see_it.question, facts)} options={l.see_it.choices.map((o) => ({ ...o, say: fill(o.say, facts) }))} onAnswered={() => setReady(true)} />
          {ready && <Button onClick={next}>Next: try it</Button>}
        </>
      ) : round === 1 ? (
        <>
          <CoachSays text={fill(l.try_it.intro, facts)} />
          <TryIt l={l} onDone={() => setReady(true)} onFinishReplay={next} />
          {ready && l.format !== 'time_machine' && <Button onClick={next}>Next: your turn</Button>}
        </>
      ) : (
        <>
          <CoachChat mode="lesson" facts={facts} voiceSample="I think it depends on how fast they grow" onDone={() => setReady(true)} />
          {ready && <Button onClick={finish}>Finish the lesson</Button>}
        </>
      )}
    </Page>
  )
}

function TryIt({ l, onDone, onFinishReplay }: { l: Lesson; onDone: () => void; onFinishReplay: () => void }) {
  const { state } = useGame()
  switch (l.format) {
    case 'talk': {
      const [a, b] = peCompanies(state)
      return <TalkPE a={a} b={b} onDone={onDone} />
    }
    case 'time_machine': {
      const r = replay(scenarios.find((x) => x.concepts.includes(l.concept))?.slug ?? '') as CheckpointReplay
      return <CheckpointRun r={r} embedded onFinish={onFinishReplay} />
    }
    case 'sort':
      return <SortMargins onDone={onDone} />
    case 'what_if':
      return <WhatIfTaxes onDone={onDone} />
    case 'simulate':
      return <SimulateLuck onDone={onDone} />
    case 'flaw':
      return <SpotFlaw c={findCompany('NVDA')!} onDone={onDone} />
  }
}
