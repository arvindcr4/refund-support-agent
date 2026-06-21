#!/usr/bin/env bash
# Start the backend (uvicorn :8000) and the frontend (npm run dev) together.
# Ctrl-C (SIGINT) cleanly tears both processes down.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

backend_pid=""
frontend_pid=""

cleanup() {
  echo
  echo "[dev] shutting down..."
  [ -n "$frontend_pid" ] && kill "$frontend_pid" 2>/dev/null || true
  [ -n "$backend_pid" ] && kill "$backend_pid" 2>/dev/null || true
  wait 2>/dev/null || true
  echo "[dev] stopped."
}
trap cleanup SIGINT SIGTERM EXIT

# --- backend ---
echo "[dev] starting backend on http://localhost:8000 ..."
(
  cd "$BACKEND_DIR"
  # shellcheck disable=SC1091
  source .venv/bin/activate
  exec uvicorn app.main:app --reload --port 8000
) &
backend_pid=$!

# --- frontend ---
if [ -f "$FRONTEND_DIR/package.json" ]; then
  echo "[dev] starting frontend (npm run dev) ..."
  (
    cd "$FRONTEND_DIR"
    exec npm run dev
  ) &
  frontend_pid=$!
else
  echo "[dev] no frontend/package.json found - skipping frontend."
fi

echo "[dev] running. Press Ctrl-C to stop."
wait
