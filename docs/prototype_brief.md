# Clickable prototype brief

**Goal:** a clickable, phone-first prototype of Owners Club that a 14-year-old can play with for 15 minutes, so we can watch where they get excited, confused or bored before building the real app. This is the "Design iteration" decision in the [build spec](build_spec.md).

**Not the goal:** a working game. No backend, no accounts, no real market data, no real trades. Everything runs on fake data in the browser. Expect to throw most of the code away; optimize for speed of iteration and for how it feels.

## Constraints

- **Phone first.** Design for a 390px-wide screen; it should still work on a laptop.
- **Static site.** One small front-end app (Vite + React + TypeScript is a good default) that builds to static files, so it can be hosted on GitHub Pages and opened from a link on a kid's phone.
- **Fake data only.** One `prototype/src/data/` folder of JSON or TypeScript fixtures: about 15 companies with made-up but plausible numbers, a fake club of 5 friends with theses and portfolios, and price series for one time machine scenario. Read concept names and kid explanations from `content/concepts.yaml`, sector lenses from `content/sector_lenses.yaml`, and themes from `content/themes.yaml` (copy or import them at build time).
- **Scripted coach.** The coach's side of each conversation is scripted, with 2 or 3 branches based on what the kid types or taps. Structure it so a live Claude API call can replace the script later, behind one function.
- **No secrets** in the repo, ever.

## Design direction

- **A game, not a brokerage.** It should feel closer to a sports or fantasy app than to a trading app. Big type, bold color, clear progress, friendly copy.
- **Avoid casino cues.** No flashing red and green tickers, no confetti for price moves, no live-updating numbers. Prices update once a day, so show them calmly.
- **Celebrate thinking.** The fun moments are writing a thesis, ranking up, a prediction coming true, earning the Bell. Animate those, not gains.
- **Short words, short screens.** A 14-year-old should never have to read a paragraph to know what to tap next.
- **Show the shape of risk.** Concentration, after-tax value and "vs. the S&P 500" are always visible, never hidden in a details page.

## Screens and flows

Build in this order. Each item lists what a playtester should be able to do.

### 1. The first 15 minutes (most important)

Follows "The first 15 minutes" in the [concept doc](concept.md).

1. **Invite and join.** Land from an invite ("Alex invited you to Pasadena Owners Club"), pick a display name and avatar.
2. **You already own the market.** Show $10,000 in the S&P 500 index fund: "You already own a small piece of 500 companies." Show the club leaderboard with the new player tied with the market.
3. **Curiosity screen.** "What companies do you use, love, or think will be huge?" A search box plus theme tiles (from `themes.yaml`).
4. **Two paths from a name:**
   - **Nvidia (buyable):** company card with price, a 1-year chart, revenue, earnings, P/E and the sector lens. Tap "Make a pick" to start the coach.
   - **SpaceX (not buyable):** a short, friendly explainer of private vs. public companies, then the coach asks which public companies would do well if space takes off, linking to the space theme.
5. **Coach conversation.** Two or three questions, chat-style, with a mock voice-input button. The signature question: "Everyone knows AI is huge, so what's already in the price?"
6. **Thesis and prediction.** A short "why I'm buying" text box, plus a prediction picked from a menu of measurable metrics (revenue growth, EPS, margin) with a number.
7. **Size the pick.** A slider moving money from the index into the pick, capped at 25% ($2,500). Show the 0.5% fee before confirming.
8. **Done.** Shareholder rank earned, with an animation. "Nvidia reports in 23 days. We'll see if you were right." The thesis appears in the club feed.

### 2. Club feed

Friends' theses ("Maya bought Costco because..."), a chat stub, and a weekly AI recap card that announces who holds the Bell and slips in one concept.

### 3. Portfolio page

Holdings including the index, total value, unrealized tax and after-tax value side by side, fees and taxes paid to date, and the drift chart (each holding's share of the portfolio over time). For a winner, show the "what drove this gain" split: earnings growth vs. investors paying more.

### 4. Sell now vs. wait

From a holding bought 5 months ago with a $200 gain: "Sell now: you keep $1,120. Wait 23 more days: you keep $1,160." The 3-month lock should show on positions bought less than 3 months ago.

### 5. Leaderboard

Main board: 6-month return vs. the S&P 500, with the risk columns (holdings, largest position, weighted P/E). Tabs for the rookie, long-term, risk-adjusted and predictions boards. The Bell holder marked.

### 6. Time machine

*Update, 2026-10-19: the Time machine tab became the Learn tab, which holds all six replays plus lessons and scouting reports. See [the Learn tab design](learn_tab_sketch.md).*

One blind scenario from `content/scenarios.yaml` (use `single-big-tech-2022` with fake but realistic-shaped prices). Hold, trim or sell at three checkpoints, then the reveal and two debrief questions.

### 7. Ranks and concept progress

*Update, 2026-10-19: rank progress and the concept list moved to the Learn tab; Me keeps the profile.*

A simple profile showing the player's rank, the next rank's requirements, and which concepts are encountered, explained or applied.

## Feedback capture

Add a small feedback button on every screen that saves a note with the screen name (local storage is fine) and can copy all notes to the clipboard. Later it will file GitHub issues; see the build spec's decision log.

## Playtest checklist

Watch, don't help. Afterward, note:

- Where did they hesitate, and what did they tap first?
- Did they understand that they started in the index?
- Did the coach feel like a friend or like homework? Did they skip it?
- Could they explain their own thesis afterward?
- Which screen did they want to go back to?
- Would they open it again tomorrow? What would make them?

Log findings in `docs/playtests/` as one dated Markdown file per session.
