import { useState, type ReactNode } from 'react'
import { Avatar, Button, Card, Page, TopBar } from '../../components/ui'
import { Linked } from '../../components/terms'
import { CLUB_NAME, MARKET_FACTS, SP500, bellHolder, friends } from '../../data/club'
import { signedPct, usd } from '../../lib/format'
import { STARTING_VALUE } from '../../lib/rules'
import { useGame } from '../../state/store'

export function MarketScreen() {
  const { state, go } = useGame()
  const bell = bellHolder()
  // Players who know the basics get the reasons folded away.
  const [why, setWhy] = useState(state.experience === 'new' || !state.experience)
  const [whatsMarket, setWhatsMarket] = useState(false)
  const f = MARKET_FACTS
  const rows = [
    ...friends.map((f) => ({ id: f.id, name: f.name, avatar: f.avatar, vs: f.ret6m - SP500.ret6m, you: false })),
    { id: 'you', name: state.name, avatar: state.avatar, vs: 0, you: true },
  ].sort((a, b) => b.vs - a.vs || (a.you ? -1 : 1))
  return (
    <Page>
      <TopBar back="level" />
      <p className="eyebrow">Step 1 of 3</p>
      <h1>You already own the market.</h1>
      <Card className="big-money">
        <div className="money">{usd(STARTING_VALUE)}</div>
        <div className="money-label">of pretend money, in an S&P 500 <Linked text="index fund" /></div>
        <div className="sp-grid" aria-hidden>
          {Array.from({ length: 100 }, (_, i) => <span key={i} className={i < f.top10Pct ? 'top' : ''} />)}
        </div>
        <p className="muted small">Each square is $1 of every $100. The gold ones are in the 10 biggest companies.</p>
        <p>That's a small piece of <b>500 big US companies</b>, like Apple, Nvidia and Costco. Bigger companies get bigger pieces: the 10 biggest, mostly tech, are about {f.top10Pct}% of it. When they do well, so does your money.</p>
      </Card>
      <Fold
        open={whatsMarket} onToggle={() => setWhatsMarket(!whatsMarket)}
        title="What's the market?"
        teaser={<><b>What's the market?</b> And what are the Dow and the Nasdaq?</>}
      >
        <div className="rule"><span>🏛️</span><span><b>The stock market is where people buy and sell shares</b>, small pieces of companies. About {f.usListed.toLocaleString()} US companies sell their shares there.</span></div>
        <div className="rule"><span>📊</span><span><b>The market usually means the S&P 500</b>: 500 of the biggest of those companies. Together they're worth about {f.sp500CoverPct}% of the whole US stock market, so when they move, people say the market moved.</span></div>
        <div className="rule"><span>📰</span><span><Linked text="You'll also hear about the Dow and the Nasdaq." /> The Dow is just 30 big companies. The Nasdaq is mostly tech. Apple, Microsoft, Nvidia and Amazon are in all three.</span></div>
        <div className="rule"><span>🔒</span><span><b>Lots of big businesses aren't on it.</b> There are about half as many US companies on the stock market as in 1996. Of US companies that sell more than $100 million a year, only about 1 in {f.publicOneIn} sells shares to the public. The rest, like OpenAI, are private, so you can't buy them here.</span></div>
      </Fold>
      <Fold
        open={why} onToggle={() => setWhy(!why)}
        title="Why start here?"
        teaser={<><b>The index is the score to beat.</b> Every pick moves money out of it, and you only climb the board if your picks beat that money.</>}
      >
        <div className="rule"><span>📈</span><span><b>It's what most experts tell regular people to do.</b> Over long stretches the S&P 500 has grown about 10% a year, with no picking at all.</span></div>
        <div className="rule"><span>🎯</span><span><b>It's hard to beat.</b> Over 10 or more years, most professional stock pickers do worse than it. So it's the score to beat, not zero.</span></div>
        <div className="rule"><span>🔀</span><span><b>Picking means moving money out of it.</b> When you buy a company, the money comes from your index fund. You only climb the board if your picks do better than that money would have.</span></div>
      </Fold>
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

// An explainer card that opens and closes: the teaser line with + when
// closed, the title with − when open.
function Fold({ open, onToggle, title, teaser, children }: { open: boolean; onToggle: () => void; title: string; teaser: ReactNode; children: ReactNode }) {
  return (
    <Card className="how-it-works">
      <button className="why-toggle" onClick={onToggle} aria-expanded={open}>
        <span>{open ? <b className="fold-title">{title}</b> : teaser}</span>
        <span aria-hidden>{open ? '−' : '+'}</span>
      </button>
      {open && children}
    </Card>
  )
}
