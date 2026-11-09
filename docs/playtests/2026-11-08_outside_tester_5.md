# Outside tester 5: coach chat lost on refresh

**Date:** 2026-11-08 (note left 7:34 PM Pacific). **Source:** GitHub issue #5, one note from the coach screen, mid-conversation on Nvidia, experience "some". **Reviewed by:** Claude Code the same evening (the morning job would have picked it up on 11/09); Jeff said to fix it first, before the real build starts.

## The note

> it doesn't save your conversation if you accidentally refresh the page which is very annoying

## What was wrong

`CoachChat` kept the transcript, the turn counter and the coach's pending reply in component state and always started a fresh conversation on mount. The store saved `coachLog` after each coach reply, but only so feedback notes could show what the coach said; nothing read it back. The onboarding coach screen's "done" flag was component state too, so a refresh after the last question also hid "Write my thesis". Everything else (thesis, pick, profile) already survived a refresh; the coach was the one screen that didn't.

A second problem found on the way: the term-sheet mini-chat (the `explain` mode behind tappable terms) wrote to the same `coachLog`, so tapping a term during a pick conversation overwrote the answers the thesis screen offers as "Start from my answers".

## What changed

- New `coachSession` in the store beside `coachLog`: a key (mode, company, facts), the turn count and the coach's last reply with its chips. Written after every player message and every coach reply.
- `CoachChat` mounting with a matching key and a non-empty log resumes: transcript restored, chips replayed; if the log ends on a player message (refreshed while the coach was typing), the coach answers it; if the last reply was `done`, `onDone` fires so the next-step button comes back. Screens that start a new conversation still reset `coachLog`, which is what makes a key match start fresh.
- `explain` mode no longer writes to the store.

Checked in a browser on the dev server: resume after a mid-conversation reload, reload during the coach's typing, and reload after the conversation finished (the thesis button returns). Scouting chats from Learn, the private-company chat, the sell chat and lesson round 3 use the same component and get the same behavior.

## For the real build

Conversations are stored server-side turn by turn, so a refresh, a locked phone or a switch of devices resumes mid-conversation (see `docs/build_plan.md`).
