#!/bin/bash
# Normalize line endings to LF for all files in the repository

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔧 Normalizing line endings to LF...${NC}"

# Find all text files and convert to LF
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
    # Check if file is a text file
    if file "$file" | grep -q "text"; then
      # Convert CRLF to LF
      sed -i 's/\r$//' "$file"
      echo "  Normalized: $file"
    fi
  done

echo -e "${GREEN}✅ Line endings normalized to LF${NC}"
