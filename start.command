#!/bin/bash
# ---------------------------------------------------------------
#  Double-click this to run the app.
#  Leave the Terminal window open while you're using it - closing
#  it stops the app.
# ---------------------------------------------------------------
cd "$(dirname "$0")" || exit 1

if [ ! -d node_modules ]; then
  echo ""
  echo "  First run - installing what the app needs. This takes a"
  echo "  minute or two, and only happens once."
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
