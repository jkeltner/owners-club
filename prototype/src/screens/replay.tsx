// Time machine replays, all driven by src/data/time_machine.ts. A replay runs
// on its own from the Learn tab (with a coach debrief), or inside a lesson as
// round 2 (`embedded`: no debrief, the lesson's round 3 takes over).
import { useState } from 'react'
import { askCoach } from '../coach/coach'
import { LineChart, MixBar } from '../components/charts'
import { Button, Card, Chip, Page, TopBar } from '../components/ui'
import { scenarios } from '../content'
import { CHOICE_LABEL, START, lastDay, replay, type CheckpointReplay, type Choice, type PickReplay, type ReplayResults } from '../data/time_machine'
import { signedPct, usd } from '../lib/format'
import { DEFAULT_SETTINGS } from '../lib/rules'
import { useGame } from '../state/store'

export function ReplayScreen() {
  const { state } = useGame()
  const r = replay(state.replaySlug ?? '') ?? replay('single-big-tech-2022')!
  return (
    <Page>
      <TopBar back="learn" title="Time machine" />
      {r.kind === 'checkpoints' ? <CheckpointRun key={r.slug} r={r} /> : <PickRun key={r.slug} r={r} />}
    </Page>
  )
}

type Holdings = { risky: number; safe: number } // units

const valueAt = (r: CheckpointReplay, h: Holdings, day: number) => h.risky * r.risky[day] + h.safe * r.safe[day]

// Every trade in a replay pays the game's fee; taxes are left out to keep it short.
function apply(r: CheckpointReplay, h: Holdings, choice: Choice, day: number): Holdings {
  const fee = 1 - DEFAULT_SETTINGS.feeRate
  if (choice === 'buyback') {
    if (h.safe === 0) return h
    return { risky: h.risky + (h.safe * r.safe[day] * fee) / r.risky[day], safe: 0 }
  }
  if (choice === 'hold' || h.risky === 0) return h
  const units = choice === 'trim' ? h.risky / 2 : h.risky
  return { risky: h.risky - units, safe: h.safe + (units * r.risky[day] * fee) / r.safe[day] }
}

const startWith = (r: CheckpointReplay, share = r.startShare): Holdings => ({
  risky: (START * share) / r.risky[0],
  safe: (START * (1 - share)) / r.safe[0],
})

function play(r: CheckpointReplay, choices: Choice[], share?: number) {
  let h = startWith(r, share)
  choices.forEach((c, i) => { h = apply(r, h, c, r.checkpoints[i]) })
  return h
}

const norm = (s: number[]) => s.map((v) => (v / s[0]) * 100)
const ret = (s: number[], to = s.length - 1) => (s[to] / s[0] - 1) * 100

