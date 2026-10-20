import { useState } from 'react'
import { Avatar, Card, Page } from '../components/ui'
import { MARKET_PE, concept } from '../content'
import { CLUB_NAME, friendTheses, friends, bellHolder, SP500, type Thesis } from '../data/club'
import { findCompany } from '../data/companies'
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
