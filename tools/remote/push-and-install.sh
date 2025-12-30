#!/usr/bin/env bash
set -euo pipefail

# push-and-install.sh
# Usage: ./push-and-install.sh user@host [--service] [--port PORT]

if [ $# -lt 1 ]; then
  echo "Usage: $0 user@host [--service] [--port PORT]"
  exit 1
fi

REMOTE="$1"
shift
SERVICE=false
PORT=8443
OVERWRITE=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --service) SERVICE=true; shift ;;
    --overwrite) OVERWRITE=true; shift ;;
    --port) PORT="$2"; shift 2 ;;
    -h|--help) echo "Usage: $0 user@host [--service] [--port PORT]"; exit 0 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Ensure build/dist exists
if [ ! -d "build/dist" ]; then
  echo "build/dist not found. Run 'make dist' first."; exit 1
fi

# Check remote service state. If running and not --overwrite, bail.
if ssh "$REMOTE" 'systemctl --user is-active --quiet mlcremote.service >/dev/null 2>&1; echo $?'; then
  # remote returned a code; we'll query properly
  if ssh "$REMOTE" 'systemctl --user is-active mlcremote.service >/dev/null 2>&1'; then
    if [ "$OVERWRITE" != true ]; then
      echo "Remote mlcremote.service is active. Use --overwrite to stop it and reinstall." >&2
      exit 1
    else
      echo "Stopping remote mlcremote.service (overwrite requested)"
      ssh "$REMOTE" 'systemctl --user stop mlcremote.service || true'
    fi
  fi
fi

# Rsync bin and frontend only to avoid clobbering existing run scripts
echo "Syncing build/dist/bin -> $REMOTE:~/.mlcremote/bin/"
rsync -avz --delete build/dist/bin/ "$REMOTE:~/.mlcremote/bin/"
echo "Syncing build/dist/frontend -> $REMOTE:~/.mlcremote/frontend/"
rsync -avz --delete build/dist/frontend/ "$REMOTE:~/.mlcremote/frontend/"

# On remote, ensure install script exists; if not, copy it
if ! ssh "$REMOTE" 'test -f ~/.mlcremote/install-remote.sh && echo yes || true' | grep -q yes; then
  echo "Copying install-remote.sh to remote ~/.mlcremote/"
  scp tools/remote/install-remote.sh "$REMOTE:~/.mlcremote/install-remote.sh"
  ssh "$REMOTE" 'chmod +x ~/.mlcremote/install-remote.sh'
fi

# Run the remote install script
REMOTE_CMD="~/.mlcremote/install-remote.sh"
if $SERVICE; then
  REMOTE_CMD="$REMOTE_CMD --service --port $PORT --bin ~/.mlcremote/bin/dev-server"
else
  REMOTE_CMD="$REMOTE_CMD --port $PORT --bin ~/.mlcremote/bin/dev-server"
fi

echo "Running remote install: ssh $REMOTE '$REMOTE_CMD'"
ssh -t "$REMOTE" "$REMOTE_CMD"

echo "Push and install complete."