export function CheckpointRun({ r, embedded, onFinish }: { r: CheckpointReplay; embedded?: boolean; onFinish?: () => void }) {
  const { update, mark } = useGame()
  const scenario = scenarios.find((s) => s.slug === r.slug)
  const end = lastDay(r)
  const [phase, setPhase] = useState<'intro' | 'play' | 'reveal'>('intro')
  const [choices, setChoices] = useState<Choice[]>([])

  const step = choices.length
  const day = phase === 'reveal' ? end : r.checkpoints[Math.min(step, r.checkpoints.length - 1)]
  const h = play(r, choices)
  const value = valueAt(r, h, day)
  const riskyShare = (h.risky * r.risky[day]) / value

  const results: ReplayResults = {
    you: valueAt(r, h, end),
    start: START,
    riskyRet: ret(r.risky),
    indexRet: ret(r.index ?? r.risky),
    alternatives: r.alternatives.map((a) => ({ label: a.label, value: valueAt(r, play(r, a.choices, a.share), end) })),
    usd,
  }

  const choose = (c: Choice) => {
    const next = [...choices, c]
    setChoices(next)
    if (next.length === r.checkpoints.length) {
      setPhase('reveal')
      for (const slug of scenario?.concepts ?? []) mark(slug, 'encountered', `time machine: ${r.slug}`)
      update((s) => ({ timeMachineDone: true, replaysDone: s.replaysDone.includes(r.slug) ? s.replaysDone : [...s.replaysDone, r.slug] }))
    }
  }

  const can = (c: Choice) => (c === 'buyback' ? h.safe > 0 : c === 'hold' ? true : h.risky > 0)
  const restart = () => { setPhase('intro'); setChoices([]) }
  const series = r.index ? [norm(r.risky), norm(r.index)] : [norm(r.risky)]

  return (
    <>
      <p className="eyebrow">Time machine · {r.card}</p>
      {phase === 'intro' && (
        <>
          <h1>{r.headline}</h1>
          <Card className="tm-card">
            <p className="tm-blind">{scenario?.blind_description}</p>
            {r.startShare < 1 && (
              <>
                <MixBar parts={[{ label: 'Stock', value: r.startShare, color: 'var(--primary)' }, { label: r.safeLabel, value: 1 - r.startShare, color: 'var(--index)' }]} />
                <div className="legend"><span><i style={{ background: 'var(--primary)' }} />Mystery company {usd(START * r.startShare)}</span><span><i style={{ background: 'var(--index)' }} />{r.safeLabel} {usd(START * (1 - r.startShare))}</span></div>
              </>
            )}
          </Card>
          <p className="muted">{r.how}</p>
          <Button onClick={() => setPhase('play')}>Start</Button>
        </>
      )}

      {phase !== 'intro' && (
        <>
          <h1>{phase === 'reveal' ? "Time's up." : r.checkpointLabels[step]}</h1>
          <Card>
            <LineChart
              series={series}
              colors={['var(--primary)', 'var(--ink-2)']}
              visibleTo={day}
              totalLength={end + 1}
              markers={r.checkpoints}
              height={160}
            />
            <div className="legend">
              <span><i style={{ background: 'var(--primary)' }} />{phase === 'reveal' ? r.revealShort : r.blindLabel}</span>
              {r.index && <span><i style={{ background: 'var(--ink-2)' }} />S&P 500</span>}
            </div>
          </Card>
          <Card className="tm-status">
            <div><small>Your portfolio</small><b>{usd(value)}</b></div>
            <div><small>{r.stakeLabel}</small><b>{Math.round(riskyShare * 100)}%</b></div>
            <div><small>{r.blindLabel} since start</small><b>{signedPct(ret(r.risky, day), 0)}</b></div>
          </Card>
        </>
      )}

      {phase === 'play' && (
        <div className="choice-row">
          {r.choices.map((c) => (
            <Button key={c} kind="secondary" onClick={() => choose(c)} disabled={!can(c)}>{CHOICE_LABEL[c]}</Button>
          ))}
        </div>
      )}

      {phase === 'reveal' && (
        <>
          <Card className="reveal pop-in">
            <p className="eyebrow">The reveal</p>
            <h2>That was {r.revealName}, in {r.revealWhen}.</h2>
            <div className="reveal-grid">
              <div><small>{r.parts ? 'The four together' : r.index ? 'The stock' : 'The market'}</small><b>{signedPct(results.riskyRet, 0)}</b></div>
              <div><small>{r.index ? 'S&P 500' : 'Low to the end'}</small><b>{r.index ? signedPct(results.indexRet, 0) : signedPct((r.risky[end] / Math.min(...r.risky) - 1) * 100, 0)}</b></div>
            </div>
            {r.parts && (
              <div className="reveal-list">
                {r.parts.map((p) => <div key={p.name}><span>{p.name}</span><b>{signedPct(ret(p.series), 0)}</b></div>)}
              </div>
            )}
            {!r.index && <p className="small">The market fell <b>{signedPct((Math.min(...r.risky) / r.risky[0] - 1) * 100, 0)}</b> from the start to its lowest day, then got all the way back by about month {Math.ceil(r.risky.findIndex((v, i) => i > r.risky.indexOf(Math.min(...r.risky)) && v >= r.risky[0]) / 21)}.</p>}
            <div className="reveal-list">
              <div><span>You ({choices.map((c) => CHOICE_LABEL[c].toLowerCase()).join(', ')})</span><b>{usd(results.you)}</b></div>
              {results.alternatives.map((a) => <div key={a.label}><span>{a.label}</span><b>{usd(a.value)}</b></div>)}
            </div>
            <p className="fine">{r.revealNote}</p>
          </Card>
          {embedded
            ? <Button onClick={onFinish}>Next</Button>
            : <Debrief questions={scenario?.debrief_questions ?? []} replies={r.debrief(results)} chips={r.debriefChips} concepts={r.explains} slug={r.slug} onReplay={restart} />}
        </>
      )}
    </>
  )
}

function Debrief({ questions, replies, chips, concepts, slug, onReplay }: {
  questions: string[]; replies: string[][]; chips: string[][]; concepts: string[]; slug: string; onReplay?: () => void
}) {
  const { mark } = useGame()
  const [d, setD] = useState<{ q: number; answers: string[]; replies: string[][]; busy: boolean }>({ q: 0, answers: [], replies: [], busy: false })
  const [draft, setDraft] = useState('')

  const answer = async (text: string) => {
    if (!text.trim() || d.busy) return
    const q = d.q
    setD((x) => ({ ...x, answers: [...x.answers, text], busy: true }))
    setDraft('')
    const facts: Record<string, string> = { questions: String(questions.length), concepts: concepts.join(',') }
    replies.forEach((r, i) => { facts[`reply${i}`] = r.join('|') })
    const res = await askCoach({ mode: 'debrief', playerName: '', history: [], turn: q, facts }, text)
    res.marks?.forEach((m) => mark(m.slug, m.level, `time machine debrief: ${slug}`))
    setD((x) => ({ q: q + 1, answers: x.answers, replies: [...x.replies, res.bubbles], busy: false }))
  }

  return (
    <>
      <h2>Debrief</h2>
      {questions.slice(0, d.q + 1).map((q, i) => (
        <div key={i}>
          <div className="bubble bubble-coach"><span className="coach-face">🧢</span><span>{q}</span></div>
          {d.answers[i] && <div className="bubble bubble-player"><span>{d.answers[i]}</span></div>}
          {d.replies[i]?.map((b, j) => <div key={j} className="bubble bubble-coach"><span>{b}</span></div>)}
        </div>
      ))}
      {d.q < questions.length && !d.busy && (
        <div className="chat-input">
          <div className="chips">
            {(chips[d.q] ?? []).map((c) => <Chip key={c} onClick={() => answer(c)}>{c}</Chip>)}
          </div>
          <div className="compose">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && answer(draft)} placeholder="Your answer" />
            <button className="send" onClick={() => answer(draft)} disabled={!draft.trim()} aria-label="Send">↑</button>
          </div>
        </div>
      )}
      {d.busy && <div className="bubble bubble-coach typing"><span className="coach-face">🧢</span><span className="dots-typing"><i /><i /><i /></span></div>}
      {d.q >= questions.length && onReplay && <Button kind="ghost" onClick={onReplay}>Replay it</Button>}
    </>
  )
}

