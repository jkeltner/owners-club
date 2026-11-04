# Playtest feedback review

How tester notes get read and turned into recommendations. Decided 2026-11-04; the same setup as the Deep Thoughts feedback loop.

## The loop

1. **Notes become issues.** The ✎ button on the hosted prototype posts to `api/feedback.ts`, which files one GitHub issue per tester per day, labeled `playtest-feedback`, with one comment per note and a game-state snapshot. Testers get a random ID, never a name.
2. **Claude reviews them every morning.** A launchd job on the Mac mini (`com.jkeltner.owners-club.feedback-review`, 6:50 AM Pacific) runs `scripts/review_feedback.sh`, which runs Claude Code headless with the project skill `.claude/skills/review-feedback/SKILL.md`. For each unreviewed issue it reads every note against the product rules, the concept doc, earlier playtest logs and the prototype code, posts a comment (Recommend / Discuss / Decline, effort S/M/L, the concrete change) and adds the `reviewed` label. The report is saved to `~/Library/Logs/owners-club/reviews/<date>.md` and emailed to Jeff as HTML (Gmail shows Markdown as literal asterisks, so `scripts/md_to_html.py` converts it first).
3. **Nothing changes automatically.** Jeff reads the report and tells Claude Code which recommendations to implement. That is when code gets written, the batch is logged in `docs/playtests/`, and the issues get closed.

The job is read-only on the repo: the runner's tool allowlist permits reading files, `gh issue list/view/comment/edit` and `git log/show/diff`, and blocks edits, commits, pushes and closing issues.

## Running it

- Install or reinstall on the mini: `scripts/launchd/install.sh` (clones the repo to `~/Code/owners-club-review` the first time).
- Run now: `launchctl kickstart gui/$(id -u)/com.jkeltner.owners-club.feedback-review`, or `scripts/review_feedback.sh` by hand from either checkout.
- Review a specific issue interactively: `/review-feedback` in Claude Code in the project.
- Logs: `~/Library/Logs/owners-club/review_feedback.log`; Claude's own stderr in `review_feedback.claude.err`.
- Turn email off by setting `FEEDBACK_REVIEW_EMAIL` to an empty string in the plist.

## Why this shape

- **Runs from a clone in `~/Code`, not the working copy in `~/Documents`.** macOS blocks launchd jobs from reading `~/Documents` ("Operation not permitted") without a Full Disk Access grant. The clone is reset to `origin/main` before each run, so the review only sees pushed code: push `main` after changing the skill.
- **launchd rather than a Claude Code cron or a cloud routine.** The local cron is session-only and expires after seven days. A cloud routine would need its own GitHub token wired in and can't reuse the `gh` login on the mini; worth revisiting if the mini becomes a bottleneck.
- **Quiet days send nothing.** The runner counts unreviewed issues with `gh` before starting Claude, so a day with no new notes costs no model run and no email.
