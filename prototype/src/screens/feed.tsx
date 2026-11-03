import { useState } from 'react'
import { Avatar, Button, Card, Page } from '../components/ui'
import { BuyersExpect, Linked } from '../components/terms'
import { concept, lens } from '../content'
import { CLUB_NAME, friendHoldings, friendTheses, friends, bellHolder, lastWeekReplay, SP500, weeklyReplayPlayed, type Thesis } from '../data/club'
import { companies, findCompany } from '../data/companies'
import { newListings } from '../data/new_listings'
import { replay } from '../data/time_machine'
import { signedPct, usd } from '../lib/format'
import { ownCalls, recentResults, upcomingShowdowns } from '../lib/showdown'
import { pickWeeklyReplay } from '../lib/weekly_replay'
import { useGame, type Pick } from '../state/store'

export function FeedScreen() {
  const { state, update, go } = useGame()
  const [tab, setTab] = useState<'feed' | 'chat'>('feed')
  const [msg, setMsg] = useState('')
  const bell = bellHolder()
  const jordan = friends.find((f) => f.id === 'jordan')!
  const [open, setOpen] = useState<string | null>(null)

  // The player's own picks, newest first, as thesis cards like everyone else's.
  const myPicks: Pick[] = [state.pick, ...state.morePicks].filter((p): p is Pick => !!p)
  const mine: Thesis[] = myPicks.map((p, i) => ({
    id: i === 0 ? 'mine' : `mine-${p.ticker}`, who: `${state.name} (you)`, avatar: state.avatar, ticker: p.ticker,
    companyName: findCompany(p.ticker)?.name ?? p.ticker, action: 'bought' as const, amount: p.amount,
    why: p.thesis,
    prediction: `${p.prediction.label}: ${p.prediction.unit === '$' ? `$${p.prediction.value.toFixed(2)}` : `${p.prediction.value}%`} or more`,
    daysAgo: 0, comments: i === 0 ? [{ who: 'Alex', text: 'ok but what if it’s already priced in 👀' }] : [],
  })).reverse()

  const send = () => {
    if (!msg.trim()) return
    update((s) => ({ chat: [...s.chat, { who: s.name, avatar: s.avatar, text: msg.trim() }] }))
    setMsg('')
  }

  return (
    <Page>
      <p className="eyebrow">{CLUB_NAME}</p>
      <div className="seg">
        <button className={tab === 'feed' ? 'on' : ''} onClick={() => setTab('feed')}>Feed</button>
        <button className={tab === 'chat' ? 'on' : ''} onClick={() => setTab('chat')}>Chat</button>
      </div>

      {tab === 'feed' && (
        <>
          <Card className="recap">
            <p className="eyebrow">Weekly recap · week 31</p>
            <h3>🔔 {bell.name} holds the Bell</h3>
            <p>{bell.name} leads the board: {signedPct(bell.ret6m - SP500.ret6m)} better than the S&P 500 over the last 6 months, after tax. {jordan.name} is closing in at {signedPct(jordan.ret6m - SP500.ret6m)}, with one catch: the average P/E of {jordan.name}'s stocks just hit <b>{jordan.weightedPE}</b>.</p>
            <button className="recap-concept" onClick={() => setOpen(open === 'pe' ? null : 'pe')}>
              <span>What's a P/E of {jordan.weightedPE} mean?</span><span>{open === 'pe' ? '−' : '+'}</span>
            </button>
            {open === 'pe' && (
              <div className="recap-explain">
                <BuyersExpect pe={{ value: jordan.weightedPE, name: `${jordan.name}'s average` }} dark />
                <p className="small">{concept('pe-ratio').kid_explanation} So {jordan.name} is paying, on average, ${jordan.weightedPE} for every $1 of yearly profit.</p>
              </div>
            )}
            <p className="recap-replay">⏱ Last week's replay, <b>{lastWeekReplay.card}</b>: {lastWeekReplay.summary}</p>
            {state.pick && <p className="muted small">New this week: {state.name} joined and bought {findCompany(state.pick.ticker)?.name}. Welcome to the club.</p>}
          </Card>

          <Showdown myPicks={myPicks} />
          <WeeklyReplay myPicks={myPicks} />
          <ThisWeek myTickers={myPicks.map((p) => p.ticker)} />

          {[...mine, ...friendTheses].sort((a, b) => a.daysAgo - b.daysAgo).map((t) => <ThesisCard key={t.id} t={t} mine={t.id.startsWith('mine')} />)}

          {!state.pick && (
            <Card onClick={() => go('curious')} className="nudge">
              <b>You haven't made a pick yet.</b>
              <span className="muted">Start from a company you like →</span>
            </Card>
          )}
        </>
      )}

      {tab === 'chat' && (
        <div className="club-chat">
          {state.chat.map((m, i) => (
            <div key={i} className={`chat-line ${m.who === state.name ? 'mine' : ''}`}>
              <Avatar emoji={m.avatar} size={30} />
              <div><small>{m.who}</small><p>{m.text}</p></div>
            </div>
          ))}
          <div className="compose chat-compose">
            <input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Say something to the club" />
            <button className="send" onClick={send} disabled={!msg.trim()} aria-label="Send">↑</button>
          </div>
        </div>
      )}
    </Page>
  )
}

