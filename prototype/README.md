# Owners Club clickable prototype

A phone-first, fake-data prototype for playtesting. See [the prototype brief](../docs/prototype_brief.md). No backend, no accounts, no real market data. Expect to throw most of it away.

## Run it

```sh
npm install
npm run dev      # http://localhost:5179, also reachable on your network and tailnet
npm run build    # static files in dist/, ready for GitHub Pages
```

To playtest on a phone, run `npm run dev` and open the "Network" URL it prints, from a phone on the same Wi-Fi.

## What's in it

1. **The first 15 minutes:** invite, join, "you already own the market", curiosity screen (search + themes), company card (P/E next to a typical company's, and a "what matters" panel with a number for every metric it names) or the SpaceX/OpenAI/Anthropic private-company path, coach chat (with a mock mic), thesis + prediction, sizing (25% cap, fee shown), rank earned.
2. **Club:** friends' theses, the weekly recap (Bell + one concept), a chat stub.
3. **Portfolio:** "Today", plus a "5 months later" demo with the drift chart, after-tax view and gain breakdown. Each holding shows its tax if sold today; tap 📈 for its price chart over 3, 6, 9 or 12 months. A breakdown shows how much each holding pulls your average P/E up or down.
4. **Sell now vs. wait:** from Costco in the 5-months-later view.
5. **Leaderboard:** a "how the board works" explainer, main board with risk columns, plus the rookie, long-term, risk-adjusted and predictions boards. Tap a player to see their holdings (a week late, shares only) and the thesis behind each.
6. **Learn:** a first-visit explainer, your path (ranks plus the concepts for the next one), the next step, a suggested lesson, scouting reports, six time machine replays and every concept by rank.
   - **Lessons** (three rounds each), one per format: P/E (talk it through), diversification (time machine), profit margins (sort it), costs and taxes (what if), luck vs. skill (run it 100 times), already priced in (spot the flaw). Other concepts open their term sheet, marked "Lesson coming".
   - **Time machine:** one big winner (2022), four tech stocks (2022), the COVID crash (2020), the hottest company (2000), ten years of picking (2014 to 2023), the cheap chipmaker (2018). Blind, with a reveal and a coach debrief.
   - **Scouting reports:** "Scout it" on any company page after your first pick. Same thesis and prediction, no money; shows under Scouting on the portfolio and marks concepts applied.
7. **Me:** profile, rank (taps through to Learn), club rules and restart.

Underlined terms anywhere (in the coach's messages too) open a sheet with a plain explanation, a "go deeper" link to the lesson, what's normal, an example, a check question and "ask the coach". Returning players open on the feed.

The ✎ button at the top right of every screen saves a feedback note to the browser, with the screen name and a snapshot of the game (company, draft thesis, pick, the last few coach messages, concepts learned); "Copy all notes" puts them on the clipboard, and "Clear notes" (tap twice) deletes them. "Restart the prototype" on the Me tab resets everything except the notes.

## Where things are

- `src/content.ts` loads `../content/*.yaml` at build time: concept names, kid explanations, check questions, sector lenses, themes and the time machine scenario.
- `src/components/terms.tsx`: tappable terms (`<Linked text="..." />`) and the concept sheet. Definitions come from `concepts.yaml` and `glossary.yaml`.
- `src/data/`: fake companies, the per-sector panel numbers (`lens_metrics.ts`), the fake club, demo-season numbers and time machine prices. All invented.
- `src/lib/rules.ts`: fee, cap, hold and tax rules (per-club defaults from the concept doc).
- `src/screens/learn.tsx`, `lesson.tsx`, `replay.tsx`, `lessons/rounds.tsx`: the Learn tab. Lesson text is in `content/lessons.yaml`; replay prices and debrief lines in `src/data/time_machine.ts`; rank and unlock rules in `src/lib/ranks.ts`.
- `src/coach/coach.ts`: the scripted coach. `askCoach()` is the one function to swap for a Claude API call later; `tagger.ts` is the stand-in for the concept tagger.
- `src/state/store.tsx`: all state, saved in localStorage.

## Shortcuts taken

- The time machine charges fees but leaves out taxes. Replay prices are made up, shaped like the real stretches.
- "Prototype: open every lesson" at the bottom of Learn skips the Level 3 unlock rule for playtesting.
- Lesson round 3 is scripted: one push back chosen by keywords, then a wrap-up. The real coach will respond to what the player actually says.
- The luck simulation uses made-up spreads (40%, 24% and 8% a season) instead of real volatility.
- Ranks count every concept, since all concepts in the catalog are still `draft`.
- "Ask the coach" on a term only answers two scripted questions; the real coach will answer anything.
- Sector P/E ranges (`typical_pe` in `sector_lenses.yaml`) are rough and need checking against current sector medians.
- Avatars are a placeholder set until students pick.
