#!/bin/bash
set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🔍 Validating error messages...${NC}"

find . -type f \( -name "*.ts" -o -name "*.js" -o -name "*.tsx" -o -name "*.jsx" \) \
  -not -path "./node_modules/*" \
  -not -path "./dist/*" \
  -not -path "./build/*" \
  -not -path "./.next/*" \
  | while read -r file; do

  grep -n -E "new (App)?Error\s*\(\s*['\"]" "$file" | while read -r line; do
    message=$(echo "$line" | sed -n "s/.*new \(App\)\?Error\s*(\s*['\"]\([^'\"]*\)['\"].*/\2/p")
    if [ -n "$message" ]; then
      if [ -n "$message" ] && [ "${message:0:1}" != "${message:0:1^^}" ]; then
        echo -e "${RED}❌ $file: Message starts with lowercase: '$message'${NC}"
      fi
      if [ -n "$message" ] && [ "${message: -1}" != "." ]; then
        echo -e "${RED}❌ $file: Message missing period: '$message'${NC}"
      fi
    fi
  done
done

echo -e "${GREEN}✅ Error message validation complete!${NC}"
