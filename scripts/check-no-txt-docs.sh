#!/usr/bin/env bash
# check-no-txt-docs.sh
#
# Fails if any .txt file exists outside docs/archive/ (and outside node_modules /
# .git / vendor directories).  Run in CI to prevent plain-text documentation
# from accumulating outside the designated archive location.
#
# Usage:
#   ./scripts/check-no-txt-docs.sh
#
# Exit codes:
#   0  — no stray .txt files found
#   1  — one or more stray .txt files found (prints the offending paths)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Find .txt files, excluding:
#   - node_modules
#   - .git
#   - docs/archive  (the only permitted location)
#   - .well-known/security.txt  (RFC 9116 disclosure file, not a doc)
#   - any .cargo dirs
mapfile -t STRAY < <(
  find "$REPO_ROOT" \
    -type f \
    -name "*.txt" \
    ! -path "*/node_modules/*" \
    ! -path "*/.git/*" \
    ! -path "*/docs/archive/*" \
    ! -path "*/.cargo/*" \
    ! -path "*/.well-known/security.txt" \
    | sort
)

if [[ ${#STRAY[@]} -eq 0 ]]; then
  echo "✅  No stray .txt documentation files found."
  exit 0
fi

echo "❌  Stray .txt files found outside docs/archive/:"
printf '   %s\n' "${STRAY[@]}"
echo ""
echo "Convert these files to Markdown (.md) or move them to docs/archive/."
echo "See issue #1550 for context."
exit 1
