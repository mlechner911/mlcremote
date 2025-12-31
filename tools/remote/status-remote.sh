#!/usr/bin/env bash
set -eu

# Show remote user systemd service status and related diagnostics for mlcremote
# Usage: status-remote.sh [--lines N] [--port PORT] user@host

LINES=200
PORT=8443

print_usage() {
  cat <<EOF
Usage: $0 [--lines N] [--port PORT] user@host

Options:
  --lines N   Number of journal lines to show (default: 200)
  --port P    Port number to check for listeners (default: 8443)
  --help      Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --lines)
      LINES="$2"; shift 2;;
    --port)
      PORT="$2"; shift 2;;
    --help|-h)
      print_usage; exit 0;;
    --*)
      echo "Unknown option: $1" >&2; print_usage; exit 2;;
    *)
      TARGET="$1"; shift; break;;
  esac
done

if [[ -z "${TARGET:-}" ]]; then
  echo "Error: target is required." >&2
  print_usage
  exit 2
fi

set -o pipefail

SSH_OPTS=("-o" "BatchMode=yes" "-o" "ConnectTimeout=10")

REMOTE_CMD=$(cat <<'EOF'
set -euo pipefail
TARGET_HOME="$HOME"
SERVICE_NAME=mlcremote.service
SYSTEMD_CMD="systemctl --user"
echo "=== systemd --user status: $SYSTEMD_CMD status $SERVICE_NAME --no-pager -l ==="
$SYSTEMD_CMD status $SERVICE_NAME --no-pager -l || true

echo
echo "=== journalctl: last ${LINES} lines ==="
journalctl --user -u $SERVICE_NAME --no-pager -n ${LINES} || true

echo
echo "=== service file (~/.config/systemd/user/$SERVICE_NAME) ==="
if [[ -f "$HOME/.config/systemd/user/$SERVICE_NAME" ]]; then
  sed -n '1,200p' "$HOME/.config/systemd/user/$SERVICE_NAME"
else
  echo "(service file not found)"
fi

echo
echo "=== run-server.sh (first 200 lines) ==="
if [[ -f "$HOME/.mlcremote/run-server.sh" ]]; then
  sed -n '1,200p' "$HOME/.mlcremote/run-server.sh"
else
  echo "(run-server.sh not found in $HOME/.mlcremote)"
fi

echo
echo "=== ss -tnlp | grep PORT ==="
ss -tnlp | grep -E ":${PORT}\b" || true

echo
echo "=== ps aux | grep dev-server ==="
ps aux | grep -E "dev-server" || true

echo
echo "=== listing ~/.mlcremote (tree-ish) ==="
ls -la "$HOME/.mlcremote" || true
EOF
)

echo "Connecting to ${TARGET} and running remote checks..."

# Export LINES and PORT into the remote shell so the remote here-doc can use them
ssh "${SSH_OPTS[@]}" "$TARGET" "LINES=${LINES} PORT=${PORT} bash -lc $(printf '%q' "$REMOTE_CMD")"

echo "Done."
