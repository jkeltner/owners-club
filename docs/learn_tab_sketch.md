# Learn tab: sketch

**Status:** approved 2026-10-19 and built in the prototype. Decisions: Level 3 concepts can be peeked at but their lessons open only after their prerequisites are used in a thesis (the concept doc's rule, rather than after all of Board Member); Micron 2018 added as the peak-cycle replay; all six formats kept for playtesting.

The Learn tab replaces the Time machine tab. It answers three questions in order: where am I, what should I do next, and what else is there. Me keeps profile, settings and restart, plus a small rank badge that links here.

## 1. Learn home

```
┌─────────────────────────────────────┐
│ Learn                               │
│                                     │
│ ┌─ Your rank ─────────────────────┐ │
│ │ Shareholder  →  Owner           │ │
│ │ ● ● ◐ ○   2 of 4 used in a thesis│ │
│ │ Next: use "the index as a       │ │
│ │ benchmark" in a thesis.          │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Up next ───────────────────────┐ │
│ │ P/E ratio · 3 min               │ │
│ │ You've tapped it twice. Want    │ │
│ │ the full version?          ▸    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─ Scouting report ───────────────┐ │
│ │ Write a thesis on any company   │ │
│ │ without buying it. It gets      │ │
│ │ scored at earnings, and it      │ │
│ │ counts for your rank.      ▸    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Time machine                        │
│ [2022: one big winner] [2022: four  │
│  tech stocks] [2020 crash] [2000]   │
│  [Ten years of picking]   ← scroll  │
│                                     │
│ All concepts                        │
│ Owner                       2 of 4  │
│  ● Market cap vs. share price       │
│  ● Revenue vs. earnings             │
│  ◐ P/E ratio                        │
│  ○ The index as a benchmark  ⏱      │
│ Board Member                0 of 8  │
│  ◔ Diversification           ⏱      │
│  …                                  │
│ Chair                       0 of 8  │
│  Opens after Board Member. Peek ▸   │
└─────────────────────────────────────┘
  Feed   Portfolio   Board   Learn   Me
```

- **Legend:** ○ not yet · ◔ seen · ◐ learned · ● used in a thesis. Ink only, no green, per the no-casino-cues rule. ⏱ means the concept has a time machine replay.
- **Your rank** comes from the profile screen. It always names one concrete next step.
- **Up next** picks one lesson. The order of preference is a concept the player has seen but not learned (seen most often first), then the next one on their rank path.
- Tapping a concept opens its lesson. If the player has already learned it, it opens the term sheet from Round 1 instead, with a "Do the lesson again" button.

## 2. A lesson: three rounds

Every lesson runs the same three rounds, about 3 minutes. That's the 2 or 3 rounds of back-and-forth from your note. The coach runs it in the chat style players already know, with answer chips plus a free-text box.

| Round | What happens | P/E example |
| --- | --- | --- |
| **1. See it** | An everyday example and one question to predict the answer. | "A lemonade stand makes $1,000 a year. Someone offers $23,000 for it. How many years until they get their money back?" Chips: 2 · 23 · 230 |
| **2. Try it on a real company** | The same idea, using numbers the player can see in the game. If they own a stock, the lesson uses it. | "Nvidia's P/E is 45 and Coca-Cola's is 25. Which one are buyers expecting to grow faster? How can you tell?" |
| **3. Your turn** | A judgment question with no single right answer. The coach pushes back once, then wraps up. | "What would have to be true for Nvidia to be worth 45 years of profits?" The player answers, and the coach asks: "And if growth slows to 10%?" |

At the end, the concept is marked **learned**, the same as passing a check question. The last card says: "To count it for your rank, use it in a thesis. Try a scouting report on Coca-Cola ▸". Quizzes teach and theses prove, so a lesson never marks a concept used.

## 3. Different formats for different concepts

Not every concept works as a conversation. Six formats cover all 20 concepts. Each one still follows the three rounds; what changes is round 2.

| Format | Round 2 is… | Concepts |
| --- | --- | --- |
| **Talk it through** | A coach conversation using the company's real numbers | Market cap, revenue vs. earnings, P/E, debt, free cash flow, price-to-book, ROIC |
| **Time machine** | A blind replay of history with hold, trim or sell decisions | The index as a benchmark, diversification, correlation, peak-cycle earnings (needs a new scenario), already priced in |
| **Sort it** | Drag 4 companies into order, or match each one to its metric | Profit margins (Costco vs. Coca-Cola vs. Nvidia), market cap (a $150 stock bigger than a $700 one), sector yardsticks (which number matters for a bank?) |
| **What if** | Sliders that change one number while the result updates | Costs and taxes (sell now or after 6 months), dividends (reinvest for 10 years), PEG, Rule of 40, earnings growth vs. multiple expansion (price = profit per share × P/E) |
| **Run it 100 times** | A simulation the player starts and watches | Luck vs. skill (30 players picking at random: someone "wins"), diversification (the concept doc's 8-player season) |
| **Spot the flaw** | Read a made-up friend's thesis and find the weak spot | Already priced in, peak-cycle earnings, sector yardsticks ("Biotech's P/E is 0, so it's cheap") |

## 4. Scouting report

This is the same thesis flow as a pick, without the size step:

```
Market → company → "Scout it" (next to "Buy")
  → thesis + one prediction → "Scouted. We'll check it on Nov 19."
```

It appears on the portfolio under "Scouting" with its earnings countdown, and gets scored at earnings like a real pick. Learn home links to it because it's the fastest way to rank up.

## 5. What I'd build for the prototype

- Learn home, with rank, up next, scouting report, the time machine row and the concept list.
- **One lesson for each format**, so you can judge the formats rather than the content:
  - P/E (talk it through)
  - Diversification (time machine, the existing replay)
  - Profit margins (sort it)
  - Costs and taxes (what if)
  - Luck vs. skill (run it 100 times)
  - Already priced in (spot the flaw)

  The other 14 concepts open the existing term sheet, marked "Lesson coming".
- **All five time machine scenarios,** playable, with made-up numbers.
- **Scouting reports,** from the company page to the portfolio.
- The Time machine tab goes away, and its screen moves under Learn.

## Questions for you

1. **Chair concepts before Board Member is done:** should they be locked (the concept doc says the coach unlocks them) or visible to peek at? I'd let players peek but not take the lessons: curious kids can see what's ahead, and the order still matters.
2. **Peak-cycle earnings needs a new replay.** I'd propose Micron in 2018: its P/E looked very low at the top of the memory-chip boom, then the stock fell by about half. I'd add it to `scenarios.yaml` as a draft.
3. **Are the six formats right,** or is one of them a gimmick? "Run it 100 times" is the one I'm least sure students will sit through.
