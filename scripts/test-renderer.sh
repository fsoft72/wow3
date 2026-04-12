#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# test-renderer.sh — Integration test suite for wow3-renderer HTTP API
#
# Usage:
#   ./scripts/test-renderer.sh                           # uses default host
#   ./scripts/test-renderer.sh https://my-host:4000      # custom host
#
# Requires: curl, jq
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL="${1:-https://wow3-renderer.os3.work}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASS="${ADMIN_PASS:-}"
COOKIE_JAR="/tmp/wow3-test-cookies.txt"
OUTPUT_DIR="/tmp/wow3-test-output"

# ── Helpers ──────────────────────────────────────────────────────────────────

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo -e "  ${GREEN}PASS${NC} $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo -e "  ${RED}FAIL${NC} $1 — $2"; }
skip() { SKIP_COUNT=$((SKIP_COUNT + 1)); echo -e "  ${YELLOW}SKIP${NC} $1 — $2"; }
section() { echo -e "\n${BOLD}${CYAN}── $1 ──${NC}"; }

cleanup() {
  rm -f "$COOKIE_JAR"
  rm -rf "$OUTPUT_DIR"
}
trap cleanup EXIT

mkdir -p "$OUTPUT_DIR"

# ── Prompt for admin password if not set ─────────────────────────────────────

if [[ -z "$ADMIN_PASS" ]]; then
  read -rsp "Admin password for $BASE_URL: " ADMIN_PASS
  echo
fi

echo -e "${BOLD}Testing renderer at ${CYAN}$BASE_URL${NC}"

# ═════════════════════════════════════════════════════════════════════════════
# 1. SMOKE TEST
# ═════════════════════════════════════════════════════════════════════════════

section "1. Smoke Test"

