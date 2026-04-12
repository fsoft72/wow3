#!/usr/bin/env bash
# ─────────────────────────────────────────���───────────────────────────────────
# docker-debug.sh — Build and run wow3-renderer Docker container locally
#                    with live log output for debugging.
#
# Usage:
#   ./scripts/docker-debug.sh          # build + run
#   ./scripts/docker-debug.sh --skip   # skip build, just run
# ────────���───────────────────────────────────────────────────────────────��────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

IMAGE_NAME="wow3-renderer"
IMAGE_TAG="latest"
CONTAINER_NAME="wow3-renderer-debug"
ENV_FILE="apps/wow3-renderer/.env"
DATA_DIR="/tmp/wow3-data"
PORT=4000

# ── .env check ─────────��─────────────────────────────���───────────────────────

if [[ ! -f "$ENV_FILE" ]]; then
  echo "==> Creating .env from .env.example..."
  cp apps/wow3-renderer/.env.example "$ENV_FILE"
  echo "    Edit $ENV_FILE with real passwords, then re-run."
  exit 1
fi

# ── Build (unless --skip) ────────────────────────────────────────────────────

if [[ "${1:-}" != "--skip" ]]; then
  echo "==> Building wow3-animation..."
  pnpm build:animation

  echo "==> Building Docker image..."
  docker build \
    -f apps/wow3-renderer/Dockerfile \
    -t "$IMAGE_NAME:$IMAGE_TAG" \
    .
else
  echo "==> Skipping build (--skip)"
fi

# ── Stop previous container if running ────────���──────────────────────────────

if docker ps -q -f "name=$CONTAINER_NAME" | grep -q .; then
  echo "==> Stopping previous $CONTAINER_NAME..."
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

# ── Prepare data dir ────��───────────────────────────��────────────────────────

mkdir -p "$DATA_DIR/uploads" "$DATA_DIR/output"

# ── Run ────────��─────────────────────────────────────���───────────────────────

echo ""
echo "==> Starting container (logs below, Ctrl+C to stop)"
echo "    Admin UI:  http://localhost:$PORT/admin/"
echo "    API:       http://localhost:$PORT/jobs"
echo "    Data dir:  $DATA_DIR"
echo ""

docker run --rm -it \
  --name "$CONTAINER_NAME" \
  --env-file "$ENV_FILE" \
  -e "PORT=$PORT" \
  -p "0.0.0.0:$PORT:$PORT" \
  -v "$DATA_DIR:/data" \
  "$IMAGE_NAME:$IMAGE_TAG"
