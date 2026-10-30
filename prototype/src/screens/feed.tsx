import { useState } from 'react'
import { Avatar, Card, Page } from '../components/ui'
import { Linked } from '../components/terms'
import { MARKET_PE, concept, lens } from '../content'
import { CLUB_NAME, friendHoldings, friendTheses, friends, bellHolder, SP500, type Thesis } from '../data/club'
import { companies, findCompany } from '../data/companies'
import { newListings } from '../data/new_listings'
import { signedPct, usd } from '../lib/format'
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
            {open === 'pe' && <p className="recap-explain">{concept('pe-ratio').kid_explanation} So {jordan.name} is paying, on average, ${jordan.weightedPE} for every $1 of yearly profit. A typical S&P 500 company is about {MARKET_PE}. Prices that high only hold up if profits grow fast, so if growth disappoints, stocks like these can fall hard.</p>}
            {state.pick && <p className="muted small">New this week: {state.name} joined and bought {findCompany(state.pick.ticker)?.name}. Welcome to the club.</p>}
          </Card>

          <ThisWeek myTickers={myPicks.map((p) => p.ticker)} />

          {[...mine, ...friendTheses].map((t) => <ThesisCard key={t.id} t={t} mine={t.id.startsWith('mine')} />)}

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
