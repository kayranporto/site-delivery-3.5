#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('$ROOT/package.json').version")"
OUT="${1:-$ROOT/release}"
mkdir -p "$OUT"
cd "$ROOT"
npm run verify
ARCHIVE="$OUT/site-delivery-$VERSION.zip"
rm -f "$ARCHIVE"
zip -qr "$ARCHIVE" . \
  -x '.git/*' 'node_modules/*' 'release/*' '*.DS_Store' '*.zip'
echo "$ARCHIVE"
