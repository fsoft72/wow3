#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Build animation + Docker image
bash "$REPO_ROOT/scripts/build.sh"

echo "==> Starting wow3-renderer..."
docker compose -f apps/wow3-renderer/docker-compose.yml up
