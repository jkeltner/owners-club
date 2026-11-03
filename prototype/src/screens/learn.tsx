// The Learn tab: where am I (rank), what next (one lesson), and everything
// else (scouting reports, time machine replays, every concept by rank).
import { useState } from 'react'
import { ConceptSheet, Linked } from '../components/terms'
import { Button, Card, LevelDots, Page, Sheet } from '../components/ui'
import { lessonFor, scenarios, type Concept } from '../content'
import { companies, findCompany } from '../data/companies'
import { REPLAYS } from '../data/time_machine'
import { pickWeeklyReplay } from '../lib/weekly_replay'
import { RANKS, appliedIn, isOpen, missingPrereqs, nextToApply, ofLevel, rankIndex, upNext } from '../lib/ranks'
import { useGame } from '../state/store'

const hasReplay = (slug: string) => scenarios.some((s) => s.concepts.includes(slug))

// What "used" means, in one line, wherever the rank rules come up.
const USED_MEANS = 'A thesis is the reason you write when you buy. A scouting report is the same thing for a company you don\'t buy.'

export function LearnScreen() {
  const { state, go, update } = useGame()
  const weekly = pickWeeklyReplay(state.name, [state.pick, ...state.morePicks].filter((p) => !!p))
  const [open, setOpen] = useState<Concept | null>(null)
  // The company chooser for a scouting report. `focus` is the concept the
  // coach walks through first; without one, the coach picks a basic one.
  const [choosing, setChoosing] = useState<{ focus?: Concept } | null>(null)
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
  // Scouting from Learn always goes through the coach: it applies the concept
  // to the company's numbers, then the player writes the report.
  const scoutWithCoach = (ticker: string, focus?: Concept) =>
    go('coach', {
      companyTicker: ticker,
      companyBack: 'learn',
      draft: { thesis: '', prediction: null, amount: 0, scout: true, focus: focus?.slug },
      coachLog: [],
    })
  const chooseFor = (focus?: Concept) => { setOpen(null); setChoosing({ focus: focus ?? target }) }

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
          <p>There are four ranks. You climb by showing you understand businesses, not by making money, so a lucky stock doesn't move you up.</p>
          <RankSteps at={ri} />
          <p>Every rank after Shareholder comes with a few <b>concepts</b>: ideas investors use, like P/E or profit margins. Each concept fills in three dots:</p>
          <ul className="intro-dots">
            <li><Dots n={1} /> <span><b>Seen.</b> It came up in your game, or you tapped it.</span></li>
            <li><Dots n={2} /> <span><b>Learned.</b> You did its lesson or got its check question right.</span></li>
            <li><Dots n={3} /> <span><b>Used.</b> You used it in a <Linked text="thesis" /> or a <Linked text="scouting report" />. {USED_MEANS}</span></li>
          </ul>
          <p>Use every concept of a rank and you move up. Lessons teach you; theses prove you've got it. The fastest way: scout a company with the coach, straight from a concept below.</p>
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
                <p className="small">Use these {pathList.length} concepts in a <Linked text="thesis" /> or <Linked text="scouting report" /> to become {next.name === 'Owner' ? 'an' : 'a'} {next.name}. <b>{used} of {pathList.length} done.</b></p>
                <div className="progress"><span style={{ width: `${(used / pathList.length) * 100}%` }} /></div>
              </>
            )}
          </>
        )}
        <div className="concept-list path-list">{pathList.map(row)}</div>
        {target && ri >= 0 && (
          <>
            <p className="small path-next">Next step: use <b>{target.name.toLowerCase()}</b> in a thesis or scouting report. Tap it above to learn it first, or go straight to using it:</p>
            <Button kind="secondary" onClick={() => chooseFor(target)}>🧢 Scout a company using {target.name.toLowerCase()}</Button>
          </>
        )}
        {!showIntro && <button className="link-btn" onClick={() => setShowIntro(true)}>How do I rank up?</button>}
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
        <p>A <Linked text="thesis" /> on a company you <b>don't</b> buy: what you think will happen and why, plus one prediction. It's checked at earnings and counts for your rank exactly like a real pick, and you can turn it into a pick later. It's the fastest way to rank up.</p>
        <p className="small muted">The coach goes first: it applies a concept to the company's numbers, then you write the report.</p>
        {state.scouts.length > 0 && (
          <div className="scout-mini">
            {state.scouts.map((s) => {
              const c = findCompany(s.ticker)
              return <span key={s.at}>{c?.name ?? s.ticker} · checked in {c?.daysToEarnings ?? '?'} days</span>
            })}
          </div>
        )}
        <Button kind="secondary" onClick={() => chooseFor()}>🧢 Scout a company with the coach</Button>
      </Card>

      <h3 className="sub-head">⏱ Time machine</h3>
      <p className="muted small">Live through real market history in a few minutes. The company and the year stay secret until the end.</p>
      <div className="tm-row">
        {REPLAYS.map((r) => {
          const sc = scenarios.find((s) => s.slug === r.slug)
          const done = state.replaysDone.includes(r.slug)
          const thisWeek = r.slug === weekly.slug
          return (
            <button key={r.slug} className={`tm-tile ${done ? 'done' : ''} ${thisWeek ? 'this-week' : ''}`} onClick={() => go('replay', { replaySlug: r.slug })}>
              {thisWeek && <span className="tm-week">This week's club replay</span>}
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
          ) : (
            <>
              {lessonFor(open.slug) ? (
                <Button onClick={() => { setOpen(null); startLesson(open.slug) }}>
                  {state.lessonsDone.includes(open.slug) ? 'Do the lesson again' : 'Start the lesson'}
                </Button>
              ) : (
                <p className="lock-note">The full lesson for this one is coming.</p>
              )}
              <Button kind="secondary" onClick={() => chooseFor(open)}>🧢 Use it: scout a company with the coach</Button>
              <p className="muted small">{state.concepts[open.slug]?.applied ? "You've used this one already. Another report still counts." : 'The coach walks you through it on a company you pick. Using it in the report fills the third dot.'}</p>
            </>
          )}
        </ConceptSheet>
      )}

      {choosing && (
        <Sheet title={choosing.focus ? `Scout with ${choosing.focus.name.toLowerCase()}` : 'Scout a company'} onClose={() => setChoosing(null)}>
          <p className="muted small">
            {choosing.focus
              ? `Pick a company you don't own. The coach shows you ${choosing.focus.name.toLowerCase()} on its numbers, then you write the report and one prediction.`
              : "Pick one you don't own. The coach goes first, then you write a thesis and one prediction."}
          </p>
          <div className="results">
            {companies.filter((c) => c.ticker !== state.pick?.ticker && !state.morePicks.some((p) => p.ticker === c.ticker)).map((c) => (
              <button key={c.ticker} className="result" onClick={() => { const f = choosing.focus; setChoosing(null); scoutWithCoach(c.ticker, f) }}>
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

// The four ranks top to bottom: what each one takes and how far along you are.
function RankSteps({ at }: { at: number }) {
  const { state } = useGame()
  return (
    <ol className="rank-steps">
      {RANKS.map((r, i) => {
        const n = ofLevel(r.level).length
        const status = i < at ? '✓ Done' : i === at ? "You're here"
          : r.level === 0 ? 'Not yet' : `${appliedIn(state, r.level).length} of ${n} used`
        return (
          <li key={r.name} className={i === at ? 'here' : i < at ? 'past' : ''}>
            <i aria-hidden>{r.icon}</i>
            <span>
              <b>{r.name}</b>{i === RANKS.length - 1 && ' (the top)'}
              <small>{rankRule(r.level, n)}</small>
            </span>
            <em>{status}</em>
          </li>
        )
      })}
    </ol>
  )
}

function rankRule(level: number, n: number) {
  if (level === 0) return 'Make your first pick and write a thesis: why you think it will beat the index.'
  const rule = `Use all ${n} ${RANKS[level].name} concepts in theses (when you buy) or scouting reports (when you don't).`
  return level === 3 ? `${rule} Then make predictions for a whole season (a school year), so the top rank always takes time.` : rule
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
