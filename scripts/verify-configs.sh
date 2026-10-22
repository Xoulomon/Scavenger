#!/bin/bash
# Verify that all configs are working correctly, and that the Rust workspace
# passes formatting and Clippy lint checks with zero warnings.

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Verifying consolidated configs...${NC}"

# ── Rust: formatting & lints ────────────────────────────────────────────────

echo -e "${YELLOW}🦀 Checking Rust formatting (cargo fmt --check)...${NC}"
if command -v cargo >/dev/null 2>&1; then
  if cargo fmt --all -- --check; then
    echo -e "${GREEN}  ✅ cargo fmt: no formatting issues${NC}"
  else
    echo -e "${RED}  ❌ cargo fmt: formatting issues found — run 'cargo fmt --all' to fix${NC}"
    exit 1
  fi

  echo -e "${YELLOW}🦀 Running Clippy (zero warnings enforced via -D warnings)...${NC}"
  if cargo clippy --workspace --all-targets -- -D warnings; then
    echo -e "${GREEN}  ✅ cargo clippy: zero warnings${NC}"
  else
    echo -e "${RED}  ❌ cargo clippy: warnings found — fix them before merging${NC}"
    exit 1
  fi
else
  echo -e "${YELLOW}  ⚠️  cargo not found in PATH — skipping Rust checks${NC}"
fi

# ── TypeScript configs ──────────────────────────────────────────────────────
echo -e "${YELLOW}📝 Checking TypeScript configs...${NC}"

for dir in backend frontend indexer; do
  if [ -f "$dir/tsconfig.json" ]; then
    echo "  ✅ $dir/tsconfig.json exists"
  else
    echo -e "${RED}  ❌ $dir/tsconfig.json missing${NC}"
    exit 1
  fi
done

# Verify standalone tsconfigs contain strict and noUncheckedIndexedAccess.
# Packages that DON'T extend tsconfig.base.json must set these explicitly.
echo -e "${YELLOW}📝 Verifying strict settings in all tsconfigs...${NC}"

STANDALONE_TSCONFIGS=(
  "mobile/tsconfig.json"
)

for cfg in "${STANDALONE_TSCONFIGS[@]}"; do
  if [ ! -f "$cfg" ]; then
    echo -e "${RED}  ❌ $cfg not found${NC}"
    exit 1
  fi
  if ! grep -q '"strict"' "$cfg"; then
    echo -e "${RED}  ❌ $cfg is missing \"strict\" — add it or extend tsconfig.base.json${NC}"
    exit 1
  fi
  if ! grep -q '"noUncheckedIndexedAccess"' "$cfg"; then
    echo -e "${RED}  ❌ $cfg is missing \"noUncheckedIndexedAccess\" — add it or extend tsconfig.base.json${NC}"
    exit 1
  fi
  echo "  ✅ $cfg has strict and noUncheckedIndexedAccess"
done

# Verify that configs extending tsconfig.base.json do NOT weaken strict settings.
echo -e "${YELLOW}📝 Checking for weakened strict overrides...${NC}"

EXTENDING_TSCONFIGS=(
  "frontend/tsconfig.json"
  "indexer/tsconfig.json"
  "backend/tsconfig.json"
  "tests/contract/tsconfig.json"
  "tests/integration/tsconfig.json"
  "packages/test-mocks/tsconfig.json"
  "packages/types/tsconfig.json"
  "packages/scavenger-sdk/tsconfig.json"
  "packages/shared/tsconfig.json"
)

WEAKENING_PATTERNS=(
  '"strict".*false'
  '"noUncheckedIndexedAccess".*false'
  '"noImplicitAny".*false'
  '"strictNullChecks".*false'
  '"noUnusedLocals".*false'
  '"noUnusedParameters".*false'
)

FOUND_WEAKENING=0
for cfg in "${EXTENDING_TSCONFIGS[@]}"; do
  if [ ! -f "$cfg" ]; then
    echo -e "${RED}  ❌ $cfg not found${NC}"
    exit 1
  fi
  for pat in "${WEAKENING_PATTERNS[@]}"; do
    if grep -qE "$pat" "$cfg" 2>/dev/null; then
      echo -e "${RED}  ❌ $cfg contains weakening override: $pat${NC}"
      FOUND_WEAKENING=1
    fi
  done
  echo "  ✅ $cfg: no weakening overrides"
done

if [ "$FOUND_WEAKENING" -ne 0 ]; then
  exit 1
fi

# ── ESLint configs ──────────────────────────────────────────────────────────
echo -e "${YELLOW}📝 Checking ESLint configs...${NC}"

for dir in backend frontend indexer; do
  if [ -f "$dir/eslint.config.js" ]; then
    echo "  ✅ $dir/eslint.config.js exists"
  else
    echo -e "${RED}  ❌ $dir/eslint.config.js missing${NC}"
    exit 1
  fi
done

# ── Base configs ────────────────────────────────────────────────────────────
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

# ── Prometheus rules ────────────────────────────────────────────────────────
echo -e "${YELLOW}📝 Checking Prometheus rules...${NC}"

RULES_DIR="config/prometheus/rules"

if [ ! -d "$RULES_DIR" ]; then
  echo -e "${YELLOW}  ⚠️  $RULES_DIR missing — skipping Prometheus rule validation${NC}"
else
  RULE_FILES=()
  while IFS= read -r -d '' f; do
    RULE_FILES+=("$f")
  done < <(find "$RULES_DIR" -maxdepth 1 -type f -name '*.yml' -print0 | sort -z)

  if [ ${#RULE_FILES[@]} -eq 0 ]; then
    echo -e "${RED}  ❌ No rule files found in $RULES_DIR${NC}"
    exit 1
  fi

  if ! command -v promtool >/dev/null 2>&1; then
    echo -e "${YELLOW}  ⚠️  promtool not found in PATH — skipping rule validation${NC}"
  else
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
  fi
fi

echo -e "${GREEN}✅ All configs verified!${NC}"
