#!/bin/bash
# Installs (or reinstalls) the daily playtest-feedback review on this Mac. Idempotent.
set -euo pipefail
LABEL=com.jkeltner.owners-club.feedback-review
SRC="$(cd "$(dirname "$0")" && pwd)/$LABEL.plist"
DST="$HOME/Library/LaunchAgents/$LABEL.plist"
mkdir -p "$HOME/Library/Logs/owners-club"
CLONE="$HOME/Code/owners-club-review"
if [ ! -d "$CLONE/.git" ]; then
  mkdir -p "$(dirname "$CLONE")"
  git clone -q https://github.com/jkeltner/owners-club.git "$CLONE"
  echo "Cloned the repo to $CLONE for the job."
fi
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
cp "$SRC" "$DST"
launchctl bootstrap "gui/$(id -u)" "$DST"
launchctl print "gui/$(id -u)/$LABEL" | grep -E "state|next" || true
echo "Installed. Run now with: launchctl kickstart gui/$(id -u)/$LABEL"
