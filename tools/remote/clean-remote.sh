#!/usr/bin/env bash
set -euo pipefail

# Interactive remote cleanup helper
# Usage: clean-remote.sh [--port PORT] user@host

PORT=8443
print_usage(){
  cat <<EOF
Usage: $0 [--port PORT] user@host

Interactive helper to inspect and optionally kill processes holding PORT on the remote.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2;;
    -h|--help) print_usage; exit 0;;
    *) TARGET="$1"; shift; break;;
  esac
done

if [[ -z "${TARGET:-}" ]]; then
  echo "Missing target user@host" >&2; print_usage; exit 2
fi

echo "Connecting to $TARGET to inspect listeners on port $PORT..."

ssh -t "$TARGET" bash -lc "
  echo '=== ss -tnlp | grep PORT ==='
  ss -tnlp | grep -E ':${PORT}\\b' || true
  echo
  echo '=== processes matching dev-server ==='
  ps aux | grep -E 'dev-server' || true
  echo
  echo '=== PIDs listening on port ${PORT} (extracted) ==='
  ss -tnlp | awk '/:${PORT}\\b/ { for(i=1;i<=NF;i++) if (\$i ~ /pid=/) { match(\$i, /pid=([0-9]+)/, m); if (m[1]) print m[1] } }' || true
  echo
  echo '=== end remote inspection ==='
"

read -p "Do you want to attempt to kill dev-server processes listening on port ${PORT}? (y/N) " CONF
if [[ ! "$CONF" =~ ^[Yy]$ ]]; then
  echo "Aborting. No changes made."; exit 0
fi

read -p "Attempt kill with remote user privileges or use sudo? (type 'sudo' or press Enter to use user) " MODE
if [[ "$MODE" = "sudo" ]]; then
  echo "Killing with sudo on remote (may prompt for password)..."
  ssh -t "$TARGET" "sudo bash -lc 'pids=($(ss -tnlp | awk \"/:${PORT}\\b/ { for(i=1;i<=NF;i++) if (\$i ~ /pid=/) { match(\$i, /pid=([0-9]+)/, m); if (m[1]) print m[1] } }\")); if [ \${#pids[@]} -eq 0 ]; then echo No pids; exit 0; fi; echo Killing: \${pids[*]}; kill -TERM \${pids[*]} || true; sleep 1; ss -tnlp | grep -E ":${PORT}\\b" || true'"
else
  echo "Killing as remote user (no sudo):"
  ssh -t "$TARGET" "bash -lc 'pids=($(ss -tnlp | awk \"/:${PORT}\\b/ { for(i=1;i<=NF;i++) if (\$i ~ /pid=/) { match(\$i, /pid=([0-9]+)/, m); if (m[1]) print m[1] } }\")); if [ \${#pids[@]} -eq 0 ]; then echo No pids; exit 0; fi; echo Killing: \${pids[*]}; pkill -f \"dev-server --port ${PORT}\" || kill -TERM \${pids[*]} || true; sleep 1; ss -tnlp | grep -E ":${PORT}\\b" || true'"
fi

echo "Now restarting mlcremote.service (user service) on remote..."
ssh -t "$TARGET" "systemctl --user daemon-reload; systemctl --user restart mlcremote.service || systemctl --user start mlcremote.service || true; systemctl --user status mlcremote.service --no-pager -l || true"

echo "Printing recent journal lines for mlcremote.service..."
ssh "$TARGET" "journalctl --user -u mlcremote.service --no-pager -n 200 || true"

echo "Cleanup complete."
