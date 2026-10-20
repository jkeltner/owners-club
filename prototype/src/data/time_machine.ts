// Prices for the time machine replays in content/scenarios.yaml. Fake, but
// shaped like the real stretches of history so each replay feels right. The
// reveal numbers are computed from these series, never typed in. Prices only;
// dividends are left out.
import { pathThrough } from '../lib/random'

export type Choice = 'hold' | 'trim' | 'sell' | 'buyback'

export const CHOICE_LABEL: Record<Choice, string> = { hold: 'Hold', trim: 'Trim', sell: 'Sell', buyback: 'Buy back' }

// A replay where you own a mix and decide at a few stops.
export type CheckpointReplay = {
  kind: 'checkpoints'
  slug: string // matches content/scenarios.yaml
  card: string // label on the Learn tab
  headline: string
  how: string // one line on how the replay works
  blindLabel: string // what the chart calls the mystery holding
  revealName: string
  revealShort: string // chart legend after the reveal
  stakeLabel: string // status card: how much is in the mystery holding
  revealWhen: string
  safeLabel: string // where trimmed money goes
  startShare: number // share of the $10,000 in the mystery holding
  risky: number[]
  safe: number[]
  index: number[] | null // drawn for comparison; null when the holding IS the index
  parts?: { name: string; series: number[] }[] // a basket's members, for the reveal
  checkpoints: number[] // trading-day indexes
  checkpointLabels: string[]
  choices: Choice[]
  alternatives: { label: string; choices: Choice[]; share?: number }[]
  revealNote: string
  // Coach replies to each debrief question, from the replay's results.
  debrief: (r: ReplayResults) => string[][]
  debriefChips: string[][]
  explains: string[] // concepts marked explained after the debrief
}

// A replay where you pick companies, then fast-forward.
export type PickReplay = {
  kind: 'pick'
  slug: string
  card: string
  headline: string
  how: string
  picks: number
  options: { name: string; blind: string; ret: number }[] // ret: % over the stretch
  indexRet: number
  revealWhen: string
  revealNote: string
  debriefChips: string[][]
  explains: string[]
}

export type Replay = CheckpointReplay | PickReplay

export type ReplayResults = {
  you: number
  start: number
  riskyRet: number
  indexRet: number
  alternatives: { label: string; value: number }[]
  usd: (n: number) => string
}

export const START = 10_000
const last = (s: number[]) => s.length - 1
const flat = (n: number) => Array.from({ length: n }, () => 1)

// ---------- 2022 ----------

const spy2022 = pathThrough(
  [[0, 477], [38, 430], [61, 452], [81, 412], [115, 366], [124, 377], [156, 429], [167, 395], [187, 357], [210, 375], [251, 382]],
  500, 0.008,
)

const meta2022 = pathThrough(
  [[0, 338], [22, 313], [25, 237], [61, 222], [85, 196], [124, 161], [150, 183], [187, 136], [210, 95], [251, 120]],
  2022, 0.016,
)

const BIG_TECH: { name: string; anchors: [number, number][] }[] = [
  { name: 'Apple', anchors: [[0, 182], [50, 160], [81, 157], [115, 131], [156, 173], [167, 157], [200, 138], [251, 130]] },
  { name: 'Microsoft', anchors: [[0, 335], [50, 300], [81, 277], [115, 247], [156, 293], [167, 261], [200, 228], [251, 240]] },
  { name: 'Amazon', anchors: [[0, 170], [50, 152], [81, 124], [115, 103], [156, 144], [167, 127], [200, 113], [251, 84]] },
  { name: 'Alphabet (Google)', anchors: [[0, 145], [50, 135], [81, 114], [115, 106], [156, 122], [167, 108], [200, 95], [251, 88]] },
]
const techParts = BIG_TECH.map((t, i) => ({ name: t.name, series: pathThrough(t.anchors, 31 + i, 0.014) }))
// Equal dollars in each at the start, so the basket is the average of each one's growth.
const techBasket = techParts[0].series.map((_, d) => techParts.reduce((a, p) => a + p.series[d] / p.series[0], 0) * 25)

