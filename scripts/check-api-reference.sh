#!/usr/bin/env bash
# Verify that docs/API_REFERENCE.md documents every route registered in the backend app,
# and that the removed duplicate API docs are not referenced anywhere.
# Usage: scripts/check-api-reference.sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
REF="docs/API_REFERENCE.md"
MAIN="backend/src/main.rs"
failures=0

# Every literal path passed to .route("...") in the app setup.
routes="$(grep -oE '\.route\("[^"]+"' "$MAIN" | sed -E 's/\.route\("//; s/"$//' | sort -u)"
count=0
while IFS= read -r route; do
  [ -z "$route" ] && continue
  count=$((count + 1))
  if ! grep -qF -- "$route" "$REF"; then
    echo "UNDOCUMENTED: $route is registered in $MAIN but not in $REF"
    failures=$((failures + 1))
  fi
done <<< "$routes"

# The duplicates were merged into $REF; nothing should point at them any more.
if git grep -n -E '(^|[^A-Za-z0-9_-])(api-reference\.md|API_REFERENCE_GUIDE|API_DOCUMENTATION\.md)' -- . ':!docs/CHANGELOG*' ':!scripts/check-api-reference.sh' 2>/dev/null; then
  echo "STALE LINK: references to removed API docs found (see above)"
  failures=$((failures + 1))
fi

if [ "$failures" -eq 0 ]; then
  echo "API reference check passed: $count registered routes documented."
fi
exit "$failures"
