#!/bin/bash
# Check that all files have LF line endings

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Checking line endings...${NC}"

HAS_CRLF=0

find . -type f \
  -not -path "./.git/*" \
  -not -path "./node_modules/*" \
  -not -path "./target/*" \
  -not -path "./dist/*" \
  -not -path "./build/*" \
  -not -path "*.wasm" \
  -not -path "*.png" \
  -not -path "*.jpg" \
  -not -path "*.jpeg" \
  -not -path "*.gif" \
  -not -path "*.ico" \
  -not -path "*.pdf" \
  -not -path "*.zip" \
  -not -path "*.tar.gz" \
  -not -path "*.tgz" \
  -not -path "*.lock" \
  -not -path "*.log" \
  -not -path "*.pid" \
  | while read -r file; do
    if file "$file" | grep -q "text" && file "$file" | grep -q "CRLF"; then
      echo -e "${RED}❌ CRLF found in: $file${NC}"
      HAS_CRLF=1
    fi
  done

if [ $HAS_CRLF -eq 1 ]; then
  echo -e "${RED}❌ Some files have CRLF line endings. Run: ./scripts/normalize-line-endings.sh${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All files have LF line endings${NC}"
fi
