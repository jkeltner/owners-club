#!/bin/bash
# Daily playtest-feedback review: runs Claude Code headless with the
# review-feedback skill (.claude/skills/review-feedback/SKILL.md), saves the
# report to ~/Library/Logs/owners-club/reviews/<date>.md and emails it as HTML.
# Recommends only: the skill forbids code changes and the tool allowlist below
# enforces it. See docs/feedback_review.md.
#
# It runs from its own clone of the repo (~/Code/owners-club-review), not the
# working copy in ~/Documents: macOS blocks launchd jobs from ~/Documents
# (TCC "Operation not permitted"). The clone is reset to origin/main before each
# run, so push to make the review see new code or a changed skill. Installed by
# scripts/launchd/install.sh; run by hand with `scripts/review_feedback.sh`
# from either checkout.
set -uo pipefail

REPO="jkeltner/owners-club"
LABEL="playtest-feedback"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$HOME/Library/Logs/owners-club"
REPORT_DIR="$LOG_DIR/reviews"
DATE="$(date +%Y-%m-%d)"
# Who gets the report. Set FEEDBACK_REVIEW_EMAIL="" in the launchd plist to turn email off.
TO="${FEEDBACK_REVIEW_EMAIL-jkeltner@gmail.com}"
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

mkdir -p "$REPORT_DIR"
cd "$REPO_DIR" || exit 1
echo "[$(date -Iseconds)] review_feedback start in $REPO_DIR"

# Bring the clone up to date, unless someone is editing in it.
if [ -z "$(git status --porcelain)" ]; then
  git fetch -q origin && git reset -q --hard origin/main && echo "at $(git log -1 --format='%h %s')"
else
  echo "working tree has local changes; not syncing to origin/main"
fi

# Nothing to do? Then don't spend a model run.
open_count="$(gh issue list --repo "$REPO" --label "$LABEL" --state open --limit 100 --json number,labels \
  --jq '[.[] | select(all(.labels[]; .name != "reviewed"))] | length')" || { echo "gh failed; is it logged in?"; exit 1; }
if [ "$open_count" = "0" ]; then
  echo "No unreviewed playtest issues. Done."
  exit 0
fi
echo "$open_count unreviewed issue(s); starting Claude."

REPORT="$(mktemp)"
# Read-only on the repo, write-only to issue comments and the `reviewed` label.
claude -p "/review-feedback" \
  --output-format text \
  --strict-mcp-config \
  --allowedTools \
    "Read" "Glob" "Grep" \
    "Bash(gh issue list:*)" "Bash(gh issue view:*)" "Bash(gh issue comment:*)" \
    "Bash(gh issue edit:*)" "Bash(git log:*)" "Bash(git show:*)" "Bash(git diff:*)" \
  --disallowedTools "Edit" "Write" "NotebookEdit" "Bash(git commit:*)" "Bash(git push:*)" "Bash(gh issue close:*)" "Bash(gh issue delete:*)" \
  > "$REPORT" 2> "$LOG_DIR/review_feedback.claude.err"
status=$?
echo "claude exited $status"

if [ "$status" -ne 0 ] || [ ! -s "$REPORT" ]; then
  echo "Review failed; see $LOG_DIR/review_feedback.claude.err"
  tail -20 "$LOG_DIR/review_feedback.claude.err"
  exit 1
fi

if grep -q "^No new feedback to review\.$" "$REPORT"; then
  echo "Claude found nothing new."
  exit 0
fi

out="$REPORT_DIR/$DATE.md"
# A second run the same day appends rather than overwrites.
if [ -s "$out" ]; then { echo; echo "---"; echo; cat "$REPORT"; } >> "$out"; else cp "$REPORT" "$out"; fi
echo "Report saved to $out"

if [ -z "$TO" ]; then
  echo "Email off (FEEDBACK_REVIEW_EMAIL is empty)."
elif command -v gws >/dev/null 2>&1; then
  # Gmail renders Markdown as literal asterisks, so send HTML.
  BODY="$(python3 "$REPO_DIR/scripts/md_to_html.py" --issues "$REPO" < "$REPORT")"
  gws gmail +send --to "$TO" --subject "Owners Club playtest review, $DATE" --body "$BODY" --html >/dev/null \
    && echo "Emailed to $TO" || echo "Email failed (gws); report is on disk."
else
  echo "gws not installed; report is on disk only."
fi
echo "[$(date -Iseconds)] review_feedback done"
