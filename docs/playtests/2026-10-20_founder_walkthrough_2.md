# 2026-10-20: Founder walkthrough 2

**Who:** the project lead, solo, on the prototype with the Learn tab.
**How:** in-app ✎ notes, pasted in one batch.

## Notes

| Screen | Note | What we did |
| --- | --- | --- |
| feed | What's the right home screen for a returning player? Probably the feed. | Returning players with a portfolio now open on the feed. Players still onboarding resume where they left off. |
| board | Can players see each other's portfolios? | Yes, per the concept doc (shared theses, holdings a week late). Tap a player for their holdings as shares of the whole, never dollars, each with its thesis. |
| learn | The rank box is unclear; it doesn't say what the numbers mean or how to level up. | Replaced with "Your path": the four ranks, the concepts needed for the next one with each one's status, and the next step. |
| company | P/E scale with the typical S&P 500 company and the sector range works well. | Kept. The company page price chart now has price and date axes too. |
| company | Underlined terms are right; add a "dive deeper" link. | Term sheets now have "Go deeper: the N-minute lesson" (or "See where it fits in Learn"). Back returns to where you were. |
| portfolio | Holding chart needs axes, 3/6/9/12-month views, and a visible open/close control. | Price lines and dates on the chart, 3M/6M/9M/1Y chips, and a "📈 Show price chart" button on every holding. |
| learn | First visit needs a dismissible explainer on leveling up. | Added "How leveling up works" (ranks, the three dots, theses prove). Dismissed once, reopen from "How ranks work". |
| learn | The concept path gets lost below the fold. | The path is now the first card; scouting and the time machine moved under "Practice"; "All concepts" lists only the other ranks. |

## Decisions

- Home screen for returning players is the feed.
- Clubmates' portfolios are visible: shares only, a week late, with theses.
- Next: host the prototype on Vercel (public, no password) and file ✎ notes as GitHub issues.
