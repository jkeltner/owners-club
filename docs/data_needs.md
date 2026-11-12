# Data needs

A running list of every real number the game needs. The prototype uses made-up or hard-coded values for all of them. When a screen, lesson or coach line needs a real number, add a row here.

- **Part A:** reference numbers, fetched once and refreshed on a schedule.
- **Part B:** per-stock data, needed for every company in the game.
- **Part C:** numbers we compute ourselves from parts A and B, listed so nobody goes looking for a provider.

Source guesses follow the free stack in the [build spec](build_spec.md#market-data). **EDGAR** is the SEC's structured financials.

## A. Reference data (once, then refreshed)

| Data | Used by | Refresh | Likely source | Prototype |
| --- | --- | --- | --- | --- |
| S&P 500 average yearly return over the last 10 years and over the long run, with and without dividends | "Why start here?" card; the index lesson; coach | Yearly | Compute from index total-return history; check against S&P Dow Jones Indices | "About 10% a year", hard-coded |
| Share of professional stock pickers who trail the S&P 500 over 10+ years | "Why start here?"; the index lesson | Twice a year | SPIVA U.S. Scorecard (S&P Dow Jones Indices) | "Most", no number |
| S&P 500's biggest drops (2008, 2020, 2022) and how long each took to recover | Diversification and luck lessons; "Why start here?" | Once | Compute from index price history | Not shown |
| S&P 500 P/E today | P/E scale; coach comparisons ("a typical company is about 23") | Nightly, if computed | Compute: total market cap ÷ total earnings of members (part C) | `MARKET_PE = 23` |
| S&P 500 long-run average P/E | P/E "what's normal" | Once | Published history (Shiller data or S&P) | Not shown |
| Typical P/E range for each sector | P/E scale band; coach | Quarterly | Compute: middle half of the sector's members (part C) | Rough guesses in `sector_lenses.yaml` |
| S&P 500 dividend yield | Dividends lesson | Quarterly | Compute from member dividends | Not shown |
| S&P 500 member list with sector and industry | Market screen; sector lens choice; sector P/E | When the index changes | Index provider list or a maintained public list | 25 hand-picked companies |
| Typical single-stock vs. index volatility | "Run it 100 times" simulator, so random seasons look realistic | Once | Compute from 10 years of prices | Not built |
| New listings (IPOs) in the past week: name, ticker, exchange, first trading day, what it does, how it makes money, related S&P 500 companies | "New on the market" feed card | Weekly | IPO calendar (exchange or a market data API) for the list; the plain-language fields written per company, with a source link | Three 2025 listings, hand-written |
| Share of the S&P 500 in its 10 biggest companies | Market screen square grid and copy; index fund glossary | Monthly | Compute from member market caps (part C) or S&P Dow Jones Indices fact sheet | `MARKET_FACTS.top10Pct = 40` |
| S&P 500's share of the total US stock market's value | "What's the market?" card | Yearly | S&P Dow Jones Indices ("about 80% of available market cap") | `MARKET_FACTS.sp500CoverPct = 80` |
| Number of US companies on the stock market, today and in 1996 | "What's the market?" card ("about half as many as in 1996") | Yearly | World Bank listed domestic companies, or the Wilshire/CRSP count | `MARKET_FACTS.usListed = 4000`; from a tester note, needs a source check |
| Share of US companies with $100M+ yearly sales that are public | "What's the market?" card ("about 1 in 8") | Yearly | S&P Capital IQ counts of public vs. private companies (cited by Apollo) | `MARKET_FACTS.publicOneIn = 8`; from a tester note ("13%"), needs a source check |
| Which big companies are in the Dow and listed on the Nasdaq | "What's the market?" card; Dow and Nasdaq glossary examples | When the Dow changes | Dow member list (S&P Dow Jones Indices); exchange per ticker from the price source | Hand-written |
| Private companies (OpenAI, Anthropic, SpaceX): latest valuation, and which public companies own a stake | 🔒 cards; private-company lesson | When news breaks | Hand-curated, with a source link per fact | Hand-written |

### Time machine scenarios (stored with each scenario, once)

| Scenario | Data |
| --- | --- |
| 2022: one big winner | Daily closes for META and SPY in 2022 |
| 2022: four tech stocks | Daily closes for AAPL, MSFT, AMZN, GOOGL and SPY in 2022 |
| 2020 crash | SPY daily closes, Feb to Aug 2020, plus the date it set a new high |
| 2000: the hottest company | CSCO and SPY daily closes, Mar 2000 to Oct 2002. CSCO's P/E in March 2000 and its sales growth through 2007, hand-entered because EDGAR's structured data starts around 2009 |
| Ten years of picking | 10 companies' 2014 snapshot (what they did, size, P/E), and their 10-year returns vs. SPY, 2014 to 2023 |
| 2018: the cheap chipmaker | MU and SPY daily closes, Jun to Dec 2018; MU's P/E in June 2018 and its profit drop the next year (prototype says "about 4" and "more than half") |

## B. Per stock (every company in the game)

| Data | Used by | How often | Likely source | Notes |
| --- | --- | --- | --- | --- |
| Daily closing price | Everything: portfolio, P/E, board, trades | Daily | Massive free tier, then a licensed source | Needs a display license before beta |
| Price history, 5 years | Holding chart; "check the bad years" for chipmakers; the peak-cycle lesson | Fill in once, then daily | Alpha Vantage full history | |
| Shares outstanding | Market cap; profit per share | Quarterly | EDGAR | |
| Revenue: last 4 quarters and 5 years | Sales growth; margins; Rule of 40; thesis predictions | Quarterly | EDGAR | |
| Net income and profit per share (EPS): last 4 quarters and 5 years | P/E; profit margin; growth vs. multiple expansion | Quarterly | EDGAR | |
| Gross profit | Gross margin (software, chipmakers) | Quarterly | EDGAR | Banks don't report it |
| Operating income | Operating margin (retailers) | Quarterly | EDGAR | |
| Operating cash flow and capital spending | Free cash flow; cash conversion | Quarterly | EDGAR | |
| Debt and cash | Debt lesson; return on invested capital | Quarterly | EDGAR | |
| Shareholders' equity, goodwill and intangibles | Price-to-book and tangible book (banks); return on equity | Quarterly | EDGAR | |
| Dividends per share and payment dates | Dividends lesson; crediting cash to portfolios | Per payment | Price source | Open question in the build spec |
| Earnings dates, past and next | Countdowns; prediction checks; scouting reports; "This week on the market" feed card (companies reporting in the next 7 days); earnings showdowns (voting closes at the last close before the report) | Weekly | Alpha Vantage earnings calendar | Hand-written `daysToEarnings` per company |
| Reported quarter numbers behind each prediction metric (revenue growth, EPS, net margin), the day of the report | Scoring predictions and resolving showdown votes; the result card ("Profit margin: 31¢ of each $1 of sales") | Per report | The company's earnings press release (same day), reconciled against EDGAR when the 10-Q lands weeks later | One hand-written result in `prototype/src/data/club.ts` |
| Sector and industry → which lens | Sector lens; sector P/E band | When it changes | Member list (part A), mapped to our lenses | |
| Plain "what it does and how it makes money" | Company page; themes; the coach | Yearly | Hand-written; EDGAR segment data helps | |
| Sector numbers from company reports | Lens panel; sort-it and talk-it-through lessons | Quarterly | Hand-entered from earnings releases, or skip for the alpha | See the list below |
| Headlines | Feed; coach context | Daily | Alpha Vantage news | Links out |

**Sector numbers not in standard filings** (made up in `prototype/src/data/lens_metrics.ts` today):

- **Retailers and restaurants:** same-store sales and inventory growth.
- **Media and streaming:** subscribers and churn.
- **Software:** customer retention.
- **Consumer brands:** organic sales growth.
- **Social apps:** daily users.
- **Banks:** net interest margin and loan quality.
- **Energy:** breakeven oil price.
- **Drugmakers and biotech:** drug pipeline and patents.
- **Aerospace and defense:** backlog. EDGAR may cover it as "remaining performance obligations"; check.

**Not needed:** analyst estimates. PEG uses past growth, and predictions are scored against what the company reports, so we never show forecasts. That includes forward P/E: the game shows trailing P/E only, and "over 100" above 100 (decided 2026-11-12, see the decision log).

## C. Computed by us (no extra data)

These come from parts A and B:

- **Per company:** market cap, P/E, profit per share, margins, free cash flow, cash conversion, Rule of 40, PEG, return on equity, return on invested capital, price-to-book.
- **Per stock's price history:** volatility and correlation with the index (risk columns and the correlation lesson).
- **Per player:** each holding's return, after-tax value, and each holding's effect on the player's average P/E.
- **Per club, weekly:** largest single position, share of pick money in each kind of business, weighted P/E vs. the market, members still all in the index, and which replays the club has had. These pick the weekly club replay.
- **Across the index:** the S&P 500's P/E and each sector's typical P/E range.
