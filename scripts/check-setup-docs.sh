#!/usr/bin/env bash
# Verify the consolidated developer setup guide (docs/getting-started.md):
#   1. every setup doc that was reduced to a pointer links to the guide;
#   2. every relative link in the guide resolves;
#   3. every compose service and env example the guide names exists.
# Usage: scripts/check-setup-docs.sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
GUIDE="docs/getting-started.md"
failures=0
fail() { echo "FAIL: $1"; failures=$((failures + 1)); }

for pointer in docs/local-dev-setup.md docs/DEV_ENVIRONMENT.md docs/DOCKER_SETUP.md; do
  grep -q "getting-started.md" "$pointer" || fail "$pointer does not link to $GUIDE"
done
grep -q "getting-started.md" docs/DEVELOPER_ONBOARDING.md || fail "DEVELOPER_ONBOARDING.md does not link to $GUIDE"

# Relative links, with fenced code skipped.
targets="$(awk '/^```/{f=!f; next} !f' "$GUIDE" | grep -oE '\]\([^)]+\)' | sed -E 's/^\]\(//; s/\)$//' || true)"
while IFS= read -r t; do
  [ -z "$t" ] && continue
  case "$t" in http://*|https://*|\#*) continue ;; esac
  [ -e "docs/${t%%#*}" ] || fail "broken link in $GUIDE: $t"
done <<< "$targets"

# Compose services named in the guide's service table.
for svc in stellar postgres redis backend indexer frontend; do
  grep -qE "^  ${svc}:$" docker-compose.yml || fail "compose service '$svc' listed in guide is not in docker-compose.yml"
done

# Env examples the guide tells people to copy.
for env in .env.example frontend/.env.example indexer/.env.example; do
  [ -f "$env" ] || fail "env example '$env' named in guide is missing"
done

if [ "$failures" -eq 0 ]; then
  echo "Setup docs check passed."
fi
exit "$failures"
