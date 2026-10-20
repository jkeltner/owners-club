import { Avatar, Button, Card, Page } from '../../components/ui'
import { Linked } from '../../components/terms'
import { CLUB_NAME, SP500, bellHolder, friends } from '../../data/club'
import { signedPct, usd } from '../../lib/format'
import { STARTING_VALUE } from '../../lib/rules'
import { useGame } from '../../state/store'

export function MarketScreen() {
  const { state, go } = useGame()
  const bell = bellHolder()
  const rows = [
    ...friends.map((f) => ({ id: f.id, name: f.name, avatar: f.avatar, vs: f.ret6m - SP500.ret6m, you: false })),
    { id: 'you', name: state.name, avatar: state.avatar, vs: 0, you: true },
  ].sort((a, b) => b.vs - a.vs || (a.you ? -1 : 1))
  return (
    <Page>
      <p className="eyebrow">Step 1 of 3</p>
      <h1>You already own the market.</h1>
      <Card className="big-money">
        <div className="money">{usd(STARTING_VALUE)}</div>
        <div className="money-label">of pretend money, in an S&P 500 <Linked text="index fund" /></div>
        <div className="sp-grid" aria-hidden>
          {Array.from({ length: 100 }, (_, i) => <span key={i} />)}
        </div>
        <p>That's a small piece of <b>500 big US companies</b>, like Apple, Nvidia and Costco. When they do well, so does your money.</p>
      </Card>
      <Card className="how-it-works">
        <h3>Why start here?</h3>
        <div className="rule"><span>📈</span><span><b>It's what most experts tell regular people to do.</b> Over long stretches the S&P 500 has grown about 10% a year, with no picking at all.</span></div>
        <div className="rule"><span>🎯</span><span><b>It's hard to beat.</b> Over 10 or more years, most professional stock pickers do worse than it. So it's the score to beat, not zero.</span></div>
        <div className="rule"><span>🔀</span><span><b>Picking means moving money out of it.</b> When you buy a company, the money comes from your index fund. You only climb the board if your picks do better than that money would have.</span></div>
      </Card>
      <h2>{CLUB_NAME}</h2>
      <p className="muted">Ranked by 6-month return vs. the S&P 500.</p>
      <Card className="mini-board">
        {rows.map((r) => (
          <div key={r.id} className={`mini-row ${r.you ? 'you' : ''} ${r.vs === 0 ? 'tied' : ''}`}>
            <Avatar emoji={r.avatar} size={30} you={r.you} />
            <span className="mini-name">{r.you ? `${r.name} (you)` : r.name}{r.id === bell.id && ' 🔔'}</span>
            <span className="mini-vs">{r.vs === 0 ? 'Tied with market' : signedPct(r.vs)}</span>
          </div>
        ))}
      </Card>
      <p className="center muted">Right now you're tied with the market. Each pick is a bet that you can beat it.</p>
      <Button onClick={() => go('curious')}>Make my first pick</Button>
    </Page>
  )
}
