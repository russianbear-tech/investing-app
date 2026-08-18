#!/bin/bash
# ---------------------------------------------------------------
#  Double-click this to get the latest version of the app.
#  It downloads the newest code, then installs anything new it
#  needs.
# ---------------------------------------------------------------
cd "$(dirname "$0")" || exit 1

echo ""
echo "  Getting the latest version..."
echo ""
if ! git pull; then
  echo ""
  echo "  ---------------------------------------------------------"
  echo "   Something went wrong. Screenshot this window and send it"
  echo "   over - the message above says what happened."
  echo "  ---------------------------------------------------------"
  echo ""
  exit 1
fi

echo ""
echo "  Installing any new packages (this can take a minute)..."
echo ""
if ! npm install; then
  echo ""
  echo "  Install failed - see the message above."
  echo ""
  exit 1
fi

echo ""
echo "  ============================================"
echo "   Up to date. Double-click start.command."
echo "  ============================================"
echo ""
