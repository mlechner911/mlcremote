#!/usr/bin/env bash
# Curl tests for file API endpoints
# Usage: bash scripts/test_files.sh

BASE_URL="http://127.0.0.1:8443"
TEST_FILE_PATH="/mlc-test.txt"
TEST_CONTENT="hello from mlc test $(date -Iseconds)"

status() {
  local label="$1" code="$2" expected="$3"
  if [[ "$code" == "$expected" ]];
  then echo "[OK] $label -> $code";
  else echo "[WARN] $label -> $code (expected $expected)";
  fi
}

http_code() {
  curl -s -o /dev/null -w "%{http_code}" "$1"
}

post_code() {
  local url="$1" data="$2"
  curl -s -o /dev/null -w "%{http_code}" -H "Content-Type: application/json" -d "$2" "$1"
}

echo "== Health =="
code=$(http_code "$BASE_URL/health")
status "GET /health" "$code" "200"

echo "\n== List root tree =="
code=$(http_code "$BASE_URL/api/tree")
status "GET /api/tree" "$code" "200"
if [[ "$code" == "200" ]]; then
  curl -s "$BASE_URL/api/tree" | head -n 20
fi

echo "\n== Create file =="
create_json=$(printf '{"path":"%s","content":"%s"}' "$TEST_FILE_PATH" "$TEST_CONTENT")
code=$(post_code "$BASE_URL/api/file" "$create_json")
status "POST /api/file" "$code" "204"

sleep 0.2

echo "\n== Read file =="
code=$(http_code "$BASE_URL/api/file?path=$TEST_FILE_PATH")
status "GET /api/file?path=$TEST_FILE_PATH" "$code" "200"
if [[ "$code" == "200" ]]; then
  echo "-- content --"
  curl -s "$BASE_URL/api/file?path=$TEST_FILE_PATH"
  echo "\n------------"
fi

echo "\n== Delete file =="
code=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL/api/file?path=$TEST_FILE_PATH")
status "DELETE /api/file?path=$TEST_FILE_PATH" "$code" "204"

sleep 0.2

echo "\n== Verify deletion =="
code=$(http_code "$BASE_URL/api/file?path=$TEST_FILE_PATH")
# After delete, expect non-200 (404 or 400). We print the code.
if [[ "$code" == "200" ]]; then
  echo "[WARN] File still exists after delete (200)"
else
  echo "[OK] Read after delete returned $code (expected not 200)"
fi

echo "\n== Invalid path traversal =="
code=$(http_code "$BASE_URL/api/file?path=/../../etc/passwd")
# Expect 400 or 404
if [[ "$code" == "400" || "$code" == "404" ]]; then
  echo "[OK] Path traversal blocked -> $code"
else
  echo "[WARN] Unexpected code for traversal -> $code"
fi

echo "\n== Done =="
