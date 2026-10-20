import { useState } from 'react'
import { MixBar } from '../components/charts'
import { Avatar, Card, Page, Sheet } from '../components/ui'
import { friends, friendHoldings, bellHolder, SP500 } from '../data/club'
import { findCompany } from '../data/companies'
import { MARKET_PE } from '../content'
import { signedPct } from '../lib/format'
import { DEFAULT_SETTINGS, INDEX_TICKER } from '../lib/rules'
import { useGame } from '../state/store'

type Board = 'main' | 'rookie' | 'long' | 'risk' | 'predictions'

const BOARDS: { id: Board; label: string; blurb: string }[] = [
  { id: 'main', label: 'Main', blurb: '6-month return vs. the S&P 500, after tax, as if you sold today.' },
  { id: 'rookie', label: 'Rookie', blurb: 'Under 6 months in? You’re ranked on 3-month returns here.' },
  { id: 'long', label: 'Long-term', blurb: '12-month returns, for players with a full year in the game.' },
  { id: 'risk', label: 'Risk-adjusted', blurb: 'Return divided by how much your portfolio swung up and down along the way. A smooth ride scores higher than a wild one with the same return.' },
  { id: 'predictions', label: 'Predictions', blurb: 'How often the predictions in your theses came true at earnings reports. The closest thing to measuring skill, not luck.' },
]

type Row = {
  id: string; name: string; avatar: string; you: boolean; months: number
  vs3: number; vs6: number; holdings: number; largest: number; pe: number; riskAdj: number; hit: number; made: number
}

export function LeaderboardScreen() {
  const { state } = useGame()
  const [board, setBoard] = useState<Board>('main')
  const [how, setHow] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)
  const bell = bellHolder()

  const rows: Row[] = [
    ...friends.map((f) => ({
      id: f.id, name: f.name, avatar: f.avatar, you: false, months: f.monthsPlaying,
      vs3: f.ret3m - SP500.ret3m, vs6: f.ret6m - SP500.ret6m, holdings: f.holdings, largest: f.largestPct,
      pe: f.weightedPE, riskAdj: f.ret6m / f.volatility, hit: f.predictionsHit, made: f.predictionsMade,
    })),
    {
      id: 'you', name: state.name || 'You', avatar: state.avatar, you: true, months: 0, vs3: 0, vs6: 0,
      holdings: state.pick ? 2 : 1, largest: state.pick ? Math.round((state.pick.amount / 10000) * 100) : 0,
      pe: 23, riskAdj: SP500.ret6m / SP500.volatility, hit: 0, made: state.pick ? 1 : 0,
    },
  ]

  const sorted = (() => {
    switch (board) {
      case 'main': return [...rows].sort((a, b) => b.vs6 - a.vs6)
      case 'rookie': return rows.filter((r) => r.months < 6).sort((a, b) => b.vs3 - a.vs3)
      case 'long': return []
      case 'risk': return [...rows].sort((a, b) => b.riskAdj - a.riskAdj)
      case 'predictions': return rows.filter((r) => r.made > 0).sort((a, b) => b.hit / Math.max(b.made, 1) - a.hit / Math.max(a.made, 1))
    }
  })()

  const score = (r: Row) => {
    switch (board) {
      case 'main': return r.vs6 === 0 ? 'Even' : signedPct(r.vs6)
      case 'rookie': return r.vs3 === 0 ? 'Even' : signedPct(r.vs3)
      case 'risk': return r.riskAdj.toFixed(2)
      case 'predictions': return r.you && r.hit === 0 ? 'Pending' : `${r.hit}/${r.made}`
      default: return ''
    }
  }

  return (
    <Page>
      <h1>Leaderboard</h1>
      <Card className={`how-board ${how ? 'open' : ''}`}>
        <button className="how-head" onClick={() => setHow(!how)} aria-expanded={how}>
          <span><b>How the board works</b><small>How you're scored, and how to move up</small></span>
          <span>{how ? '−' : '+'}</span>
        </button>
        {how && (
          <div className="how-body">
            <p><b>Your score</b> is how much your portfolio grew minus how much the S&P 500 grew over the same 6 months. +3% means you beat the index by 3 points. "Even" means you matched it.</p>
            <p><b>It's after tax, as if you sold everything today.</b> Gains on stocks held under 6 months are taxed {DEFAULT_SETTINGS.shortTermTaxRate * 100}%, longer than that {DEFAULT_SETTINGS.longTermTaxRate * 100}%. Fees ({DEFAULT_SETTINGS.feeRate * 100}% a trade) count too.</p>
            <p><b>To move up,</b> your picks have to grow faster than the index money they came out of would have. A few ways it happens:</p>
            <ul>
              <li>Pick companies whose profits grow more than people expect.</li>
              <li>Hold winners past 6 months, so you keep more after tax.</li>
              <li>Trade less: every fee and early tax bill pulls your score down.</li>
              <li>Bigger picks move your score more, in both directions.</li>
            </ul>
            <p><b>The numbers under each name don't change your rank.</b> They show how much risk each player is taking: how many things they own, how big their largest pick is, and the average P/E of what they own (a typical company is about {MARKET_PE}).</p>
            <p><b>🔔 The Bell</b> goes to whoever is #1 on the Main board. It's named for the bell that opens the stock market every morning.</p>
          </div>
        )}
      </Card>
      <div className="tabs-scroll">
        {BOARDS.map((b) => (
          <button key={b.id} className={`chip ${board === b.id ? 'chip-active' : ''}`} onClick={() => setBoard(b.id)}>{b.label}</button>
        ))}
      </div>
      <p className="muted small">{BOARDS.find((b) => b.id === board)!.blurb} Updated after yesterday's close.</p>

      {board === 'long' ? (
        <Card className="empty">
          <div className="big-number">⏳</div>
          <b>Nobody qualifies yet.</b>
          <p className="muted">This board unlocks when someone has played for 12 months. Alex and Priya get there in 4 months.</p>
        </Card>
      ) : (
        <div className="board">
          {sorted.map((r, i) => (
            <Card key={r.id} className={`board-row ${r.you ? 'you' : 'tappable'} ${board === 'main' && r.id === bell.id ? 'bell' : ''}`}
              onClick={r.you ? undefined : () => setViewing(r.id)}>
              <div className="board-top">
                <span className="board-rank">{i + 1}</span>
                <Avatar emoji={r.avatar} size={36} you={r.you} />
                <span className="board-name">
                  {r.you ? `${r.name} (you)` : r.name}
                  {board === 'main' && r.id === bell.id && <span className="bell-tag">🔔 Bell</span>}
                </span>
                <span className="board-score">{score(r)}</span>
                {!r.you && <span className="board-go" aria-hidden>›</span>}
              </div>
              {(board === 'main' || board === 'rookie') && (
                <div className="risk-cols">
                  <span><small>Holdings</small>{r.holdings}</span>
                  <span className={r.largest >= 50 ? 'flag' : ''}><small>Largest</small>{r.largest || '—'}{r.largest ? '%' : ''}</span>
                  <span className={r.pe >= 50 ? 'flag' : ''}><small>Avg P/E</small>{r.pe}</span>
                  <span><small>Months</small>{r.months}</span>
                </div>
              )}
            </Card>
          ))}
          {board === 'main' && (
            <p className="muted small center">Tap a player to see what they own and why. The S&P 500 itself would score Even. Your index holding doesn't count toward "Largest".</p>
          )}
        </div>
      )}
      {viewing && <FriendPortfolio id={viewing} onClose={() => setViewing(null)} />}
    </Page>
  )
}

