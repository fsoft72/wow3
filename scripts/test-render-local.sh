#!/usr/bin/env bash
# ──────────���───────���──────────────────────────────────���───────────────────────
# test-render-local.sh — Submit tests/file.json to the local renderer,
#                         poll until done, download the MP4.
#
# Usage:
#   ./scripts/test-render-local.sh                          # localhost:4000
#   ./scripts/test-render-local.sh https://wow3-renderer.os3.work  # remote
#
# Reads the API key from .n8n-key (first line, trimmed).
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BASE_URL="${1:-http://localhost:4000}"
KEY_FILE=".n8n-key"
INPUT_FILE="tests/file.json"
OUTPUT_FILE="/ramdisk/wow3-render-output.mp4"

# ── Read API key ─────────────��───────────────────────────────────────────────

if [[ ! -f "$KEY_FILE" ]]; then
  echo "Error: $KEY_FILE not found. Create it with the API key on the first line."
  exit 1
fi

API_KEY=$(head -1 "$KEY_FILE" | tr -d '[:space:]')

if [[ -z "$API_KEY" ]]; then
  echo "Error: $KEY_FILE is empty."
  exit 1
fi

# ── Submit job ─────────────��─────────────────────────────��───────────────────

echo "==> Submitting $INPUT_FILE to $BASE_URL ..."

RESP=$(curl -sL -w "\n%{http_code}" -X POST "$BASE_URL/jobs" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$INPUT_FILE")

CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)

if [[ "$CODE" != "202" ]]; then
  echo "Error: expected 202, got $CODE"
  echo "$BODY"
  exit 1
fi

JOB_ID=$(echo "$BODY" | jq -r '.jobId')
echo "    Job ID: $JOB_ID"

# ── Poll status ────────���──────────────────���─────────────────────────────────

echo "==> Polling status..."

MAX_WAIT=300
ELAPSED=0

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  STATUS_RESP=$(curl -sL "$BASE_URL/jobs/$JOB_ID/status" -H "X-API-Key: $API_KEY")
  STATUS=$(echo "$STATUS_RESP" | jq -r '.status')
  PROGRESS=$(echo "$STATUS_RESP" | jq -r '.progress // 0')

  printf "\r    %s — %s%% (%ds)   " "$STATUS" "$PROGRESS" "$ELAPSED"

  if [[ "$STATUS" == "completed" ]]; then
    echo
    break
  fi

  if [[ "$STATUS" == "failed" ]]; then
    echo
    ERROR=$(echo "$STATUS_RESP" | jq -r '.error // "unknown"')
    echo "Error: render failed — $ERROR"
    exit 1
  fi

  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

if [[ "$STATUS" != "completed" ]]; then
  echo
  echo "Error: timed out after ${MAX_WAIT}s (status: $STATUS)"
  exit 1
fi

# ── Download result ──────────���───────────────────────────────────────────────

echo "==> Downloading MP4..."

DL_CODE=$(curl -sL -o "$OUTPUT_FILE" -w "%{http_code}" \
  "$BASE_URL/jobs/$JOB_ID/result" \
  -H "X-API-Key: $API_KEY")

if [[ "$DL_CODE" != "200" ]]; then
  echo "Error: download returned $DL_CODE"
  exit 1
fi

FILE_SIZE=$(stat --printf='%s' "$OUTPUT_FILE" 2>/dev/null || stat -f '%z' "$OUTPUT_FILE" 2>/dev/null)
echo "    Saved: $OUTPUT_FILE ($(( FILE_SIZE / 1024 )) KB)"

# ── Quick check ────────────────────────────────────────���─────────────────────

if command -v ffprobe &>/dev/null; then
  DURATION=$(ffprobe -v error -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 "$OUTPUT_FILE" 2>/dev/null || echo "?")
  echo "    Duration: ${DURATION}s"
fi

echo "==> Done."
