// The Learn tab: where am I (rank), what next (one lesson), and everything
// else (scouting reports, time machine replays, every concept by rank).
import { useState } from 'react'
import { ConceptSheet } from '../components/terms'
import { Button, Card, LevelDots, Page, Sheet } from '../components/ui'
import { lessonFor, scenarios, type Concept } from '../content'
import { companies, findCompany } from '../data/companies'
import { REPLAYS } from '../data/time_machine'
import { RANKS, appliedIn, isOpen, missingPrereqs, nextToApply, ofLevel, rankIndex, upNext } from '../lib/ranks'
import { useGame } from '../state/store'

const hasReplay = (slug: string) => scenarios.some((s) => s.concepts.includes(slug))

export function LearnScreen() {
  const { state, go, update } = useGame()
  const [open, setOpen] = useState<Concept | null>(null)
  const [choosing, setChoosing] = useState(false)
  const ri = rankIndex(state)
  const rank = ri >= 0 ? RANKS[ri] : null
  const next = RANKS[ri + 1]
  const target = nextToApply(state)
  const suggestion = upNext(state)

  const startLesson = (slug: string) => go('lesson', { lessonSlug: slug, lessonBack: 'learn' })
  const tapConcept = (c: Concept) => {
    if (lessonFor(c.slug) && isOpen(state, c) && !state.lessonsDone.includes(c.slug)) startLesson(c.slug)
    else setOpen(c)
  }
  const scout = (ticker: string) => go('company', { companyTicker: ticker, companyBack: 'learn' })

  const lvl = Math.max(1, Math.min(3, ri + 1))
  const pathList = ofLevel(lvl)
  const used = appliedIn(state, lvl).length
  const [showIntro, setShowIntro] = useState(!state.learnIntroSeen)
  const dismissIntro = () => { setShowIntro(false); update(() => ({ learnIntroSeen: true })) }
  const row = (c: Concept) => <ConceptRow key={c.slug} c={c} onTap={() => tapConcept(c)} />

  return (
    <Page>
      <h1>Learn</h1>

      {showIntro && (
        <Card className="learn-intro">
          <p className="eyebrow">How leveling up works</p>
          <Ladder at={ri} />
          <p>Every rank comes with a few <b>concepts</b>: ideas investors use, like P/E or profit margins. Each concept fills in three dots:</p>
          <ul className="intro-dots">
            <li><Dots n={1} /> <span><b>Seen.</b> It came up in your game, or you tapped it.</span></li>
            <li><Dots n={2} /> <span><b>Learned.</b> You did its lesson or got its check question right.</span></li>
            <li><Dots n={3} /> <span><b>Used.</b> You used it in a thesis or a scouting report.</span></li>
          </ul>
          <p>Use every concept of a rank in a thesis and you move up. Lessons teach you; theses prove you've got it.</p>
          <Button onClick={dismissIntro}>Got it</Button>
        </Card>
      )}

      <Card className="learn-path">
        {!showIntro && <Ladder at={ri} />}
        {ri < 0 ? (
          <p><b>Make your first pick with a thesis</b> to become a Shareholder.</p>
        ) : (
          <>
            <h3>{rank!.icon} You're a {rank!.name}{next ? <span>. Next: {next.icon} {next.name}</span> : null}</h3>
            {next && (
              <>
                <p className="small">Use these {pathList.length} concepts in a thesis or scouting report to become {next.name === 'Owner' ? 'an' : 'a'} {next.name}. <b>{used} of {pathList.length} done.</b></p>
                <div className="progress"><span style={{ width: `${(used / pathList.length) * 100}%` }} /></div>
              </>
            )}
          </>
        )}
        <div className="concept-list path-list">{pathList.map(row)}</div>
        {target && ri >= 0 && <p className="small path-next">Next step: use <b>{target.name.toLowerCase()}</b> in a thesis. Tap it to learn it first.</p>}
        {!showIntro && <button className="link-btn" onClick={() => setShowIntro(true)}>How ranks work</button>}
      </Card>

      {suggestion && (
        <Card className="up-next" onClick={() => startLesson(suggestion.slug)}>
          <p className="eyebrow">Up next · {lessonFor(suggestion.slug)!.minutes} min</p>
          <b>{suggestion.name}</b>
          <p className="small">
            {state.concepts[suggestion.slug]?.encountered
              ? "It's already come up in your game. Want the full version?"
              : 'Three quick rounds: an example, a real company, then your take.'}
          </p>
          <span className="go" aria-hidden>▸</span>
        </Card>
      )}

      <h2>Practice</h2>
      <Card className="scout-card">
        <p className="eyebrow">🔭 Scouting report</p>
        <p>Write a thesis on any company without buying it. It gets scored at earnings like a real pick, and it counts for your rank.</p>
        {state.scouts.length > 0 && (
          <div className="scout-mini">
            {state.scouts.map((s) => {
              const c = findCompany(s.ticker)
              return <span key={s.at}>{c?.name ?? s.ticker} · checked in {c?.daysToEarnings ?? '?'} days</span>
            })}
          </div>
        )}
        <Button kind="secondary" onClick={() => setChoosing(true)}>Scout a company</Button>
      </Card>

      <h3 className="sub-head">⏱ Time machine</h3>
      <p className="muted small">Live through real market history in a few minutes. The company and the year stay secret until the end.</p>
      <div className="tm-row">
        {REPLAYS.map((r) => {
          const sc = scenarios.find((s) => s.slug === r.slug)
          const done = state.replaysDone.includes(r.slug)
          return (
            <button key={r.slug} className={`tm-tile ${done ? 'done' : ''}`} onClick={() => go('replay', { replaySlug: r.slug })}>
              <b>{r.card}</b>
              <small>{sc?.concepts.map((s) => conceptName(s)).join(' · ')}</small>
              {done && <span className="tm-done">✓ Done</span>}
            </button>
          )
        })}
      </div>

      <h2>All concepts</h2>
      <div className="dots-key">
        <span><Dots n={1} /> Seen</span>
        <span><Dots n={2} /> Learned</span>
        <span><Dots n={3} /> Used in a thesis</span>
        <span>⏱ Has a replay</span>
      </div>
      {RANKS.slice(1).filter((r) => r.level !== lvl).map((r) => (
        <div key={r.name}>
          <h3 className="level-head">{r.icon} {r.name} <span>{appliedIn(state, r.level).length} of {ofLevel(r.level).length} used</span></h3>
          {r.level === 3 && !state.unlockAll && (
            <p className="muted small">Each one opens once you've used the concepts it builds on in a thesis. Until then you can peek.</p>
          )}
          <Card className="concept-list">{ofLevel(r.level).map(row)}</Card>
        </div>
      ))}
      {!state.unlockAll && (
        <Button kind="ghost" onClick={() => update(() => ({ unlockAll: true }))}>Prototype: open every lesson</Button>
      )}

      {open && (
        <ConceptSheet c={open} onClose={() => setOpen(null)}>
          {!isOpen(state, open) ? (
            <p className="lock-note">🔒 The lesson opens once you've used {missingPrereqs(state, open).map((p) => p.name.toLowerCase()).join(' and ')} in a thesis.</p>
          ) : lessonFor(open.slug) ? (
            <Button onClick={() => { setOpen(null); startLesson(open.slug) }}>
              {state.lessonsDone.includes(open.slug) ? 'Do the lesson again' : 'Start the lesson'}
            </Button>
          ) : (
            <p className="lock-note">The full lesson for this one is coming.</p>
          )}
        </ConceptSheet>
      )}

      {choosing && (
        <Sheet title="Scout a company" onClose={() => setChoosing(false)}>
          <p className="muted small">Pick one you don't own. You'll write a thesis and one prediction.</p>
          <div className="results">
            {companies.filter((c) => c.ticker !== state.pick?.ticker).map((c) => (
              <button key={c.ticker} className="result" onClick={() => { setChoosing(false); scout(c.ticker) }}>
                <span className="tick">{c.ticker}</span>
                <span><b>{c.name}</b><small>{c.oneLiner}</small></span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </Page>
  )
}

// The four ranks in a row, with the player's current one highlighted.
function Ladder({ at }: { at: number }) {
  return (
    <div className="ladder">
      {RANKS.map((r, i) => (
        <span key={r.name} className={i === at ? 'here' : i < at ? 'past' : ''}>
          <i>{r.icon}</i>{r.name}
        </span>
      ))}
    </div>
  )
}

const STATUS = { applied: 'Used in a thesis ✓', explained: 'Learned, not used yet', encountered: 'Seen', none: 'Not started' }

function ConceptRow({ c, onTap }: { c: Concept; onTap: () => void }) {
  const { state } = useGame()
  const locked = !isOpen(state, c)
  const lesson = lessonFor(c.slug)
  const p = state.concepts[c.slug]
  const status = STATUS[p?.applied ? 'applied' : p?.explained ? 'explained' : p?.encountered ? 'encountered' : 'none']
  const detail = locked ? `Needs: ${missingPrereqs(state, c).map((x) => x.name).join(', ')}`
    : state.lessonsDone.includes(c.slug) ? 'lesson done'
      : lesson ? `${lesson.minutes} min lesson` : 'lesson coming'
  return (
    <button className={`concept-row ${p ? '' : 'dim'}`} onClick={onTap}>
      <span className="concept-name">
        {locked && '🔒 '}{c.name}{hasReplay(c.slug) && ' ⏱'}
        <small>{locked ? detail : `${status} · ${detail}`}</small>
      </span>
      <LevelDots slug={c.slug} />
    </button>
  )
}

function conceptName(slug: string) {
  const c = [1, 2, 3].flatMap(ofLevel).find((x) => x.slug === slug)
  return c?.name ?? slug
}

function Dots({ n }: { n: number }) {
  return <span className="dots">{[0, 1, 2].map((i) => <span key={i} className={i < n ? 'on' : ''} />)}</span>
}
