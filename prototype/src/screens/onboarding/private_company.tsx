import { CoachChat } from '../../components/coach_chat'
import { Card, Page, TopBar } from '../../components/ui'
import { findCompany } from '../../data/companies'
import { useGame } from '../../state/store'

const SCRIPTS: Record<string, Record<string, string>> = {
  SpaceX: {
    question: 'if space really takes off, which public companies would do well?',
    chips: 'Companies that build rockets|Satellite makers|Defense companies|No idea',
    hint: 'someone has to build the engines, satellites and launch parts, and some of those companies are public.',
    answer: 'These public companies build rockets, satellites and spacecraft parts.',
    tickers: 'LMT,NOC,RTX,BA',
    voice: 'Maybe the companies that build the rocket parts',
  },
  OpenAI: {
    question: 'which public companies sell to AI labs, or own a piece of them?',
    chips: 'Chip makers|Cloud companies|No idea',
    hint: 'AI labs need huge numbers of chips and data centers, and they buy them from public companies.',
    answer: 'These public companies sell chips and cloud computing to AI labs, and some invest in them.',
    tickers: 'NVDA,MSFT,AMD,AVGO',
    voice: 'The companies that make the chips they need',
  },
  Anthropic: {
    question: 'which public companies sell to AI labs, or own a piece of them?',
    chips: 'Chip makers|Cloud companies|No idea',
    hint: 'AI labs rent huge data centers full of chips, and some big public companies have invested in them.',
    answer: "These public companies sell chips and cloud computing to AI labs. Amazon and Google have also invested in Anthropic, so they own a piece of it.",
    tickers: 'AMZN,GOOGL,NVDA,AVGO',
    voice: 'Whoever sells them the computers',
  },
}

export function PrivateCompanyScreen() {
  const { state, go } = useGame()
  const name = state.companyTicker && SCRIPTS[state.companyTicker] ? state.companyTicker : 'SpaceX'
  return (
    <Page>
      <TopBar back="curious" title={name} />
      <Card className="explainer">
        <div className="explainer-icon">🔒</div>
        <h1>You can't buy {name}. Yet.</h1>
        <p><b>{name} is a private company.</b> Its owners are founders, employees and a few big investors. Its shares aren't sold on the stock market, so it's not in the S&P 500 and not in this game.</p>
        <div className="split">
          <div><b>Private</b><span>Owned by a few people. You can't buy a piece.</span></div>
          <div><b>Public</b><span>Anyone can buy shares on the stock market.</span></div>
        </div>
        <p>When a private company sells shares to everyone for the first time, that's called an <b>IPO</b> (initial public offering). Until then, you can't buy a piece of it.</p>
      </Card>
      <CoachChat
        mode="private"
        facts={SCRIPTS[name]}
        voiceSample={SCRIPTS[name].voice}
        renderTickers={(tickers) => (
          <div className="ticker-cards">
            {tickers.map((t) => findCompany(t)).filter(Boolean).map((c) => (
              <button key={c!.ticker} className="co-chip" onClick={() => go('company', { companyTicker: c!.ticker, companyBack: 'curious' })}>
                <b>{c!.name}</b><small>{c!.oneLiner}</small>
              </button>
            ))}
          </div>
        )}
      />
    </Page>
  )
}
