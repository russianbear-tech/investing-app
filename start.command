#!/bin/bash
# ---------------------------------------------------------------
#  Double-click this to run the app.
#
#  It checks for a new version first, so opening the app is all
#  you ever need to do. If you're offline, or the check fails for
#  any other reason, it just starts the version you already have.
#
#  Leave the Terminal window open while you're using it - closing
#  it stops the app.
# ---------------------------------------------------------------
cd "$(dirname "$0")" || exit 1

NEED_INSTALL=0
[ -d node_modules ] || NEED_INSTALL=1

if command -v git >/dev/null 2>&1 && [ -d .git ]; then
  echo ""
  echo "  Checking for updates..."
  BEFORE=$(git rev-parse HEAD:package-lock.json 2>/dev/null)
  # --ff-only so this can only ever fast-forward. It will refuse rather than
  # attempt a merge, which keeps a failed update from leaving a broken folder.
  if git pull --ff-only; then
    AFTER=$(git rev-parse HEAD:package-lock.json 2>/dev/null)
    # Only reinstall when the dependency list actually moved.
    [ "$BEFORE" != "$AFTER" ] && NEED_INSTALL=1
  else
    echo ""
    echo "  Couldn't check for updates - starting the version you have."
  fi
fi

if [ "$NEED_INSTALL" = "1" ]; then
  echo ""
  echo "  Installing what the app needs. This takes a minute."
  echo ""
  npm install || { echo ""; echo "  Install failed - see the message above."; exit 1; }
fi

echo ""
echo "  Starting up. When you see \"Ready\", open this in your browser:"
echo ""
echo "      http://localhost:3000"
echo ""
echo "  Press Ctrl+C or close this window to stop the app."
echo ""
npm run dev
