#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────

REMOTE_USER="wow3-renderer"
REMOTE_HOST="wow3-renderer.os3.work"
REMOTE="$REMOTE_USER@$REMOTE_HOST"

REMOTE_DOCKER_DIR="/home/$REMOTE_USER/docker"
REMOTE_VOLUMES_DIR="/home/$REMOTE_USER/volumes"
REMOTE_DATA_DIR="$REMOTE_VOLUMES_DIR/wow3-data"

IMAGE_NAME="wow3-renderer"
IMAGE_TAG="latest"
IMAGE_ARCHIVE="/tmp/wow3-renderer.tar.gz"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# ── Step 1: Build locally ────────────────────────────────────────────────────

echo "==> Building wow3-animation..."
pnpm build:animation

echo "==> Building Docker image..."
docker build \
  -f apps/wow3-renderer/Dockerfile \
  -t "$IMAGE_NAME:$IMAGE_TAG" \
  .

# ── Step 2: Save and transfer image ─────────────────────────────────────────

echo "==> Saving Docker image to $IMAGE_ARCHIVE..."
docker save "$IMAGE_NAME:$IMAGE_TAG" | gzip > "$IMAGE_ARCHIVE"

IMAGE_SIZE=$(du -h "$IMAGE_ARCHIVE" | cut -f1)
echo "    Image size: $IMAGE_SIZE"

echo "==> Uploading image to $REMOTE_HOST..."
scp "$IMAGE_ARCHIVE" "$REMOTE:/tmp/wow3-renderer.tar.gz"

# ── Step 3: Prepare remote directories and files ─────────────────────────────

echo "==> Setting up remote directories..."
ssh "$REMOTE" "mkdir -p $REMOTE_DOCKER_DIR $REMOTE_DATA_DIR/uploads $REMOTE_DATA_DIR/output"

echo "==> Uploading docker-compose.yml and .env.example..."
scp apps/wow3-renderer/.env.example "$REMOTE:$REMOTE_DOCKER_DIR/.env.example"

# Create docker-compose.yml adapted for the server layout
# (bind mount instead of named volume, build section removed)
ssh "$REMOTE" "cat > $REMOTE_DOCKER_DIR/docker-compose.yml" <<'COMPOSE'
services:
  wow3-renderer:
    image: wow3-renderer:latest
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - /home/wow3-renderer/volumes/wow3-data:/data
    env_file:
      - .env
    restart: unless-stopped
COMPOSE

# Create .env from .env.example only if it doesn't exist yet
ssh "$REMOTE" "test -f $REMOTE_DOCKER_DIR/.env || cp $REMOTE_DOCKER_DIR/.env.example $REMOTE_DOCKER_DIR/.env"

# ── Step 4: Load image and (re)start container ──────────────────────────────

echo "==> Loading Docker image on $REMOTE_HOST..."
ssh "$REMOTE" "docker load < /tmp/wow3-renderer.tar.gz && rm /tmp/wow3-renderer.tar.gz"

echo "==> Restarting container..."
ssh "$REMOTE" "cd $REMOTE_DOCKER_DIR && docker compose down && docker compose up -d"

# ── Step 5: Verify ──────────────────────────────────────────────────────────

echo "==> Waiting for container to start..."
sleep 3
ssh "$REMOTE" "docker compose -f $REMOTE_DOCKER_DIR/docker-compose.yml ps"

# ── Cleanup local archive ───────────────────────────────────────────────────

rm -f "$IMAGE_ARCHIVE"

echo ""
echo "==> Deploy complete!"
echo "    Admin UI: http://$REMOTE_HOST:3000/admin/"
echo "    API:      http://$REMOTE_HOST:3000/jobs"
echo ""
echo "    IMPORTANT: On first deploy, edit the .env on the server:"
echo "    ssh $REMOTE 'nano $REMOTE_DOCKER_DIR/.env'"
echo "    Then restart: ssh $REMOTE 'cd $REMOTE_DOCKER_DIR && docker compose restart'"