// A thesis in the feed, with its comments and a box to add one. Comments
// attach to the thesis (concept doc: the social part is arguing about
// businesses), so the box sits right under the reasoning it's about.
function ThesisCard({ t, mine }: { t: Thesis; mine: boolean }) {
  const { state, update } = useGame()
  const [text, setText] = useState('')
  const added = state.comments[t.id] ?? []
  const all = [...t.comments, ...added]
  const firstName = t.who.replace(/ \(you\)$/, '')
  const post = () => {
    if (!text.trim()) return
    update((s) => ({ comments: { ...s.comments, [t.id]: [...(s.comments[t.id] ?? []), { who: `${s.name} (you)`, text: text.trim() }] } }))
    setText('')
  }
  return (
    <Card className={`thesis-card ${mine ? 'mine' : ''}`}>
      <span id={`thesis-${t.id}`} className="anchor" />
      <div className="row">
        <Avatar emoji={t.avatar} size={36} you={mine} />
        <div className="thesis-head">
          <b>{t.who} {t.action === 'bought' ? 'bought' : 'scouted'} {t.companyName}</b>
          <small>{t.daysAgo === 0 ? 'Today' : `${t.daysAgo}d ago`}{t.amount ? ` · ${usd(t.amount)}` : ' · no money in, still scored'}</small>
        </div>
      </div>
      <p className="quote">"{t.why}"</p>
      <div className="prediction-pill">🎯 {t.prediction}</div>
      <div className="comments">
        {all.map((c, i) => <p key={i}><b>{c.who}</b> {c.text}</p>)}
        <div className="compose comment-compose">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && post()}
            placeholder={mine ? 'Reply to your club…' : `Ask ${firstName} about ${t.companyName}…`}
            aria-label={`Comment on ${firstName}'s thesis`}
          />
          <button className="send" onClick={post} disabled={!text.trim()} aria-label="Post comment">↑</button>
        </div>
      </div>
    </Card>
  )
}

