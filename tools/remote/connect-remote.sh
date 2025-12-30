#!/usr/bin/env bash
set -euo pipefail

# connect-remote.sh
# Establishes an SSH tunnel from local machine to remote mlcremote server.
# Usage: ./connect-remote.sh user@host [--remote-port PORT] [--local-port PORT] [--bg]

usage() {
  cat <<EOF
Usage: $0 user@host [--remote-port PORT] [--local-port PORT] [--bg]

Options:
  --remote-port PORT   Remote mlcremote listen port (default: 8443)
  --local-port PORT    Local port to forward to (default: 8443)
  --bg                 Run tunnel in background (uses ssh -f -N)

Examples:
  $0 alice@example.com
  $0 alice@example.com --remote-port 8443 --local-port 8444 --bg
EOF
}

if [ $# -lt 1 ]; then
  usage; exit 1
fi

REMOTE="$1"
shift
REMOTE_PORT=8443
LOCAL_PORT=8443
BG=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remote-port) REMOTE_PORT="$2"; shift 2 ;;
    --local-port) LOCAL_PORT="$2"; shift 2 ;;
    --bg) BG=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

# Check for existing tunnel (simple heuristic)
EXISTING=$(ss -tnl | grep -E "127.0.0.1:${LOCAL_PORT} ") || true
if [ -n "$EXISTING" ]; then
  echo "Local port $LOCAL_PORT already in use. Is a tunnel already running?"
  exit 1
fi

SSH_CMD=(ssh -o ExitOnForwardFailure=yes -L ${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT} "$REMOTE")

if $BG; then
  echo "Starting ssh tunnel in background: ${SSH_CMD[*]}"
  ssh -f -N -o ExitOnForwardFailure=yes -L ${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT} "$REMOTE"
  echo "Tunnel started. Connect your client to http://127.0.0.1:${LOCAL_PORT}/"
else
  echo "Starting ssh tunnel: ${SSH_CMD[*]}"
  exec ssh -o ExitOnForwardFailure=yes -L ${LOCAL_PORT}:127.0.0.1:${REMOTE_PORT} "$REMOTE"
fi