const COLORS = ['var(--primary)', 'var(--gold)', 'var(--mint)', 'var(--coral)']

// A clubmate's portfolio: shares of the whole, each with the thesis it was
// bought with. A week late, and never in dollars.
function FriendPortfolio({ id, onClose }: { id: string; onClose: () => void }) {
  const f = friends.find((x) => x.id === id)!
  const list = friendHoldings[id] ?? []
  const color = (t: string, i: number) => (t === INDEX_TICKER ? 'var(--index)' : COLORS[i % COLORS.length])
  const nameOf = (t: string) => (t === INDEX_TICKER ? 'S&P 500 index' : findCompany(t)?.name ?? t)
  return (
    <Sheet title={`${f.name}'s portfolio`} onClose={onClose}>
      <p className="muted small">{f.avatar} {f.rank} · playing {f.monthsPlaying} months · {signedPct(f.ret6m - SP500.ret6m)} vs. the S&P 500 over 6 months</p>
      <p className="muted small">As of last Friday's close. Holdings show a week late so nobody can copy the leader, and you see shares of the whole, not dollars.</p>
      <MixBar parts={list.map((h, i) => ({ label: h.ticker, value: h.pct, color: color(h.ticker, i) }))} />
      <div className="friend-holdings">
        {list.map((h, i) => (
          <div key={h.ticker} className="friend-holding">
            <div className="friend-holding-top">
              <i className="swatch" style={{ background: color(h.ticker, i) }} />
              <b>{nameOf(h.ticker)}</b>
              <span>{h.pct}%</span>
            </div>
            {h.why ? <p className="quote small">"{h.why}"</p>
              : h.ticker === INDEX_TICKER ? <p className="muted small">{h.pct === 100 ? 'Still all in the index. No picks yet.' : 'Money not in a pick stays in the index.'}</p> : null}
          </div>
        ))}
      </div>
    </Sheet>
  )
}