HTTP_CODE=$(curl -sL -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/admin" 2>/dev/null || echo "000")

if [[ "$HTTP_CODE" == "200" ]]; then
  pass "Server reachable (GET /admin → $HTTP_CODE)"
else
  fail "Server not reachable (GET /admin → $HTTP_CODE)" "Cannot continue"
  echo -e "\n${RED}Server is down or unreachable. Aborting.${NC}"
  exit 1
fi

# ═════════════════════════════════════════════════════════════════════════════
# 2. AUTH TESTS
# ═════════════════════════════════════════════════════════════════════════════

section "2. Authentication"

# No API key → 401
CODE=$(curl -sL -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/jobs")
if [[ "$CODE" == "401" ]]; then
  pass "POST /jobs without API key → 401"
else
  fail "POST /jobs without API key → $CODE" "expected 401"
fi

# Invalid API key → 401
CODE=$(curl -sL -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/jobs" \
  -H "X-API-Key: invalid-key-12345")
if [[ "$CODE" == "401" ]]; then
  pass "POST /jobs with invalid API key → 401"
else
  fail "POST /jobs with invalid API key → $CODE" "expected 401"
fi

# Invalid admin login → 401
CODE=$(curl -sL -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/admin/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"wrong-password"}')
if [[ "$CODE" == "401" ]]; then
  pass "POST /admin/login with wrong password → 401"
else
  fail "POST /admin/login with wrong password → $CODE" "expected 401"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 3. ADMIN LOGIN
# ═════════════════════════════════════════════════════════════════════════════

section "3. Admin Login"

LOGIN_RESP=$(curl -sL -w "\n%{http_code}" -X POST "$BASE_URL/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
  -c "$COOKIE_JAR")

LOGIN_CODE=$(echo "$LOGIN_RESP" | tail -1)
LOGIN_BODY=$(echo "$LOGIN_RESP" | head -n -1)

if [[ "$LOGIN_CODE" == "200" ]]; then
  pass "Admin login → 200"
else
  fail "Admin login → $LOGIN_CODE" "$LOGIN_BODY"
  echo -e "\n${RED}Cannot login as admin. Check ADMIN_PASS. Aborting.${NC}"
  exit 1
fi

# ═════════════════════════════════════════════════════════════════════════════
# 4. API KEY MANAGEMENT
# ═════════════════════════════════════════════════════════════════════════════

section "4. API Key Management"

# Create a test API key
KEY_RESP=$(curl -sL -w "\n%{http_code}" -X POST "$BASE_URL/admin/api-keys" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  -d '{"label":"integration-test"}')

KEY_CODE=$(echo "$KEY_RESP" | tail -1)
KEY_BODY=$(echo "$KEY_RESP" | head -n -1)

if [[ "$KEY_CODE" == "201" ]]; then
  API_KEY=$(echo "$KEY_BODY" | jq -r '.key')
  API_KEY_ID=$(echo "$KEY_BODY" | jq -r '.id')
  pass "Create API key → 201 (key: ${API_KEY:0:8}...)"
else
  fail "Create API key → $KEY_CODE" "$KEY_BODY"
  echo -e "\n${RED}Cannot create API key. Aborting.${NC}"
  exit 1
fi

# List API keys
LIST_RESP=$(curl -sL -w "\n%{http_code}" "$BASE_URL/admin/api-keys" -b "$COOKIE_JAR")
LIST_CODE=$(echo "$LIST_RESP" | tail -1)
LIST_BODY=$(echo "$LIST_RESP" | head -n -1)

if [[ "$LIST_CODE" == "200" ]]; then
  KEY_COUNT=$(echo "$LIST_BODY" | jq 'length')
  pass "List API keys → 200 ($KEY_COUNT keys)"
else
  fail "List API keys → $LIST_CODE" "$LIST_BODY"
fi

# Test the API key works
CODE=$(curl -sL -o /dev/null -w "%{http_code}" "$BASE_URL/jobs/nonexistent/status" \
  -H "X-API-Key: $API_KEY")
if [[ "$CODE" == "404" ]]; then
  pass "API key accepted (GET /jobs/nonexistent/status → 404, not 401)"
else
  fail "API key not working → $CODE" "expected 404"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 5. JOB SUBMISSION (JSON body)
# ═════════════════════════════════════════════════════════════════════════════

section "5. Job Submission (JSON body)"

# Minimal project: 3s video with a text element at low resolution for speed
JOB_RESP=$(curl -sL -w "\n%{http_code}" -X POST "$BASE_URL/jobs" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Integration Test",
    "width": 640,
    "height": 480,
    "durationMs": 3000,
    "tracks": [
      {
        "type": "visual",
        "clips": [
          {
            "elementType": "text",
            "startMs": 0,
            "endMs": 3000,
            "position": { "x": 50, "y": 150, "width": 540, "height": 180, "rotation": 0 },
            "properties": {
              "text": "Renderer OK",
              "font": { "family": "Roboto", "size": 64, "color": "#ffffff", "alignment": "center", "verticalAlign": "middle" }
            }
          }
        ]
      }
    ]
  }')

JOB_CODE=$(echo "$JOB_RESP" | tail -1)
JOB_BODY=$(echo "$JOB_RESP" | head -n -1)

if [[ "$JOB_CODE" == "202" ]]; then
  JOB_ID=$(echo "$JOB_BODY" | jq -r '.jobId')
  pass "Submit JSON job → 202 (jobId: ${JOB_ID:0:8}...)"
else
  fail "Submit JSON job → $JOB_CODE" "$JOB_BODY"
  JOB_ID=""
fi

# ═════════════════════════════════════════════════════════════════════════════
# 6. STATUS POLLING
# ═════════════════════════════════════════════════════════════════════════════

section "6. Status Polling"

if [[ -n "${JOB_ID:-}" ]]; then
  MAX_WAIT=180  # 3 minutes max
  POLL_INTERVAL=3
  ELAPSED=0
  FINAL_STATUS="unknown"

  while [[ $ELAPSED -lt $MAX_WAIT ]]; do
    STATUS_RESP=$(curl -sL "$BASE_URL/jobs/$JOB_ID/status" -H "X-API-Key: $API_KEY")
    STATUS=$(echo "$STATUS_RESP" | jq -r '.status')
    PROGRESS=$(echo "$STATUS_RESP" | jq -r '.progress // 0')

    printf "\r  ... %s — progress: %s%% (%ds)" "$STATUS" "$PROGRESS" "$ELAPSED"

    if [[ "$STATUS" == "completed" || "$STATUS" == "failed" ]]; then
      FINAL_STATUS="$STATUS"
      echo
      break
    fi

    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
  done

  if [[ "$FINAL_STATUS" == "completed" ]]; then
    pass "Job completed in ${ELAPSED}s"
  elif [[ "$FINAL_STATUS" == "failed" ]]; then
    ERROR=$(echo "$STATUS_RESP" | jq -r '.error // "unknown"')
    fail "Job failed" "$ERROR"
  else
    echo
    fail "Job timed out after ${MAX_WAIT}s" "status: $STATUS"
  fi
else
  skip "Status polling" "no job ID"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 7. DOWNLOAD RESULT
# ═════════════════════════════════════════════════════════════════════════════

section "7. Download Result"

if [[ "${FINAL_STATUS:-}" == "completed" ]]; then
  MP4_FILE="$OUTPUT_DIR/test-result.mp4"

  DL_CODE=$(curl -sL -o "$MP4_FILE" -w "%{http_code}" \
    "$BASE_URL/jobs/$JOB_ID/result" \
    -H "X-API-Key: $API_KEY")

  if [[ "$DL_CODE" == "200" ]]; then
    FILE_SIZE=$(stat --printf='%s' "$MP4_FILE" 2>/dev/null || stat -f '%z' "$MP4_FILE" 2>/dev/null)
    FILE_SIZE_KB=$((FILE_SIZE / 1024))
    pass "Download MP4 → 200 (${FILE_SIZE_KB} KB)"

    # Validate MP4 header (ftyp box)
    HEADER=$(xxd -l 12 "$MP4_FILE" 2>/dev/null | head -1)
    if echo "$HEADER" | grep -q "ftyp"; then
      pass "MP4 header valid (ftyp box present)"
    else
      fail "MP4 header invalid" "missing ftyp box — file may be corrupted"
    fi

    # Check with ffprobe if available
    if command -v ffprobe &>/dev/null; then
      DURATION=$(ffprobe -v error -show_entries format=duration \
        -of default=noprint_wrappers=1:nokey=1 "$MP4_FILE" 2>/dev/null || echo "0")
      if (( $(echo "$DURATION > 1" | bc -l 2>/dev/null || echo 0) )); then
        pass "ffprobe: duration ${DURATION}s"
      else
        fail "ffprobe: duration ${DURATION}s" "expected > 1s"
      fi
    else
      skip "ffprobe check" "ffprobe not installed"
    fi
  else
    fail "Download MP4 → $DL_CODE" "expected 200"
  fi

  # Test download of non-completed job (submit another, check immediately)
  CODE=$(curl -sL -o /dev/null -w "%{http_code}" \
    "$BASE_URL/jobs/nonexistent-id/result" \
    -H "X-API-Key: $API_KEY")
  if [[ "$CODE" == "404" ]]; then
    pass "Download non-existent job → 404"
  else
    fail "Download non-existent job → $CODE" "expected 404"
  fi
else
  skip "Download result" "job did not complete"
fi

# ═════════════════════════════════════════════════════════════════════════════
# 8. ADMIN: LIST JOBS
# ═════════════════════════════════════════════════════════════════════════════

section "8. Admin Job Management"

JOBS_RESP=$(curl -sL -w "\n%{http_code}" "$BASE_URL/admin/jobs" -b "$COOKIE_JAR")
JOBS_CODE=$(echo "$JOBS_RESP" | tail -1)
JOBS_BODY=$(echo "$JOBS_RESP" | head -n -1)

if [[ "$JOBS_CODE" == "200" ]]; then
  JOB_COUNT=$(echo "$JOBS_BODY" | jq 'length')
  pass "List jobs → 200 ($JOB_COUNT jobs)"
else
  fail "List jobs → $JOBS_CODE" "$JOBS_BODY"
fi

# Admin can also download the result
if [[ "${FINAL_STATUS:-}" == "completed" && -n "${JOB_ID:-}" ]]; then
  CODE=$(curl -sL -o /dev/null -w "%{http_code}" \
    "$BASE_URL/admin/jobs/$JOB_ID/result" -b "$COOKIE_JAR")
  if [[ "$CODE" == "200" ]]; then
    pass "Admin download job result → 200"
  else
    fail "Admin download job result → $CODE" "expected 200"
  fi
fi

# ═════════════════════════════════════════════════════════════════════════════
# 9. CLEANUP: Delete test API key and job
# ═════════════════════════════════════════════════════════════════════════════

section "9. Cleanup"

# Delete the test job
if [[ -n "${JOB_ID:-}" ]]; then
  DEL_CODE=$(curl -sL -o /dev/null -w "%{http_code}" -X DELETE \
    "$BASE_URL/admin/jobs/$JOB_ID" -b "$COOKIE_JAR")
  if [[ "$DEL_CODE" == "200" ]]; then
    pass "Delete test job → 200"
  else
    fail "Delete test job → $DEL_CODE" "expected 200"
  fi
fi

# Delete the test API key
if [[ -n "${API_KEY_ID:-}" ]]; then
  DEL_CODE=$(curl -sL -o /dev/null -w "%{http_code}" -X DELETE \
    "$BASE_URL/admin/api-keys/$API_KEY_ID" -b "$COOKIE_JAR")
  if [[ "$DEL_CODE" == "200" ]]; then
    pass "Delete test API key → 200"
  else
    fail "Delete test API key → $DEL_CODE" "expected 200"
  fi
fi

# Logout
CODE=$(curl -sL -o /dev/null -w "%{http_code}" -X POST \
  "$BASE_URL/admin/logout" -b "$COOKIE_JAR" -c "$COOKIE_JAR")
if [[ "$CODE" == "200" ]]; then
  pass "Admin logout → 200"
else
  fail "Admin logout → $CODE" "expected 200"
fi

# ═════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════════════════════

echo
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  ${GREEN}PASS: $PASS_COUNT${NC}  ${RED}FAIL: $FAIL_COUNT${NC}  ${YELLOW}SKIP: $SKIP_COUNT${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
