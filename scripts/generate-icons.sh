#!/usr/bin/env bash
set -euo pipefail
# Generate icons only when inputs changed
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$REPO_ROOT/icons/icons.yml"
RAW_DIR="$REPO_ROOT/icons/raw"
OUT_DIR="$REPO_ROOT/frontend/src/generated"
BIN="$REPO_ROOT/bin/icon-gen"
HASHFILE="$OUT_DIR/.icons-input-hash"

mkdir -p "$OUT_DIR"

echo "calculating input hash..."
tmpfile=$(mktemp)
sha256sum "$MANIFEST" >> "$tmpfile"
find "$RAW_DIR" -type f -name '*.svg' -print0 | sort -z | xargs -0 sha256sum >> "$tmpfile"
hash=$(sha256sum "$tmpfile" | awk '{print $1}')
rm -f "$tmpfile"

old=""
if [ -f "$HASHFILE" ]; then
  old=$(cat "$HASHFILE")
fi

if [ "$hash" = "$old" ]; then
  echo "icons: inputs unchanged — skipping generation"
  exit 0
fi

echo "icons: inputs changed — generating..."

if [ ! -x "$BIN" ]; then
  echo "building icon-gen binary..."
  (cd "$REPO_ROOT/cmd/icon-gen" && go build -o "$BIN")
fi

"$BIN" --manifest "$MANIFEST" --raw "$RAW_DIR" --out "$OUT_DIR"

echo "$hash" > "$HASHFILE"
echo "icons: generation complete"