// What's happening on the market this week: companies in the game reporting
// earnings (business news, with what to watch, never price moves), then
// recent IPOs. Not buyable: the curated list is the S&P 500, which new
// companies can't join yet.
function ThisWeek({ myTickers }: { myTickers: string[] }) {
  const { go } = useGame()
  const [open, setOpen] = useState<string | null>(null)
  const [why, setWhy] = useState(false)
  const reporting = companies.filter((c) => c.daysToEarnings <= 7).sort((a, b) => a.daysToEarnings - b.daysToEarnings)
  const holders = (ticker: string) => {
    const names = friends.filter((f) => friendHoldings[f.id]?.some((h) => h.ticker === ticker)).map((f) => f.name)
    if (myTickers.includes(ticker)) names.unshift('You')
    return names
  }
  const when = (d: number) => (d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`)
  return (
    <Card className="listings">
      <p className="eyebrow">🗓️ This week on the market</p>

      {reporting.length > 0 && (
        <>
          <h3><Linked text="Earnings reports" /> this week</h3>
          <p className="muted small">Every 3 months a company shows its real numbers. That's when theses get checked, so it's the week to pay attention.</p>
          <div className="earnings-list">
            {reporting.map((c) => {
              const who = holders(c.ticker)
              const l = lens(c.lens)
              return (
                <button key={c.ticker} className="earnings-row" onClick={() => go('company', { companyTicker: c.ticker, companyBack: 'feed' })}>
                  <span className="tick">{c.ticker}</span>
                  <span className="earnings-main">
                    <b>{c.name}</b> <small>reports {when(c.daysToEarnings)}</small>
                    {l && <small className="watch">Watch: {l.look_first.toLowerCase()}</small>}
                    {who.length > 0 && <small className="holders">{who.join(', ')} {who.length === 1 && who[0] !== 'You' ? 'owns' : 'own'} it</small>}
                  </span>
                  <span className="go" aria-hidden>▸</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <h3>🆕 New on the market</h3>
      <p className="muted small">Companies that just started selling shares to everyone.</p>
      {newListings.map((l) => (
        <div key={l.ticker} className={`listing ${open === l.ticker ? 'open' : ''}`}>
          <button className="listing-head" onClick={() => setOpen(open === l.ticker ? null : l.ticker)}>
            <span><b>{l.name}</b><small>{l.what}</small></span>
            <span aria-hidden>{open === l.ticker ? '−' : '+'}</span>
          </button>
          {open === l.ticker && (
            <div className="listing-body">
              <p><b>How it makes money:</b> {l.money}</p>
              <p className="listing-q">🤔 {l.question}</p>
              {l.related && (
                <div className="listing-related">
                  <small>In the game:</small>
                  {l.related.map((r) => (
                    <button key={r.ticker} className="co-chip" onClick={() => go('company', { companyTicker: r.ticker, companyBack: 'feed' })}>
                      <b>{findCompany(r.ticker)?.name}</b><small>{r.why}</small>
                    </button>
                  ))}
                </div>
              )}
              <p className="muted small">Started trading {l.listed} · {l.ticker}</p>
            </div>
          )}
        </div>
      ))}
      <button className="recap-concept" onClick={() => setWhy(!why)}>
        <span>Why can't I buy these here?</span><span>{why ? '−' : '+'}</span>
      </button>
      {why && <p className="recap-explain">The game only lets you buy companies in the S&P 500. A company can't join until it has traded for at least a year and made a profit, so brand-new companies aren't in it yet. You can still learn how they work, and look at the companies they connect to.</p>}
      <p className="muted small">Prototype: these 2025 listings stand in for this week's, and the earnings dates are made up.</p>
    </Card>
  )
}

// Earnings showdown: before a clubmate's company reports, vote on whether
// their prediction holds or breaks. Votes hide until the report (no herding),
// you can't vote on your own call, and the result shows who called it. Votes
// are for bragging rights (the "Calls" tally on the predictions board), never
// rank, so a vote is a guess about a friend's reasoning, not a bet.
function Showdown({ myPicks }: { myPicks: Pick[] }) {
  const { state, update, go } = useGame()
  const [how, setHow] = useState(false)
  const upcoming = upcomingShowdowns()
  const results = recentResults()
  const own = ownCalls(myPicks, state.scouts)
  if (!upcoming.length && !results.length && !own.length) return null
  const when = (d: number) => (d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`)
  const vote = (id: string, v: 'holds' | 'breaks') => update((s) => ({ votes: { ...s.votes, [id]: v } }))
  const seeThesis = (id: string) => document.getElementById(`thesis-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return (
    <Card className="showdown">
      <p className="eyebrow">🥊 Earnings showdown</p>
      <p className="muted small">When a clubmate's company reports, their prediction gets checked. Call it first: holds or breaks?</p>

      {upcoming.map(({ thesis: t, daysToReport, votesIn }) => {
        const mine = state.votes[t.id]
        return (
          <div key={t.id} className="showdown-row">
            <div className="row">
              <Avatar emoji={t.avatar} size={32} />
              <div className="showdown-head">
                <b>{t.who}'s call on {t.companyName}</b>
                <small>Reports {when(daysToReport)} · {t.action === 'scouted' ? 'scouting report' : 'owns it'}</small>
              </div>
            </div>
            <div className="prediction-pill">🎯 {t.prediction}</div>
            <div className="vote-row">
              <button className={`vote ${mine === 'holds' ? 'on' : ''}`} onClick={() => vote(t.id, 'holds')} disabled={!!mine && mine !== 'holds'}>{mine === 'holds' ? '✓ ' : ''}Holds</button>
              <button className={`vote breaks ${mine === 'breaks' ? 'on' : ''}`} onClick={() => vote(t.id, 'breaks')} disabled={!!mine && mine !== 'breaks'}>{mine === 'breaks' ? '✓ ' : ''}Breaks</button>
            </div>
            <small className="muted">
              {mine ? `You said ${mine}. ` : ''}{votesIn + (mine ? 1 : 0)} vote{votesIn + (mine ? 1 : 0) === 1 ? '' : 's'} in. Who said what shows when {t.companyName} reports.{' '}
              <button className="link-btn inline" onClick={() => seeThesis(t.id)}>Read the thesis ↓</button>
            </small>
          </div>
        )
      })}

      {own.map((c) => (
        <div key={c.ticker} className="showdown-row own">
          <div className="row">
            <Avatar emoji={state.avatar} size={32} you />
            <div className="showdown-head">
              <b>Your call on {c.companyName}</b>
              <small>Reports {when(c.daysToReport)} · {c.scouting ? 'scouting report' : 'you own it'}</small>
            </div>
          </div>
          <div className="prediction-pill">🎯 {c.prediction}</div>
          <small className="muted">Your club is voting on this one. You can't vote on your own call, but you can defend it in the comments.</small>
        </div>
      ))}

      {results.map((r) => {
        const right = r.held ? r.votes.holds : r.votes.breaks
        const wrong = r.held ? r.votes.breaks : r.votes.holds
        const all = r.votes.holds.length + r.votes.breaks.length
        return (
          <div key={r.thesisId} className={`showdown-row result ${r.held ? 'held' : 'broke'}`}>
            <div className="row">
              <Avatar emoji={r.avatar} size={32} />
              <div className="showdown-head">
                <b>{r.companyName} reported {r.daysAgo === 0 ? 'today' : `${r.daysAgo} days ago`}</b>
                <small>{r.who}'s call: {r.prediction}</small>
              </div>
            </div>
            <p className="showdown-verdict"><span>{r.reported}.</span> <b>{r.who}'s call {r.held ? 'held ✅' : 'broke ❌'}.</b></p>
            <small className="muted">
              {right.length} of {all} called it{right.length ? `: ${right.join(', ')}` : ''}.{wrong.length ? ` ${wrong.join(', ')} said ${r.held ? 'breaks' : 'holds'}.` : ''}{' '}
              <button className="link-btn inline" onClick={() => seeThesis(r.thesisId)}>Read the thesis ↓</button>
            </small>
          </div>
        )
      })}

      <button className="recap-concept" onClick={() => setHow(!how)}>
        <span>How showdowns work</span><span>{how ? '−' : '+'}</span>
      </button>
      {how && (
        <div className="recap-explain">
          <p>Votes stay hidden until the company reports, so nobody just copies the crowd. Voting closes at the last market close before the report. You can't vote on your own call.</p>
          <p>A vote is a guess about a friend's reasoning, not a bet: it's for bragging rights only. Your calls show on the <button className="link-btn inline" onClick={() => go('board')}>Predictions board</button> and never change your rank.</p>
        </div>
      )}
    </Card>
  )
}

// This week's club replay: one time machine replay, the same for everyone in
// the club, chosen against the club's own theses (src/lib/weekly_replay.ts).
// Reveals stay immediate, because that feedback is the point of a replay, so
// the card asks for no spoilers; Sunday's recap compares everyone's choices.
function WeeklyReplay({ myPicks }: { myPicks: Pick[] }) {
  const { state, go } = useGame()
  const pick = pickWeeklyReplay(state.name, myPicks)
  const r = replay(pick.slug)
  if (!r) return null
  const done = state.replaysDone.includes(r.slug)
  const played = weeklyReplayPlayed.map((id) => friends.find((f) => f.id === id)?.name).filter(Boolean) as string[]
  return (
    <Card className="weekly-replay">
      <p className="eyebrow">⏱ This week's club replay</p>
      <h3>{r.card}</h3>
      <p className="why-this"><b>Why this one:</b> {pick.reason}</p>
      <p className="muted small">Everyone in {CLUB_NAME} plays the same replay this week. No spoilers in chat, please: Sunday's recap compares everyone's choices.</p>
      <p className="muted small">{played.length ? `${played.join(', ')} ${played.length === 1 ? 'has' : 'have'} played${done ? ', and so have you' : ''}.` : done ? "You've played it." : 'Nobody has played it yet.'}</p>
      {done
        ? <Button kind="secondary" onClick={() => go('replay', { replaySlug: r.slug })}>✓ Done · play it again</Button>
        : <Button onClick={() => go('replay', { replaySlug: r.slug })}>Play it (2 minutes)</Button>}
    </Card>
  )
}
