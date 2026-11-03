# 2026-11-01: Outside tester 4 (a parent, by email)

**Who:** an adult outside tester, the parent of a kid in the target age range, reviewing on their own after a 10/22 invite. They also offered to have their kid share the prototype with a friend group; no notes from that group have arrived yet.
**How:** an emailed review (no ✎ notes), organized as what works, friction, retention and the parent view, plus a question about the long-term plan (answered by the project lead directly).

## Notes

| Area | Note | What we did |
| --- | --- | --- |
| feed | What works: the thesis tied to a metric (Maya's Costco thesis anchored to 7% revenue growth), the comment threads under a thesis (Maya defending Costco's P/E), and scouting (Priya tracking Coke with no money in). "That peer sparring is where the real learning happens." | No change. These are the mechanics rounds 5 and 6 spent the most effort on. The tester read the fake club as if it were live play. |
| thesis | "The cold-start thesis trap": a 13–15 year old won't write a two-sentence investment memo from scratch. Suggested "Thesis Mad Libs": guided cards for moat, catalyst and key metric. | The thesis screen now has three short slots instead of one box: what the business does well, what I think happens next, and the number I'm watching. Each slot is free text, never a pickable card: the tagger marks concepts "applied" from the thesis text, and a template mustn't earn that for the player. "Start from my answers" fills the first two from the coach chat, and the third slot's placeholder is the coach's "worth watching" point. The saved thesis is the three slots joined, so the feed, comments and tagger don't change. The observed failure in rounds 3 to 5 was vague theses that skipped the numbers, not blank ones; the third slot is aimed at that. |
| feed | "What does a P/E of 61 mean?" reads like textbook homework. Frame it visually as a "Hype Meter" or a comparison against the S&P 500 average. | The recap card's P/E explainer (the exact line the tester quoted) now leads with the P/E scale against a typical company, under "What buyers expect", and the P/E term sheet opened from a company's numbers does the same. Not "hype": the concept's teaching notes say never to call a high P/E bad, and "hype" is a verdict. "What buyers expect" says the same thing without one, and it's the "priced in" idea by another name. |
| feed | Earnings every 90 days is too slow for teen attention. Turn upcoming reports into club showdowns: peers vote "thesis holds" or "thesis breaks" before the numbers drop. | Built as the earnings showdown: a feed card for each company reporting within 7 days that a clubmate owns or scouted, with that player's prediction and Holds / Breaks buttons. Votes stay hidden until the report, you can't vote on your own prediction, and after the report a result card shows what the company reported, whether the prediction held and how many of the club called it. Votes are social only: a "Calls" tally on the predictions board, never rank. The cadence point is weaker than it sounds: with four or more holdings plus the club's scouting reports, something reports most weeks in earnings season. The gap is the dead weeks between seasons, which the weekly replay covers. |
| learn | Lean on the time machine for off-hours and weekend engagement; historical scenarios give feedback without waiting three months. | The project lead's version: one replay per club per week, the same for everyone, chosen against the club's own theses so it runs counter to what the club believes. Built as a feed card with the reason it was picked ("three of your club's theses ride on one industry") and a line in the next recap comparing everyone's choices. Selection is one function over the club's holdings and the scenarios' concepts, the swap point for the weekly job. Individual reveals stay immediate; the card asks players not to spoil the ending in chat. |
| concept | As a parent: no leverage, no penny stocks, no crypto is "the killer differentiator". Position it as the anti-Robinhood. | Decided the open buyable-universe question: the S&P 500 only, as the concept doc already said. The project lead's own 10/22 note had proposed widening to any NYSE or Nasdaq stock above a floor; this note settled it the other way. The concept doc's curated-list rule now carries the parent reasoning. |
| concept | A weekly "shareholder update" the kid can show a parent at dinner would make it a household talking point. | Not built. The project lead's reframe: parents don't need a report, they need one nugget to open a conversation ("Costco reports Thursday; your kid predicted 7% sales growth"). Added as an open question in the concept doc and to the build spec's open technical questions, since it depends on how parent accounts and contact channels work. Opt-in by the kid. |

## Observations

- This is the first review from a parent of a target-age kid. The parent angle (what's left out: leverage, penny stocks, crypto) landed harder than any feature, which argues for a parent-facing page that says so plainly.
- The tester's three "what works" items are all social: a thesis someone can argue with, the argument under it, and watching a friend's call without betting. The showdown vote extends the same idea to the moment the thesis gets checked.
- Still no notes from a teen. The friend-group offer is the first real target-age playtest on offer; worth a nudge.

## Decisions

- Buyable universe: the S&P 500 only (decided by the project lead, 2026-11-02). Closes the Open row in the build spec.
- A thesis has three parts: what the business does well, what happens next, and the number being watched. Free text in every part.
- Showdown votes are social: they never count toward rank.
- Each club plays one shared replay a week, chosen against the club's theses. Reveals stay immediate.
- The P/E comparison is framed as "What buyers expect", never "hype".

## Open

- Parent nugget: a weekly one-liner for a parent, opted into by the kid. Channel and account model undecided.
