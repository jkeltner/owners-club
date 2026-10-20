// The fake club. Invented names only.

export type Friend = {
  id: string
  name: string
  avatar: string
  monthsPlaying: number
  ret3m: number // after-tax return, %
  ret6m: number
  ret12m: number | null
  holdings: number
  largestPct: number
  weightedPE: number
  volatility: number // annualized, %, for the risk-adjusted board
  predictionsHit: number
  predictionsMade: number
  rank: string
}

export const CLUB_NAME = 'Pasadena Owners Club'
export const INVITER = 'Alex'

// S&P 500 over the same trailing windows (after-tax, as if sold today).
export const SP500 = { ret3m: 3.1, ret6m: 7.2, ret12m: 13.4, volatility: 15 }

export const friends: Friend[] = [
  { id: 'alex', name: 'Alex', avatar: '⚡', monthsPlaying: 8, ret3m: 6.0, ret6m: 16.3, ret12m: null, holdings: 6, largestPct: 31, weightedPE: 29, volatility: 21, predictionsHit: 3, predictionsMade: 7, rank: 'Owner' },
  { id: 'jordan', name: 'Jordan', avatar: '🔥', monthsPlaying: 7, ret3m: 9.4, ret6m: 14.6, ret12m: null, holdings: 4, largestPct: 58, weightedPE: 61, volatility: 38, predictionsHit: 1, predictionsMade: 5, rank: 'Shareholder' },
  { id: 'priya', name: 'Priya', avatar: '🎯', monthsPlaying: 8, ret3m: 3.9, ret6m: 8.4, ret12m: null, holdings: 9, largestPct: 18, weightedPE: 22, volatility: 14, predictionsHit: 5, predictionsMade: 6, rank: 'Board Member' },
  { id: 'sam', name: 'Sam', avatar: '🌊', monthsPlaying: 6, ret3m: 3.1, ret6m: 7.2, ret12m: null, holdings: 1, largestPct: 0, weightedPE: 23, volatility: 15, predictionsHit: 0, predictionsMade: 0, rank: 'Shareholder' },
  { id: 'maya', name: 'Maya', avatar: '🎸', monthsPlaying: 4, ret3m: 1.0, ret6m: 4.9, ret12m: null, holdings: 5, largestPct: 24, weightedPE: 27, volatility: 17, predictionsHit: 4, predictionsMade: 6, rank: 'Owner' },
]

// The Bell: whoever leads the main 6-month board. Named for the bell that opens
// the stock market each day.
export const bellHolder = () => [...friends].sort((a, b) => b.ret6m - a.ret6m)[0]

export type Thesis = {
  id: string
  who: string
  avatar: string
  ticker: string
  companyName: string
  action: 'bought' | 'scouted'
  amount?: number
  why: string
  prediction: string
  daysAgo: number
  comments: { who: string; text: string }[]
}

export const friendTheses: Thesis[] = [
  {
    id: 't1', who: 'Maya', avatar: '🎸', ticker: 'COST', companyName: 'Costco', action: 'bought', amount: 2000,
    why: 'Everyone I know has a membership and almost nobody cancels. They make most of their profit from the fees, not the groceries.',
    prediction: 'Revenue grows 7% or more next quarter', daysAgo: 2,
    comments: [{ who: 'Jordan', text: 'P/E of 50 for a grocery store tho??' }, { who: 'Maya', text: "It's not a grocery store, it's a membership club 😤" }],
  },
  {
    id: 't2', who: 'Priya', avatar: '🎯', ticker: 'KO', companyName: 'Coca-Cola', action: 'scouted',
    why: "Scouting, not buying. People keep buying Coke even when prices go up. But sales only grow about 3% a year, so I don't see what the market is missing.",
    prediction: 'Profit margin stays above 25%', daysAgo: 4, comments: [],
  },
  {
    id: 't3', who: 'Jordan', avatar: '🔥', ticker: 'AMD', companyName: 'AMD', action: 'bought', amount: 1500,
    why: "Nvidia can't make enough AI chips, so companies will buy AMD's instead.",
    prediction: 'Revenue grows 30% or more next quarter', daysAgo: 6,
    comments: [{ who: 'Alex', text: 'what if Nvidia just makes more chips' }],
  },
  {
    id: 't4', who: 'Alex', avatar: '⚡', ticker: 'NFLX', companyName: 'Netflix', action: 'bought', amount: 1800,
    why: 'Live sports are bringing in new subscribers, and they barely spend more to stream a game to 10 million people than to 1 million.',
    prediction: 'Profit margin goes above 30%', daysAgo: 9, comments: [],
  },
]