export function PickRun({ r }: { r: PickReplay }) {
  const { update, mark } = useGame()
  const scenario = scenarios.find((s) => s.slug === r.slug)
  const [picked, setPicked] = useState<string[]>([])
  const [revealed, setRevealed] = useState(false)

  const toggle = (name: string) =>
    setPicked((p) => (p.includes(name) ? p.filter((x) => x !== name) : p.length < r.picks ? [...p, name] : p))

  const mine = r.options.filter((o) => picked.includes(o.name))
  // Equal dollars in each pick.
  const myRet = mine.reduce((a, o) => a + o.ret, 0) / Math.max(1, mine.length)
  const beat = mine.filter((o) => o.ret > r.indexRet).length
  const sorted = [...r.options].sort((a, b) => b.ret - a.ret)
  const maxRet = Math.max(...r.options.map((o) => o.ret))

  const reveal = () => {
    setRevealed(true)
    for (const slug of scenario?.concepts ?? []) mark(slug, 'encountered', `time machine: ${r.slug}`)
    update((s) => ({ timeMachineDone: true, replaysDone: s.replaysDone.includes(r.slug) ? s.replaysDone : [...s.replaysDone, r.slug] }))
  }

  const replies = [[
    `${beat === 0 ? 'None' : beat === mine.length ? 'All' : `${beat} of ${mine.length}`} of your picks beat the index. Of the ten, only ${r.options.filter((o) => o.ret > r.indexRet).length} did.`,
    `The index won because it owned the big winners automatically, without anyone having to guess which ones they'd be. Most professional stock pickers don't beat it over ten years either. That's why every pick in this game is measured against it.`,
  ]]

  return (
    <>
      <p className="eyebrow">Time machine · {r.card}</p>
      <h1>{r.headline}</h1>
      {!revealed ? (
        <>
          <p className="muted">{r.how}</p>
          <div className="pick-list">
            {r.options.map((o, i) => (
              <button key={o.name} className={`pick-option ${picked.includes(o.name) ? 'on' : ''}`} onClick={() => toggle(o.name)}>
                <b>Company {String.fromCharCode(65 + i)}</b>
                <span>{o.blind}</span>
              </button>
            ))}
          </div>
          <div className="sticky-cta">
            <Button disabled={picked.length < r.picks} onClick={reveal}>
              {picked.length < r.picks ? `Pick ${r.picks - picked.length} more` : 'Fast-forward 10 years'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <Card className="reveal pop-in">
            <p className="eyebrow">{r.revealWhen}</p>
            <div className="reveal-grid">
              <div><small>Your three</small><b>{signedPct(myRet, 0)}</b></div>
              <div><small>S&P 500</small><b>{signedPct(r.indexRet, 0)}</b></div>
            </div>
            <p className="small">$10,000 in your three became <b>{usd(START * (1 + myRet / 100))}</b>. In the index, it became <b>{usd(START * (1 + r.indexRet / 100))}</b>.</p>
            <div className="decade-bars">
              {sorted.map((o) => (
                <div key={o.name} className={`decade-row ${picked.includes(o.name) ? 'mine' : ''}`}>
                  <span>{picked.includes(o.name) ? '✓ ' : ''}{o.name}</span>
                  <span className="decade-track"><i style={{ width: `${Math.max(1, (Math.max(0, o.ret) / maxRet) * 100)}%` }} /></span>
                  <b>{signedPct(o.ret, 0)}</b>
                </div>
              ))}
              <div className="decade-row index">
                <span>S&P 500</span>
                <span className="decade-track"><i style={{ width: `${(r.indexRet / maxRet) * 100}%` }} /></span>
                <b>{signedPct(r.indexRet, 0)}</b>
              </div>
            </div>
            <p className="fine">{r.revealNote}</p>
          </Card>
          <Debrief questions={scenario?.debrief_questions ?? []} replies={replies} chips={r.debriefChips} concepts={r.explains} slug={r.slug}
            onReplay={() => { setPicked([]); setRevealed(false) }} />
        </>
      )}
    </>
  )
}
