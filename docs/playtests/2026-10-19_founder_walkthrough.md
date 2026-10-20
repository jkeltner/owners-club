# 2026-10-19: Founder walkthrough

**Who:** the project lead, solo, on the clickable prototype (first build).
**How:** in-app ✎ notes, pasted in one batch.

## Notes

| Screen | Note | What we did |
| --- | --- | --- |
| join | Some avatars (bear, lion, panda) feel childish for teens. Need student input. | Swapped to a placeholder set (🎧 🛹 🏀 🎮 …). Ask students. |
| market | More context on why we start with $10K in the S&P 500. | Added "Why start here?": what the index is, why it's hard to beat, and that picks come out of it. |
| curious | Why is MSFT #2 in AI? Get Meta and Google up there. | AI theme is now NVDA, GOOGL, META, MSFT, AMZN, AVGO, AMD. Added Meta. |
| curious | Show an unavailable Anthropic or OpenAI to explain private companies. | OpenAI and Anthropic appear as 🔒 cards in the AI theme, with the private-company lesson. |
| company | We say free cash flow matters but don't show it. Only point at things students can see. | The "what matters" panel now shows a number next to every metric it names. Made a rule of it (concept doc principle 8). |
| company | Hyperlink key terms to an overlay with an explanation and chat. | Underlined terms open a sheet: plain explanation, what's normal, an example, a check question, "ask the coach". Works in coach messages too. |
| coach | "Priced in" isn't clear. Review all text for HS students with decent math and no investing background. | Rewrote the coach script and screen text. Added principle 8 to the concept doc and a plain-language rule to CLAUDE.md for the real coach prompt. |
| coach | "45× earnings" means nothing to a novice. Give benchmarks so kids can tell low from high. | Every P/E now comes with a typical S&P 500 company (about 23) and the sector's usual range, on a scale on the company page and in the coach's words. |
| board | The Gavel feels legal, not financial. | Renamed to **the Bell** (the bell that opens the market). |
| me | Learning is hard to find under "Me". | Decided: a **Learn tab** replaces the Time machine tab. Round 2. |
| me | One sentence per concept is weak; want a 2–3 round back-and-forth with examples. | Round 2 (Learn tab). Added `example`, `whats_normal` and `in_a_thesis` to 15 concepts as a start. |
| board | Explain how the score is calculated and how to move up. | Added "How the board works" at the top of the leaderboard. |
| portfolio | Show taxes due on each holding card. | Each card shows its tax if sold today, or that a loss lowers other taxes. |
| portfolio | Tap a holding to see its price over the holding period. | Tap a holding for its price from a few weeks before you bought through today. |
| portfolio | How does each stock shift my average P/E? | Added "What each holding does to your P/E". |
| time | Does the time machine work for other concepts? Want a learning tab with interactive lessons per concept. | Learn tab (Round 2) holds the time machine, all five scenarios, and other formats for concepts that aren't about living through history. |

## Decisions

- **The Bell** replaces the Gavel (concept doc, brief and build spec updated).
- **A Learn tab replaces the Time machine tab.** It holds rank progress, concept lessons, time machine replays and scouting reports. Me keeps profile, settings and restart. Sketch first, then build.
- **Plain language is a design principle**, not a style preference (concept doc principle 8).

## Open

- Avatars: let students choose.
- Sector P/E ranges are rough; check against current sector medians.
