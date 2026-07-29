#!/bin/bash
# ENG301 Student Outcomes Dashboard — Linux launcher.
# Run ./linux_run.sh in a terminal (or double-click if your file manager
# supports executing shell scripts).
# Starts the Vite dev server and opens the dashboard in your browser.
# Press Ctrl+C (or close the terminal) to stop the server.

set -e
cd "$(dirname "$0")"

PORT=5173
URL="http://localhost:$PORT"

echo "== ENG301 Dashboard launcher =="

# Node available?
if ! command -v npm >/dev/null 2>&1; then
  echo ""
  echo "ERROR: Node.js/npm not found."
  echo "Install Node.js (LTS) from https://nodejs.org (or your distro's package manager) and run this again."
  read -r -p "Press Enter to close..."
  exit 1
fi

# Pick a browser-opener.
open_url() {
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$1" >/dev/null 2>&1 &
  elif command -v gio >/dev/null 2>&1; then
    gio open "$1" >/dev/null 2>&1 &
  else
    echo "Open $1 in your browser."
  fi
}

# Already running? Just open the browser.
if curl -sf "$URL" >/dev/null 2>&1; then
  echo "Dashboard is already running at $URL — opening browser."
  open_url "$URL"
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
      open_url "$URL"
      exit 0
    fi
    sleep 1
  done
) &

echo "Starting dev server at $URL  (press Ctrl+C to stop)"
npm run dev -- --port "$PORT" --strictPort
