#!/usr/bin/env bash
set -euo pipefail

# Run from any directory — always operates from the repo root
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Building wow3-animation..."
pnpm build:animation

echo "==> Building Docker image wow3-renderer:latest..."
docker build \
  -f apps/wow3-renderer/Dockerfile \
  -t wow3-renderer:latest \
  .

echo "==> Build complete."
