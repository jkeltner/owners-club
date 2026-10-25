// "New on the market": companies that recently sold shares to the public for
// the first time (an IPO). The real card lists the past week's; the prototype
// uses three 2025 listings as stand-ins (see docs/data_needs.md).
//
// No first-day price moves on purpose: the card is about what the business
// does and how it makes money, not about a stock that "popped".

export type Listing = {
  name: string
  ticker: string
  listed: string // when it started trading
  what: string // what it does, in one line
  money: string // how it makes money
  question: string // one thing to think about; never a verdict
  related?: { ticker: string; why: string }[] // S&P 500 companies in the game it connects to
}

export const newListings: Listing[] = [
  {
    name: 'CoreWeave', ticker: 'CRWV', listed: 'March 2025',
    what: 'Rents out huge computers, packed with Nvidia chips, to companies building AI.',
    money: 'Customers pay to use its computers, often under contracts that last years.',
    question: 'Most of its sales come from a few giant customers. What happens if one of them builds its own computers instead?',
    related: [
      { ticker: 'MSFT', why: 'its biggest customer' },
      { ticker: 'NVDA', why: 'makes its chips' },
    ],
  },
  {
    name: 'Figma', ticker: 'FIG', listed: 'July 2025',
    what: 'A design app that teams use together to plan apps and websites.',
    money: 'Subscriptions. Individuals and students can start free; companies pay for each designer.',
    question: 'Adobe agreed to buy Figma for $20 billion in 2022, then called it off when regulators in Europe and the UK objected. Why would a bigger company pay that much for a rival?',
  },
  {
    name: 'Klarna', ticker: 'KLAR', listed: 'September 2025',
    what: 'Lets shoppers split a purchase into smaller payments over time.',
    money: 'Stores pay it a fee on each sale, and shoppers on longer plans pay interest.',
    question: 'Klarna only gets its money back if shoppers keep up with their payments. What happens to Klarna if lots of people fall behind?',
  },
]
