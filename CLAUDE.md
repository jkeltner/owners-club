# Owners Club

A stock-picking game for kids (13+) and their friends that rewards understanding businesses, not betting on prices. Players start with $10,000 in the S&P 500, make picks against the index with a written thesis, and an AI coach stress-tests their reasoning. Open source under MIT.

## Where things are

- `docs/concept.md`: the product concept, rules and the reasoning behind them. **Source of truth for game rules.**
- `docs/build_spec.md`: technical decisions (decision log), data model, data stack, open technical questions. **Source of truth for implementation.**
- `docs/prototype_brief.md`: the current task, a clickable prototype.
- `docs/data_needs.md`: running list of every real number the game needs (reference data and per-stock data).
- `docs/learn_tab_sketch.md`: the Learn tab design (built in the prototype).
- `docs/sector_metrics_reference.md`: the full sector-by-sector metrics reference from a reviewer.
- `content/`: structured content the app loads:
  - `concepts.yaml`: the learning objectives catalog (concept records, rank thresholds)
  - `scenarios.yaml`: time machine scenarios
  - `sector_lenses.yaml`: the per-sector "what matters" panel
  - `themes.yaml`: onboarding themes
  - `glossary.yaml`: plain definitions for on-screen terms that aren't concepts
  - `lessons.yaml`: the three-round lesson for each concept that has one
- `prototype/`: the clickable prototype (create it here).
- `docs/playtests/`: one dated Markdown file per playtest session.

## Current task

Build the clickable prototype described in `docs/prototype_brief.md`. Start with "The first 15 minutes" flow, get it playable end to end, then add the other screens in the brief's order.

## Product rules the code must respect

These come from the concept doc's design principles. Don't change them without updating the docs.

- **The coach coaches; it never recommends.** It asks questions and shows numbers. It never says a stock is good or bad, never tells a player what to buy, and never blocks a trade.
- **Everything is measured against the S&P 500**, on after-tax value as if sold today.
- **Game settings are per club**, with defaults: 25% cap at purchase, 3-month minimum hold, 0.5% fee per trade, 40% tax on gains held under 6 months and 20% after, losses offset gains. The index holding is exempt from the cap and the hold, but not from fees or taxes.
- **Trades fill at the next market close**; portfolios and the leaderboard update once a day.
- **Quizzes teach; theses prove.** A passed check question marks a concept "explained", never "applied".
- **No casino cues** in the UI: no flashing tickers, no celebrating price moves.
- **Plain language.** Write for a smart 14-year-old with no investing background: explain every term where it appears, give every number a comparison, and only point at numbers the player can see.

## Conventions

- Files and folders: lower_snake_case, except conventional names (`README.md`, `CLAUDE.md`, `LICENSE`, framework config files).
- Never commit secrets, API keys or player data. Use environment files that are gitignored.
- No real children's names in code, fixtures or docs; use invented names.
- When you make or change a technical decision, add or update its row in the decision log in `docs/build_spec.md` (Decided / Proposed / Open).
- When game rules change, update `docs/concept.md` in the same change.
- New concepts go in `content/concepts.yaml` with `status: draft`.
- When a screen, lesson or coach line needs a real number, add it to `docs/data_needs.md`.
