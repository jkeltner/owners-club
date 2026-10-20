# Owners Club

**Beat the market, then beat your friends.**

Owners Club is a stock-picking game for kids and their friends that rewards understanding businesses, not betting on prices. Every player starts with $10,000 in the S&P 500. Each pick is a deliberate bet against the index, made with a written thesis and a prediction that gets checked against what actually happens. An AI coach asks the questions a good investor would, and a learning tracker makes sure every player meets the concepts that matter: valuation, diversification, luck vs. skill, and more.

Most stock games rank players by raw return, which rewards betting everything on one stock. Owners Club is designed around the opposite lesson. See [the product concept](docs/concept.md) for the rules and the simulations behind them.

## Status

Early design. The current work is a clickable prototype for playtesting with kids; see [the prototype brief](docs/prototype_brief.md).

## Docs

- [Product concept](docs/concept.md): what the game is, its rules and why
- [Build spec](docs/build_spec.md): technical decisions, data model and data sources
- [Prototype brief](docs/prototype_brief.md): what's being built now
- [Sector metrics reference](docs/sector_metrics_reference.md)
- [Learning objectives catalog](content/concepts.yaml)

## Market data

The game uses end-of-day prices, company financials from public SEC filings, earnings dates and news headlines. Anyone running their own copy needs their own market data accounts and must follow each provider's terms, including any license needed to display prices to other people. See the Market data section of the [build spec](docs/build_spec.md).

## License

[MIT](LICENSE)
