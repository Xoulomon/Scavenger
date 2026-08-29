#!/bin/bash
# Verify that all configs are working correctly

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Verifying consolidated configs...${NC}"

# Check TypeScript configs
echo -e "${YELLOW}📝 Checking TypeScript configs...${NC}"

for dir in backend frontend indexer; do
  if [ -f "$dir/tsconfig.json" ]; then
    echo "  ✅ $dir/tsconfig.json exists"
  else
    echo -e "${RED}  ❌ $dir/tsconfig.json missing${NC}"
    exit 1
  fi
done

# Check ESLint configs
echo -e "${YELLOW}📝 Checking ESLint configs...${NC}"

for dir in backend frontend indexer; do
  if [ -f "$dir/eslint.config.js" ]; then
    echo "  ✅ $dir/eslint.config.js exists"
  else
    echo -e "${RED}  ❌ $dir/eslint.config.js missing${NC}"
    exit 1
  fi
done

# Check base configs
echo -e "${YELLOW}📝 Checking base configs...${NC}"

if [ -f "tsconfig.base.json" ]; then
  echo "  ✅ tsconfig.base.json exists"
else
  echo -e "${RED}  ❌ tsconfig.base.json missing${NC}"
  exit 1
fi

if [ -f "eslint.config.base.js" ]; then
  echo "  ✅ eslint.config.base.js exists"
else
  echo -e "${RED}  ❌ eslint.config.base.js missing${NC}"
  exit 1
fi

echo -e "${GREEN}✅ All configs verified!${NC}"
