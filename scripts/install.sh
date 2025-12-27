#!/usr/bin/env bash
set -euo pipefail

SERVER="$1"
if [[ -z "${SERVER}" ]]; then
  echo "Usage: ./scripts/install.sh user@remote-server"
  exit 1
fi

# Build binary
pushd backend >/dev/null
GOFLAGS="-ldflags=-s -w" go build -o ../bin/dev-server ./cmd/dev-server
popd >/dev/null

# Copy to server
scp bin/dev-server "${SERVER}":~/bin/

# Setup SystemD user service
ssh "${SERVER}" << 'EOF'
mkdir -p ~/.config/systemd/user/
cat > ~/.config/systemd/user/dev-server.service << 'SERVICE'
[Unit]
Description=Lightweight Dev Server

[Service]
ExecStart=%h/bin/dev-server --port 8443 --root %h
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
SERVICE

systemctl --user daemon-reload
systemctl --user enable dev-server
systemctl --user start dev-server
EOF

echo "Installed and started dev-server on ${SERVER}."