export const chatSeed = [
  { who: 'Jordan', avatar: '🔥', text: 'AMD earnings in 2 weeks. my prediction is coming true' },
  { who: 'Priya', avatar: '🎯', text: 'you said that about the last one 💀' },
  { who: 'Alex', avatar: '⚡', text: 'still got the bell btw 🔔' },
]

// What each clubmate owns, as of last Friday's close (holdings show a week
// late, so nobody can copy the leader in real time). Share of the portfolio
// only, never dollar amounts. Each pick carries the thesis it was bought with.
export type FriendHolding = { ticker: string; pct: number; why?: string }

export const friendHoldings: Record<string, FriendHolding[]> = {
  alex: [
    { ticker: 'NFLX', pct: 31, why: friendTheses[3].why },
    { ticker: 'MSFT', pct: 15, why: 'Businesses pay for Office every year whether they like it or not, and now they pay extra for the AI parts.' },
    { ticker: 'AAPL', pct: 12, why: 'People keep their iPhones and keep paying for iCloud and apps. The services part grows faster than phones.' },
    { ticker: 'GOOGL', pct: 9, why: 'Search ads still make most of the money, and YouTube keeps growing.' },
    { ticker: 'DIS', pct: 8, why: 'Theme parks raised prices and people still came. Streaming finally makes a profit.' },
    { ticker: 'SPX', pct: 25 },
  ],
  jordan: [
    { ticker: 'NVDA', pct: 58, why: 'AI is the future and Nvidia makes the chips.' },
    { ticker: 'AMD', pct: 15, why: friendTheses[2].why },
    { ticker: 'META', pct: 12, why: 'Instagram ads.' },
    { ticker: 'SPX', pct: 15 },
  ],
  priya: [
    { ticker: 'AAPL', pct: 18, why: 'Services revenue grows about 12% a year and keeps more of each dollar than phones do. The P/E is a bit high, so I kept it small-ish.' },
    { ticker: 'COST', pct: 10, why: 'Membership renewals are above 90%. The P/E is 50, so I need sales to keep growing 7%+.' },
    { ticker: 'MSFT', pct: 9, why: 'Cloud sales growing 20%+ a year, and it makes more profit than it spends building data centers.' },
    { ticker: 'MCD', pct: 8, why: 'Owns the land under most restaurants, so it earns rent even in a slow year.' },
    { ticker: 'GOOGL', pct: 8, why: 'Cheaper than the other big tech companies (P/E around 22) for a business still growing 10%+.' },
    { ticker: 'LMT', pct: 7, why: 'Order backlog is bigger than two years of sales, so the next few years are mostly booked.' },
    { ticker: 'TGT', pct: 6, why: 'The stock fell a lot after a bad year. If margins get back to normal, the P/E looks low.' },
    { ticker: 'NKE', pct: 6, why: 'Turnaround bet: new running shoes are selling again. Small because it might not work.' },
    { ticker: 'SPX', pct: 28 },
  ],
  sam: [{ ticker: 'SPX', pct: 100 }],
  maya: [
    { ticker: 'COST', pct: 24, why: friendTheses[0].why },
    { ticker: 'CMG', pct: 12, why: 'Opening about 300 new restaurants a year, and each one pays itself back in about 2 years.' },
    { ticker: 'NKE', pct: 10, why: 'Everyone at school wears them. (I know, I need a better reason.)' },
    { ticker: 'EA', pct: 9, why: 'Sports games sell every single year, and people buy extra packs inside them.' },
    { ticker: 'SPX', pct: 45 },
  ],
}
