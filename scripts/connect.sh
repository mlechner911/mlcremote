#!/usr/bin/env bash
set -euo pipefail

SERVER="$1"
if [[ -z "${SERVER}" ]]; then
  echo "Usage: ./scripts/connect.sh user@remote-server"
  exit 1
fi

ssh -L 8443:localhost:8443 -N -f "${SERVER}"
sleep 1
# Linux
command -v xdg-open >/dev/null && xdg-open http://localhost:8443 || true
# macOS fallback
command -v open >/dev/null && open http://localhost:8443 || true

echo "Tunnel established to ${SERVER} on localhost:8443"
