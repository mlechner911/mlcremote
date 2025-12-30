#!/usr/bin/env bash
set -euo pipefail

# probe-remote.sh
# Probe a remote host via SSH and report OS, distro, arch, init system, and utilities.
# Usage: ./probe-remote.sh user@host [--json]

usage() {
  cat <<EOF
Usage: $0 user@host [--json]

Options:
  --json    Output machine-readable JSON

Example:
  ./probe-remote.sh alice@example.com --json
EOF
}

if [ $# -lt 1 ]; then
  usage; exit 1
fi

REMOTE="$1"
shift
JSON=false
DEBUG=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --json) JSON=true; shift ;;
    --debug) DEBUG=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

# remote script to run
read -r -d '' RSCRIPT <<'EOF'
set -e
# OS / Distro
OS=$(uname -s || true)
ARCH=$(uname -m || true)

# Try lsb_release
DISTRO=""
if command -v lsb_release >/dev/null 2>&1; then
  DISTRO=$(lsb_release -ds 2>/dev/null || true)
fi
# Fallback to /etc/os-release
if [ -z "$DISTRO" ] && [ -f /etc/os-release ]; then
  . /etc/os-release
  DISTRO="$NAME $VERSION"
fi
# systemd
HAS_SYSTEMD=false
if command -v systemctl >/dev/null 2>&1; then
  HAS_SYSTEMD=true
fi
# init system (pid 1)
INIT_PROC=$(ps -p 1 -o comm= 2>/dev/null || true)
# check for rsync, tar, unzip
HAVE_RSYNC=false
HAVE_TAR=false
HAVE_UNZIP=false
HAVE_GREP=false
for cmd in rsync tar unzip grep; do
  if command -v $cmd >/dev/null 2>&1; then
    case $cmd in
      rsync) HAVE_RSYNC=true ;;
      tar) HAVE_TAR=true ;;
      unzip) HAVE_UNZIP=true ;;
      grep) HAVE_GREP=true ;;
    esac
  fi
done
# output
cat <<JSON
{
  "os": "${OS}",
  "arch": "${ARCH}",
  "distro": "${DISTRO}",
  "init": "${INIT_PROC}",
  "has_systemd": ${HAS_SYSTEMD},
  "have_rsync": ${HAVE_RSYNC},
  "have_tar": ${HAVE_TAR},
  "have_unzip": ${HAVE_UNZIP},
  "have_grep": ${HAVE_GREP}
}
JSON
EOF

run_ssh() {
  local opts="$1"
  ssh $opts "$REMOTE" "bash -s" <<< "$RSCRIPT"
}

# Run ssh and capture stdout/stderr into variables
run_ssh_capture() {
  local opts="$1"
  local out
  local err
  out=$(mktemp)
  err=$(mktemp)
  ssh $opts "$REMOTE" "bash -s" <<< "$RSCRIPT" >"$out" 2>"$err"
  local rc=$?
  cat "$out"
  if [ $rc -ne 0 ] || $DEBUG; then
    echo "--- SSH STDERR ---" >&2
    sed -n '1,200p' "$err" >&2
  fi
  rm -f "$out" "$err"
  return $rc
}

if $JSON; then
  # Try non-interactive first
  # Try non-interactive first, capture output to detect failure
  if run_ssh_capture "-o BatchMode=yes -o ConnectTimeout=10" >/dev/null 2>&1; then
    run_ssh_capture "-o BatchMode=yes -o ConnectTimeout=10"
  else
    # fall back to interactive so user can enter password if needed
    echo "Non-interactive SSH failed; retrying interactively (you may be prompted for password)" >&2
    run_ssh_capture "-o ConnectTimeout=10"
  fi
else
  echo "Probing $REMOTE..."
  # Try non-interactive first
  if run_ssh_capture "-o BatchMode=yes -o ConnectTimeout=10" | jq 2>/dev/null; then
    run_ssh_capture "-o BatchMode=yes -o ConnectTimeout=10" | jq
  else
    echo "Non-interactive SSH failed; retrying interactively (you may be prompted for password)" >&2
    if ! run_ssh_capture "-o ConnectTimeout=10" | jq; then
      echo "Interactive probe failed too. See SSH stderr above for details." >&2
      exit 1
    fi
  fi
fi