// ---------- 2020 ----------

const spy2020 = pathThrough(
  [[0, 339], [13, 275], [16, 240], [23, 222], [35, 275], [50, 291], [70, 304], [76, 323], [89, 300], [113, 326], [125, 339], [133, 349]],
  2020, 0.012,
)

// ---------- 2000 ----------

const csco2000 = pathThrough(
  [[0, 70], [18, 80], [60, 62], [100, 68], [147, 55], [200, 32], [272, 16], [330, 20], [390, 13], [460, 18], [540, 16], [600, 11], [672, 11]],
  2000, 0.022,
)
const spy2000 = pathThrough(
  [[0, 138], [18, 152], [60, 143], [147, 144], [200, 132], [272, 116], [330, 124], [390, 108], [460, 115], [540, 112], [600, 85], [660, 78], [672, 89]],
  2001, 0.009,
)

// ---------- 2018 ----------

const mu2018 = pathThrough(
  [[0, 58], [10, 61], [20, 54], [40, 55], [64, 52], [90, 40], [105, 38], [120, 34], [146, 32]],
  2018, 0.02,
)
const spy2018 = pathThrough(
  [[0, 274], [30, 280], [64, 290], [85, 291], [105, 270], [120, 263], [141, 234], [146, 250]],
  2019, 0.007,
)

