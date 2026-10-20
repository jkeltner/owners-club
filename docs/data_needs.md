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
| Earnings dates, past and next | Countdowns; prediction checks; scouting reports | Weekly | Alpha Vantage earnings calendar | |
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

**Not needed:** analyst estimates. PEG uses past growth, and predictions are scored against what the company reports, so we never show forecasts.

## C. Computed by us (no extra data)

These come from parts A and B:

- **Per company:** market cap, P/E, profit per share, margins, free cash flow, cash conversion, Rule of 40, PEG, return on equity, return on invested capital, price-to-book.
- **Per stock's price history:** volatility and correlation with the index (risk columns and the correlation lesson).
- **Per player:** each holding's return, after-tax value, and each holding's effect on the player's average P/E.
- **Across the index:** the S&P 500's P/E and each sector's typical P/E range.
