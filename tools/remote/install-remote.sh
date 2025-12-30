#!/usr/bin/env bash
set -euo pipefail

# install-remote.sh
# Installs mlcremote into a user's home under ~/.mlcremote
# Usage: ./install-remote.sh [--service] [--port PORT] [--bin PATH_TO_BINARY]

usage() {
  cat <<EOF
Usage: $0 [--service] [--port PORT] [--bin PATH_TO_BINARY]

Options:
  --service        Install a systemd --user service file and enable it (optional)
  --port PORT      Port the server will listen on (default: 8443)
  --bin PATH       Path to the mlcremote server binary to install (default: ./bin/dev-server)

This script copies the specified binary and frontend dist into ~/.mlcremote and
optionally installs a systemd --user service to run it.
EOF
}

SERVICE=false
PORT=8443
BIN_PATH="./bin/dev-server"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --service) SERVICE=true; shift ;;
    --port) PORT="$2"; shift 2 ;;
    --bin) BIN_PATH="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

# Destination
DEST_DIR="$HOME/.mlcremote"
BIN_DEST="$DEST_DIR/bin"
FRONTEND_SRC_DIR="frontend/dist"
FRONTEND_DEST="$DEST_DIR/frontend"

mkdir -p "$BIN_DEST"
mkdir -p "$FRONTEND_DEST"

# Copy binary
if [ ! -f "$BIN_PATH" ]; then
  echo "Binary $BIN_PATH not found. Please build it first (make backend)."
  exit 1
fi

BASENAME=$(basename "$BIN_PATH")
if [ -f "$BIN_DEST/$BASENAME" ]; then
  echo "Binary already installed at $BIN_DEST/$BASENAME — skipping copy"
else
  cp "$BIN_PATH" "$BIN_DEST/"
  chmod +x "$BIN_DEST/$BASENAME"
  echo "Installed binary to $BIN_DEST/$BASENAME"
fi

# If the installer was pushed by a sync (push-and-install), the frontend
# may already be present under ~/.mlcremote/frontend. Prefer that path.
if [ -d "$DEST_DIR/frontend" ] && [ -n "$(ls -A "$DEST_DIR/frontend")" ]; then
  echo "Using frontend already present at $DEST_DIR/frontend"
else
  if [ -d "$FRONTEND_SRC_DIR" ]; then
    rsync -a --delete "$FRONTEND_SRC_DIR/" "$FRONTEND_DEST/"
    echo "Copied frontend to $FRONTEND_DEST"
  else
    echo "Warning: frontend build not found at $FRONTEND_SRC_DIR and no frontend present at $FRONTEND_DEST. UI assets will be missing." >&2
  fi
fi

# Write simple run wrapper
RUN_SH="$DEST_DIR/run-server.sh"
cat > "$RUN_SH" <<EOF
#!/usr/bin/env bash
set -euo pipefail
exec "$BIN_DEST/$BASENAME" --port $PORT --root "$HOME" --static-dir "$FRONTEND_DEST"
EOF
chmod +x "$RUN_SH"

if $SERVICE; then
  # Install systemd user service
  USER_SERVICE_DIR="$HOME/.config/systemd/user"
  mkdir -p "$USER_SERVICE_DIR"
  SERVICE_FILE="$USER_SERVICE_DIR/mlcremote.service"
  cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=mlcremote user service
After=network.target

[Service]
Type=simple
ExecStart=$RUN_SH
Restart=on-failure

[Install]
WantedBy=default.target
EOF
  systemctl --user daemon-reload
  systemctl --user enable --now mlcremote.service || true
  echo "Installed and started systemd --user service: mlcremote.service"
else
  echo "Run the server with: $RUN_SH &"
fi

echo "Installation complete."
