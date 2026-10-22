#!/usr/bin/env bash
# Verify that all configs are working correctly.
#
# Usage: ./scripts/verify-configs.sh [--help]

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") [--help]

Check that tsconfig.json and eslint.config.js exist for each package
(backend, frontend, indexer) and that the shared base configs are present.
EOF
  exit 0
fi

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

# Check Prometheus rules
echo -e "${YELLOW}📝 Checking Prometheus rules...${NC}"

RULES_DIR="config/prometheus/rules"

if [ ! -d "$RULES_DIR" ]; then
  echo -e "${RED}  ❌ $RULES_DIR missing${NC}"
  exit 1
fi

RULE_FILES=()
while IFS= read -r -d '' f; do
  RULE_FILES+=("$f")
done < <(find "$RULES_DIR" -maxdepth 1 -type f -name '*.yml' -print0 | sort -z)

if [ ${#RULE_FILES[@]} -eq 0 ]; then
  echo -e "${RED}  ❌ No rule files found in $RULES_DIR${NC}"
  exit 1
fi

# Validate each rule file with promtool
if ! command -v promtool >/dev/null 2>&1; then
  echo -e "${RED}  ❌ promtool not found in PATH${NC}"
  exit 1
fi

for f in "${RULE_FILES[@]}"; do
  if promtool check rules "$f" >/dev/null 2>&1; then
    echo "  ✅ promtool check rules passed: $f"
  else
    echo -e "${RED}  ❌ promtool check rules failed: $f${NC}"
    promtool check rules "$f" || true
    exit 1
  fi
done

# Check for duplicate alert names across all rule files
echo -e "${YELLOW}📝 Checking for duplicate alert names...${NC}"

DUPLICATES=$(grep -hE '^[[:space:]]*-[[:space:]]*alert:' "${RULE_FILES[@]}" \
  | sed -E 's/^[[:space:]]*-[[:space:]]*alert:[[:space:]]*//' \
  | sed -E 's/[[:space:]]+$//' \
  | sed -E 's/^"(.*)"$/\1/' \
  | sed -E "s/^'(.*)'$/\1/" \
  | grep -v '^$' \
  | sort \
  | uniq -d)

if [ -n "$DUPLICATES" ]; then
  echo -e "${RED}  ❌ Duplicate alert names found:${NC}"
  echo "$DUPLICATES" | while IFS= read -r name; do
    echo -e "${RED}     - $name${NC}"
  done
  exit 1
fi

echo "  ✅ No duplicate alert names"

echo -e "${GREEN}✅ All configs verified!${NC}"