const pct = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}%`

export const REPLAYS: Replay[] = [
  {
    kind: 'checkpoints',
    slug: 'single-big-tech-2022',
    card: '2022: one big winner',
    headline: 'A year, in two minutes.',
    how: "You'll stop 3 times. Each time: hold, trim (sell half), or sell. Anything you sell goes into the S&P 500. The company and year stay secret until the end.",
    blindLabel: 'Your company',
    revealName: 'Meta (Facebook, Instagram, WhatsApp)',
    revealShort: 'Meta',
    stakeLabel: 'In the company',
    revealWhen: '2022',
    safeLabel: 'S&P 500',
    startShare: 0.5,
    risky: meta2022, safe: spy2022, index: spy2022,
    checkpoints: [61, 124, 187],
    checkpointLabels: ['3 months in', '6 months in', '9 months in'],
    choices: ['hold', 'trim', 'sell'],
    alternatives: [
      { label: 'Held 50% all year', choices: ['hold', 'hold', 'hold'] },
      { label: 'Trimmed at the first stop', choices: ['trim', 'hold', 'hold'] },
      { label: 'Only 10% in the company', choices: ['hold', 'hold', 'hold'], share: 0.1 },
    ],
    revealNote: 'Prototype prices, shaped like the real year. Fees included, taxes left out.',
    debrief: (r) => [
      [
        `Here's the math: trimming half at the first stop would have ended the year at ${r.usd(r.alternatives[1].value)}. Holding the whole time ended at ${r.usd(r.alternatives[0].value)}.`,
        `Nobody knew that in March, though. That's the point: you can't know, so you decide how much one surprise is allowed to hurt.`,
      ],
      [
        `At 50%, the stock's ${pct(r.riskyRet)} cost the whole portfolio about ${pct(r.riskyRet * 0.5)}. At 10%, it would have cost about ${pct(r.riskyRet * 0.1)}.`,
      ],
    ],
    debriefChips: [['The first one', 'The second one', 'The third one', 'None'], ['Way less scary', 'About the same', 'Not sure']],
    explains: ['diversification-concentration-risk'],
  },
  {
    kind: 'checkpoints',
    slug: 'tech-basket-2022',
    card: '2022: four tech stocks',
    headline: 'Four companies. Safe, right?',
    how: "You own four different companies, $2,500 each. You'll stop twice: hold, trim (move half into the S&P 500), or sell it all into the S&P 500.",
    blindLabel: 'Your four companies',
    revealName: 'Apple, Microsoft, Amazon and Alphabet (Google)',
    revealShort: 'The four together',
    stakeLabel: 'In the four',
    revealWhen: '2022',
    safeLabel: 'S&P 500',
    startShare: 1,
    risky: techBasket, safe: spy2022, index: spy2022, parts: techParts,
    checkpoints: [81, 167],
    checkpointLabels: ['4 months in', '8 months in'],
    choices: ['hold', 'trim', 'sell'],
    alternatives: [
      { label: 'Held all four all year', choices: ['hold', 'hold'] },
      { label: 'Just owned the S&P 500', choices: ['sell', 'hold'], share: 0 },
    ],
    revealNote: 'Prototype prices, shaped like the real year. Fees included, taxes left out.',
    debrief: () => [
      [
        `Rising interest rates, for one. When borrowing gets more expensive, buyers pay less for companies whose big profits are expected far in the future, and that's all four of these.`,
        `They make different things, but they move together: when one fell, the others usually did too. Investors call that correlation. Four companies that move together protect you about as much as one.`,
      ],
    ],
    debriefChips: [['Interest rates going up', 'A recession', 'Not sure']],
    explains: ['correlation'],
  },
  {
    kind: 'checkpoints',
    slug: 'covid-crash-2020',
    card: '2020: the crash',
    headline: 'Six months, in two minutes.',
    how: "You'll stop 3 times. Each time: hold, trim (sell half for cash), sell it all for cash, or buy back in with your cash.",
    blindLabel: 'The whole market',
    revealName: 'the COVID crash',
    revealShort: 'S&P 500',
    stakeLabel: 'Invested',
    revealWhen: 'early 2020',
    safeLabel: 'Cash',
    startShare: 1,
    risky: spy2020, safe: flat(spy2020.length), index: null,
    checkpoints: [13, 23, 70],
    checkpointLabels: ['3 weeks in', '5 weeks in', '3 months in'],
    choices: ['hold', 'trim', 'sell', 'buyback'],
    alternatives: [
      { label: 'Held the whole time', choices: ['hold', 'hold', 'hold'] },
      { label: 'Sold it all at the second stop', choices: ['hold', 'sell', 'hold'] },
      { label: 'Sold at the second stop, bought back at the third', choices: ['hold', 'sell', 'buyback'] },
    ],
    revealNote: 'Prototype prices, shaped like the real crash. Fees included, taxes left out.',
    debrief: (r) => [
      [
        `Selling everything at the second stop and staying out ended at ${r.usd(r.alternatives[1].value)}. Just holding ended at ${r.usd(r.alternatives[0].value)}.`,
        `The second stop was close to the very bottom. Nobody knew that at the time. It felt like the worst moment to stay in, and it was the worst moment to get out.`,
        `Even buying back later cost money: you'd have bought at a higher price than you sold for, plus a fee each way. Fees and taxes on every trade add up, and in a crash it's luck, not skill, whether your timing works.`,
      ],
    ],
    debriefChips: [['A lot', 'A little', 'Not sure']],
    explains: ['costs-and-taxes', 'luck-vs-skill'],
  },
  {
    kind: 'checkpoints',
    slug: 'dot-com-valuation-2000',
    card: '2000: the hottest company',
    headline: 'Two and a half years, in two minutes.',
    how: "You own the company and the S&P 500, half and half. You'll stop 3 times: hold, trim, or sell. Anything you sell goes into the S&P 500.",
    blindLabel: 'Your company',
    revealName: 'Cisco, the company whose equipment ran the internet',
    revealShort: 'Cisco',
    stakeLabel: 'In the company',
    revealWhen: 'the dot-com bust, 2000 to 2002',
    safeLabel: 'S&P 500',
    startShare: 0.5,
    risky: csco2000, safe: spy2000, index: spy2000,
    checkpoints: [147, 272, 460],
    checkpointLabels: ['6 months in', '1 year in', '22 months in'],
    choices: ['hold', 'trim', 'sell'],
    alternatives: [
      { label: 'Held 50% the whole time', choices: ['hold', 'hold', 'hold'] },
      { label: 'Sold at the first stop', choices: ['sell', 'hold', 'hold'] },
    ],
    revealNote: "Prototype prices, shaped like the real years. Cisco's sales nearly doubled from 2000 to 2007 while the stock stayed far below its peak.",
    debrief: (r) => [
      [
        `It was a great company. Its sales kept growing for years. But buyers were paying more than 100 times its yearly profit, so the price assumed growth that even a great company couldn't deliver.`,
        `When the growth came in slower than that, the stock fell ${pct(r.riskyRet)}, even though the business was fine. Good news everyone already expects is already in the price.`,
      ],
    ],
    debriefChips: [["The price was too high", "The business got worse", 'Not sure']],
    explains: ['already-priced-in', 'pe-ratio'],
  },
  {
    kind: 'pick',
    slug: 'index-vs-picking-decade',
    card: 'Ten years of picking',
    headline: "It's 2014. Pick three.",
    how: "Here are ten real companies, described the way they looked in 2014. Pick any three. Then we fast-forward ten years and compare them with just owning the S&P 500.",
    picks: 3,
    options: [
      { name: 'Apple', blind: 'Makes a famous phone and computers. Huge profits, but some say phones have peaked.', ret: 870 },
      { name: 'Microsoft', blind: 'An old software giant. Its system runs most PCs, but PC sales are shrinking.', ret: 900 },
      { name: 'Netflix', blind: 'A DVD-by-mail company betting everything on streaming its own shows.', ret: 840 },
      { name: "McDonald's", blind: "The world's biggest burger chain. Sales have been slipping.", ret: 200 },
      { name: 'Intel', blind: 'Makes the chips inside most computers.', ret: 90 },
      { name: 'Coca-Cola', blind: 'Sells soda in 200 countries. People are starting to drink less soda.', ret: 45 },
      { name: 'Disney', blind: 'Movies, TV channels and theme parks. Just bought Marvel and Star Wars.', ret: 20 },
      { name: 'Exxon', blind: 'The biggest oil company in the US. Oil sells for about $100 a barrel.', ret: 0 },
      { name: 'IBM', blind: 'A 100-year-old computer company pushing its new AI, called Watson.', ret: -15 },
      { name: 'Ford', blind: 'A car company that made it through the 2008 crash without a government bailout.', ret: -20 },
    ],
    indexRet: 160,
    revealWhen: '2014 to 2023',
    revealNote: 'Prototype numbers, rounded and shaped like the real decade. Prices only; dividends left out.',
    debriefChips: [['All three', 'One or two', 'None']],
    explains: ['index-as-benchmark'],
  },
  {
    kind: 'checkpoints',
    slug: 'peak-cycle-chips-2018',
    card: '2018: the cheap chipmaker',
    headline: 'Seven months, in two minutes.',
    how: "You own the company and the S&P 500, half and half. You'll stop twice: hold, trim, or sell. Anything you sell goes into the S&P 500.",
    blindLabel: 'Your company',
    revealName: 'Micron, which makes memory chips',
    revealShort: 'Micron',
    stakeLabel: 'In the company',
    revealWhen: 'the second half of 2018',
    safeLabel: 'S&P 500',
    startShare: 0.5,
    risky: mu2018, safe: spy2018, index: spy2018,
    checkpoints: [64, 105],
    checkpointLabels: ['3 months in', '5 months in'],
    choices: ['hold', 'trim', 'sell'],
    alternatives: [
      { label: 'Held 50% the whole time', choices: ['hold', 'hold'] },
      { label: 'Sold at the first stop', choices: ['sell', 'hold'] },
    ],
    revealNote: 'Prototype prices, shaped like the real stretch. Fees included, taxes left out.',
    debrief: (r) => [
      [
        `Memory chips go through booms and busts. In 2018, chip prices were at a peak, so Micron's profits were too. The next year its profits fell by more than half.`,
        `A P/E of about 4 looked cheap, but it was cheap compared with peak profits. Buyers expected the boom to end, and the stock fell ${pct(r.riskyRet)}. For companies like this, look at profits across the bad years too, not just the best one.`,
      ],
    ],
    debriefChips: [['Profits were about to fall', 'Something was wrong with it', 'Not sure']],
    explains: ['peak-cycle-earnings'],
  },
]

export const replay = (slug: string) => REPLAYS.find((r) => r.slug === slug)

export const lastDay = (r: CheckpointReplay) => last(r.risky)
