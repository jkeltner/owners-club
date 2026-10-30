# 2026-10-30: Founder review of round 5

**Who:** the project lead, reviewing the round 5 changes on the local dev server before deploying them. Two notes are from an earlier pass on 2026-10-22 that hadn't been filed.
**How:** in-app ✎ notes, copied out of the local build (localhost doesn't file GitHub issues).

## Notes

| Screen | Note | What we did |
| --- | --- | --- |
| market | "What's the market?" and "Why start here?" don't need quotes. Once expanded, there's no way to shrink them back. | Dropped the quotes. Both explainer cards now fold both ways: the teaser with + when closed, the title with − when open. |
| feed | The home page shows comments on activities, but it's not clear how to leave one. | Every thesis card now has a comment box under its comments ("Ask Maya about Costco…"), and your comments stay with the thesis. Comments attach to the thesis, per the concept doc, so the box is right under the reasoning it's about. |
| learn | If I need to use concepts in a thesis or scouting report, make sure we can get there from here; kids should level up quickly. Make the phrases clearer: a thesis is tied to a purchase, and what is a scouting report tied to? Is there a path from scouting report to purchase? | Thesis and scouting report are now glossary terms, tappable wherever they appear: a thesis is the reason you write when you buy; a scouting report is the same thing for a company you don't buy. The rank rules say "in theses (when you buy) or scouting reports (when you don't)". Every concept's sheet on Learn has "Use it: scout a company with the coach", and the rank path has "Scout a company using {next concept}". A saved scouting report has "Make it a pick" (on the scouted screen and in the portfolio): the thesis and prediction carry over, then you size it. The scouting report on that company is replaced by the pick. |
| learn | Clicking from a concept to a scouting report should have the coach walk the student through using that concept to make a decision. | New coach mode, `scout`, started from Learn with a focus concept. Three turns: the concept on this company's numbers with a comparison, a question, the coach's follow-up, then "more or less likely to beat the market?", then hand over to the report with the concept's example thesis. One scripted fact per concept (all 19) in `prototype/src/coach/concept_facts.ts`; the live coach will do this from the concept record and the company's data. The thesis screen shows what you told the coach, "Start from my answers", and a reminder to put the number in. |
| me | Make the use of "How much you know about stocks" clearer. The small text changes with the answer and the coach adapting makes sense, but make it clearer. | Replaced the one-line note with a card per answer: what the coach does, what the explainer cards do, what lessons do, and a fixed line that the rules, scoring and rank are the same for everyone. The intro line says it changes how much gets explained, never the rules. |
| portfolio (10/22) | There should be a way to start a buy from the Portfolio page. | "Make another pick" on the portfolio (Today view) opens the company browser with the tab bar kept, then the usual coach, thesis and size steps. The money comes out of whatever index money is left, still capped at 25%. Later picks show as holdings and as thesis cards in the feed; they don't re-award Shareholder. |
| feed (10/22) | (a) Let players buy any NYSE or Nasdaq stock, maybe with a minimum float or volume, not just the S&P 500. (b) Put earnings calls and large moves in the "New on the market" card. | (b) The card is now "This week on the market": companies in the game reporting earnings in the next 7 days, each with what to watch for its kind of business and which clubmates own it, then the new listings. Large price moves are not shown: the design principles rule out celebrating price moves, and a move only matters here when earnings explain it, which the earnings list covers. (a) Not changed. The concept doc's "Curated stock list" rule (S&P 500 only) exists to keep out penny stocks and meme names and to guarantee clean fundamentals; widening it also undercuts the new-listings card's "not buyable yet" lesson. Needs a decision: see below. |

## Observations

- Two of the five new notes were about the same gap: the Learn tab explained what counts for a rank but offered no way to go do it. The fix is a path from every concept to a coach-led scouting report, which is also the concept doc's "fastest way to level up".
- The experienced-tester thesis pattern from rounds 4 and 5 (skipping the numbers the coach raised) is what the scout coach's "put the number in it" hand-off is for. Watch whether scouting reports written this way get tagged "applied" more often than first-pick theses.

## Decisions

- Comments on theses are written inline on the thesis card, not in the club chat.
- Scouting from the Learn tab always goes through the coach, focused on one concept. Scouting from a company page ("Scout it") stays direct.
- A scouting report can become a pick; the pick replaces the report for that company.
- Price moves don't appear in the feed; earnings dates do, with what to watch.
- The 25% cap on later picks is measured against the starting $10,000, like the first pick, until the real portfolio math lands.

## Open

- **Buyable universe.** Keep the S&P 500 only (current rule), or widen to any NYSE or Nasdaq stock above a size and volume floor? If widened: which floor, what happens to the "not buyable yet" lesson on new listings, and where do clean fundamentals come from for small companies. Decision for the project lead; recorded in the build spec's decision log as Open.
