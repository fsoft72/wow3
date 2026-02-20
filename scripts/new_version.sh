#!/bin/bash

# Updates app version in UIManager.js and cache version in sw.js
# Usage: ./scripts/new_version.sh <version>
# Example: ./scripts/new_version.sh 0.9.0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

UI_MANAGER="$PROJECT_DIR/js/views/UIManager.js"
SW="$PROJECT_DIR/sw.js"

if [ $# -ne 1 ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.9.0"
  exit 1
fi

VERSION="$1"

# Validate version format (semver-like: X.Y.Z)
if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: Version must be in X.Y.Z format (e.g. 0.9.0)"
  exit 1
fi

echo "Bumping version to $VERSION..."

# Update UIManager.js version string
sed -i "s/v\. [0-9]\+\.[0-9]\+\.[0-9]\+/v. $VERSION/" "$UI_MANAGER"
echo "  Updated $UI_MANAGER"

# Update sw.js cache version
sed -i "s/const CACHE_VERSION = 'wow3-v[^']*'/const CACHE_VERSION = 'wow3-v$VERSION'/" "$SW"
echo "  Updated $SW"

echo "Done! Version bumped to $VERSION"
