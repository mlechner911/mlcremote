#!/usr/bin/env bash
set -euo pipefail

# Build helper for Windows when using Git Bash / MINGW.
# Usage: ./build-windows.sh [--no-frontend]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR" && pwd)"

NO_FRONTEND=0
if [ "${1-}" = "--no-frontend" ]; then
  NO_FRONTEND=1
fi

echo "[build-windows] repo root: $REPO_ROOT"

# Locate wails CLI
WAILS_BIN=""
if command -v wails >/dev/null 2>&1; then
  WAILS_BIN="$(command -v wails)"
fi

if [ -z "$WAILS_BIN" ]; then
  # try common Go bin locations
  if [ -n "${GOPATH-}" ] && [ -x "$GOPATH/bin/wails" ]; then
    WAILS_BIN="$GOPATH/bin/wails"
  fi
  if [ -z "$WAILS_BIN" ] && [ -x "$GOPATH/bin/wails.exe" ]; then
    WAILS_BIN="$GOPATH/bin/wails.exe"
  fi
  if [ -z "$WAILS_BIN" ] && [ -x "$HOME/go/bin/wails" ]; then
    WAILS_BIN="$HOME/go/bin/wails"
  fi
  if [ -z "$WAILS_BIN" ] && [ -x "$HOME/go/bin/wails.exe" ]; then
    WAILS_BIN="$HOME/go/bin/wails.exe"
  fi
fi

echo "[build-windows] wails: ${WAILS_BIN:-not-found}"

FRONTEND_DIR="$REPO_ROOT/wails/frontend"

# Convert to Windows path for npm on Git Bash if cygpath is available
WIN_FRONTEND_DIR="$FRONTEND_DIR"
if command -v cygpath >/dev/null 2>&1; then
  WIN_FRONTEND_DIR=$(cygpath -w "$FRONTEND_DIR")
fi

if [ $NO_FRONTEND -eq 0 ]; then
  echo "[build-windows] Installing frontend dependencies..."
  pushd "$FRONTEND_DIR" >/dev/null
  npm install

  echo "[build-windows] Building frontend..."
  npm run build
  popd >/dev/null
else
  echo "[build-windows] Skipping frontend build (--no-frontend)"
fi

if [ -z "$WAILS_BIN" ]; then
  echo ""
  echo "ERROR: wails CLI not found. Install it with:" >&2
  echo "  go install github.com/wailsapp/wails/v2/cmd/wails@latest" >&2
  echo "Ensure \$GOBIN or \$HOME/go/bin is on your PATH, or pass the full path to wails.exe in this script." >&2
  exit 1
fi

echo "[build-windows] Running: $WAILS_BIN build"
"$WAILS_BIN" build

echo "[build-windows] Done."
