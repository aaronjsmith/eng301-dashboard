#!/bin/bash
# ENG301 Student Outcomes Dashboard — macOS launcher.
# Double-click this file in Finder (or run ./mac_run.command in Terminal).
# Starts the Vite dev server and opens the dashboard in your browser.
# Close this window (or press Ctrl+C) to stop the server.

set -e
cd "$(dirname "$0")"

PORT=5173
URL="http://localhost:$PORT"

echo "== ENG301 Dashboard launcher =="

# Node available?
if ! command -v npm >/dev/null 2>&1; then
  echo ""
  echo "ERROR: Node.js/npm not found."
  echo "Install Node.js (LTS) from https://nodejs.org and run this again."
  read -r -p "Press Enter to close..."
  exit 1
fi

# Already running? Just open the browser.
if curl -sf "$URL" >/dev/null 2>&1; then
  echo "Dashboard is already running at $URL — opening browser."
  open "$URL"
  exit 0
fi

# First run: install dependencies.
if [ ! -d node_modules ]; then
  echo "First run — installing dependencies (one-time, ~1 min)..."
  npm install
fi

# Open the browser once the server actually responds.
(
  for _ in $(seq 1 60); do
    if curl -sf "$URL" >/dev/null 2>&1; then
      open "$URL"
      exit 0
    fi
    sleep 1
  done
) &

echo "Starting dev server at $URL  (close this window to stop)"
npm run dev -- --port "$PORT" --strictPort
