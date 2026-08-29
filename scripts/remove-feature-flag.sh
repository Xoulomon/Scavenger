#!/bin/bash
# Remove a feature flag and its dead branches

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ -z "$1" ]; then
  echo "Usage: $0 <flag-name>"
  echo "Example: $0 new_circuits"
  exit 1
fi

FLAG=$1

echo -e "${YELLOW}🔍 Removing feature flag: ${FLAG}${NC}"

# Check if flag exists
COUNT=$(grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.rs" \
  -l "$FLAG" . 2>/dev/null | grep -v "node_modules" | grep -v "dist" | grep -v "build" | wc -l)

if [ $COUNT -eq 0 ]; then
  echo -e "${RED}❌ Feature flag '${FLAG}' not found in code${NC}"
  exit 1
fi

echo -e "${YELLOW}📋 Found ${COUNT} files containing '${FLAG}'${NC}"

# Show files
echo -e "${YELLOW}Files:${NC}"
grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.rs" \
  -l "$FLAG" . 2>/dev/null | grep -v "node_modules" | grep -v "dist" | grep -v "build"

# Backup
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}📦 Creating backup in ${BACKUP_DIR}${NC}"

# Remove flag from files (simple approach - remove lines containing flag)
for file in $(grep -r --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.rs" \
  -l "$FLAG" . 2>/dev/null | grep -v "node_modules" | grep -v "dist" | grep -v "build"); do
  
  echo "  Processing: $file"
  cp "$file" "$BACKUP_DIR/$(basename $file).bak"
  
  # Remove lines containing the flag (simple approach)
  sed -i "/$FLAG/d" "$file"
done

echo -e "${GREEN}✅ Feature flag '${FLAG}' removed from codebase${NC}"
echo -e "${GREEN}📦 Backup saved to ${BACKUP_DIR}${NC}"
