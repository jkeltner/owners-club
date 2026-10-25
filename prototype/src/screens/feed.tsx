import { useState } from 'react'
import { Avatar, Card, Page } from '../components/ui'
import { MARKET_PE, concept } from '../content'
import { CLUB_NAME, friendTheses, friends, bellHolder, SP500, type Thesis } from '../data/club'
import { findCompany } from '../data/companies'
import { newListings } from '../data/new_listings'
import { signedPct, usd } from '../lib/format'
import { useGame } from '../state/store'

export function FeedScreen() {
  const { state, update, go } = useGame()
  const [tab, setTab] = useState<'feed' | 'chat'>('feed')
  const [msg, setMsg] = useState('')
  const bell = bellHolder()
  const jordan = friends.find((f) => f.id === 'jordan')!
  const [open, setOpen] = useState<string | null>(null)

  const mine: Thesis[] = state.pick
    ? [{
        id: 'mine', who: `${state.name} (you)`, avatar: state.avatar, ticker: state.pick.ticker,
        companyName: findCompany(state.pick.ticker)?.name ?? state.pick.ticker, action: 'bought', amount: state.pick.amount,
        why: state.pick.thesis,
        prediction: `${state.pick.prediction.label}: ${state.pick.prediction.unit === '$' ? `$${state.pick.prediction.value.toFixed(2)}` : `${state.pick.prediction.value}%`} or more`,
        daysAgo: 0, comments: [{ who: 'Alex', text: 'ok but what if it’s already priced in 👀' }],
      }]
    : []

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

          <NewListings />

          {[...mine, ...friendTheses].map((t) => <ThesisCard key={t.id} t={t} mine={t.id === 'mine'} />)}

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

function ThesisCard({ t, mine }: { t: Thesis; mine: boolean }) {
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
      {t.comments.length > 0 && (
        <div className="comments">
          {t.comments.map((c, i) => <p key={i}><b>{c.who}</b> {c.text}</p>)}
        </div>
      )}
    </Card>
  )
}

// Recent IPOs, to widen what players think about. Not buyable in the game:
// the curated list is the S&P 500, which new companies can't join yet.
function NewListings() {
  const { go } = useGame()
  const [open, setOpen] = useState<string | null>(null)
  const [why, setWhy] = useState(false)
  return (
    <Card className="listings">
      <p className="eyebrow">🆕 New on the market</p>
      <h3>Companies that just started selling shares to everyone</h3>
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
      <p className="muted small">Prototype: these 2025 listings stand in for this week's.</p>
    </Card>
  )
}
