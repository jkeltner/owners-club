import { FeedbackButton } from './components/feedback'
import { TabBar, Toasts } from './components/ui'
import { CoachScreen } from './screens/onboarding/coach'
import { CompanyScreen } from './screens/onboarding/company'
import { CuriousScreen } from './screens/onboarding/curious'
import { DoneScreen } from './screens/onboarding/done'
import { InviteScreen, JoinScreen } from './screens/onboarding/invite'
import { LevelScreen } from './screens/onboarding/level'
import { MarketScreen } from './screens/onboarding/market'
import { PrivateCompanyScreen } from './screens/onboarding/private_company'
import { SizeScreen } from './screens/onboarding/size'
import { ThesisScreen } from './screens/onboarding/thesis'
import { FeedScreen } from './screens/feed'
import { LeaderboardScreen } from './screens/leaderboard'
import { PortfolioScreen } from './screens/portfolio'
import { ProfileScreen } from './screens/profile'
import { SellScreen } from './screens/sell'
import { LearnScreen } from './screens/learn'
import { LessonScreen } from './screens/lesson'
import { ReplayScreen } from './screens/replay'
import { ScoutedScreen } from './screens/scouted'
import { useGame, type Screen } from './state/store'

const SCREENS: Record<Screen, () => React.JSX.Element> = {
  invite: InviteScreen,
  join: JoinScreen,
  level: LevelScreen,
  market: MarketScreen,
  curious: CuriousScreen,
  company: CompanyScreen,
  private: PrivateCompanyScreen,
  coach: CoachScreen,
  thesis: ThesisScreen,
  size: SizeScreen,
  done: DoneScreen,
  feed: FeedScreen,
  portfolio: PortfolioScreen,
  sell: SellScreen,
  board: LeaderboardScreen,
  learn: LearnScreen,
  lesson: LessonScreen,
  replay: ReplayScreen,
  scouted: ScoutedScreen,
  me: ProfileScreen,
}

const TABBED: Screen[] = ['feed', 'portfolio', 'sell', 'board', 'learn', 'lesson', 'replay', 'scouted', 'me']

export default function App() {
  const { state } = useGame()
  const Current = SCREENS[state.screen] ?? InviteScreen
  // After the first pick, browsing a company from a tab keeps the tab bar.
  const tabbed = TABBED.includes(state.screen) || (state.pick !== null && (state.screen === 'company' || (state.screen === 'thesis' && !!state.draft?.scout)))
  return (
    <div className={`app ${tabbed ? 'has-tabs' : ''}`}>
      <Current key={state.screen} />
      {tabbed && <TabBar />}
      <FeedbackButton />
      <Toasts />
      <DeskPanel />
    </div>
  )
}

// Beside the phone column on wide screens only (see .desk-panel), so a
// tester on a computer knows the narrow layout is on purpose.
function DeskPanel() {
  return (
    <aside className="desk-panel" aria-label="About this prototype">
      <div className="club-crest">OC</div>
      <h2>Owners Club</h2>
      <p>A stock-picking game for teens that rewards understanding businesses, not betting on prices.</p>
      <p><b>It's built for phones.</b> On a computer you see the phone-sized screen. For the real feel, open this page on your phone: <span className="desk-url">{window.location.host}</span></p>
      <p><b>Tell us what you think.</b> Tap ✎ at the top right of the screen on any page and write a note. It's sent with what you were looking at.</p>
      <p className="muted small">Everything here is a prototype with sample data. No real money.</p>
    </aside>
  )
}
