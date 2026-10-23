#!/usr/bin/env bash
# Audit feature flags in the codebase.
#
# Usage: ./scripts/audit-feature-flags.sh [--help]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--help]

Check each known feature flag for usage across source, docs, and test files.
Reports flags that are completely unused or only present in documentation.
EOF
  exit 0
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
fi

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔍 Auditing feature flags...${NC}"

# Feature flags to check (based on common flags)
FLAGS=(
  "new_circuits"
  "contract_upgrade"
  "experimental_ui"
  "chat_enabled"
  "solo_mode"
  "enable_analytics"
  "beta_features"
  "ai_assistant"
  "dark_mode"
  "notifications_v2"
  "api_v2"
  "payment_gateway"
  "social_login"
  "multi_currency"
  "advanced_search"
  "user_analytics"
  "admin_dashboard"
  "performance_metrics"
  "security_audit"
  "content_moderation"
)

echo -e "${YELLOW}📋 Checking ${#FLAGS[@]} potential feature flags...${NC}"
echo ""

for flag in "${FLAGS[@]}"; do
  echo -e "${BLUE}Checking flag: ${flag}${NC}"

  # Count occurrences in code (excluding docs and test files)
  # grep -c counts matching files; || true prevents exit on no match
  COUNT=$(grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.rs" \
    -l "$flag" . 2>/dev/null \
    | grep -v "node_modules" | grep -v "dist" | grep -v "build" \
    | grep -c "" || true)

  DOCS_COUNT=$(grep -r --include="*.md" -l "$flag" ./docs 2>/dev/null | grep -c "" || true)
  TEST_COUNT=$(grep -r --include="*.test.ts" --include="*.spec.ts" -l "$flag" . 2>/dev/null | grep -c "" || true)

  TOTAL_COUNT=$((COUNT + DOCS_COUNT + TEST_COUNT))

  if [ "$TOTAL_COUNT" -eq 0 ]; then
    echo -e "  ${RED}❌ Flag found: ${flag} (completely unused)${NC}"
  elif [ "$COUNT" -eq 0 ] && [ "$DOCS_COUNT" -gt 0 ]; then
    echo -e "  ${YELLOW}⚠️ Flag found: ${flag} (only in docs, not in code)${NC}"
  else
    echo -e "  ${GREEN}✅ Flag in use: ${flag} (${COUNT} code files, ${DOCS_COUNT} docs, ${TEST_COUNT} tests)${NC}"
  fi
  echo ""
done

echo -e "${GREEN}✅ Feature flag audit complete!${NC}"
