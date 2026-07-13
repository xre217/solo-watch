#!/usr/bin/env bash
# Publish solo-watch to npm when logged in.
# Usage: ./scripts/publish.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if ! npm whoami >/dev/null 2>&1; then
  echo "Not logged in to npm."
  echo "  npm login --auth-type=web"
  echo "Then re-run: ./scripts/publish.sh"
  exit 1
fi

npm run pack:check
npm publish --access public
echo "Published. Try: npx solo-watch@$(node -p "require('./package.json').version") scan ."
