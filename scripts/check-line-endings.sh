#!/usr/bin/env bash
# Check that all tracked text files use LF line endings.
#
# Usage: ./scripts/check-line-endings.sh [--help]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--help]

Scan the working tree for files with CRLF line endings (excluding binary files
and generated artifacts).  Exits 1 if any CRLF files are found.

To fix: run ./scripts/normalize-line-endings.sh
EOF
  exit 0
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Checking line endings...${NC}"

# Collect offending files into a temp file to avoid the subshell/pipeline
# variable-modification trap (SC2030/SC2031).
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

find . -type f \
  -not -path "./.git/*" \
  -not -path "./node_modules/*" \
  -not -path "./target/*" \
  -not -path "./dist/*" \
  -not -path "./build/*" \
  -not -name "*.wasm" \
  -not -name "*.png" \
  -not -name "*.jpg" \
  -not -name "*.jpeg" \
  -not -name "*.gif" \
  -not -name "*.ico" \
  -not -name "*.pdf" \
  -not -name "*.zip" \
  -not -name "*.tar.gz" \
  -not -name "*.tgz" \
  -not -name "*.lock" \
  -not -name "*.log" \
  -not -name "*.pid" \
  | while read -r file; do
    if file "$file" | grep -q "text" && file "$file" | grep -q "CRLF"; then
      echo "$file"
    fi
  done > "$TMPFILE"

if [ -s "$TMPFILE" ]; then
  while IFS= read -r file; do
    echo -e "${RED}❌ CRLF found in: $file${NC}"
  done < "$TMPFILE"
  echo -e "${RED}❌ Some files have CRLF line endings. Run: ./scripts/normalize-line-endings.sh${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All files have LF line endings${NC}"
fi
