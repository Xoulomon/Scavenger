#!/usr/bin/env bash
# Verify that every relative Markdown link inside docs/adr/ resolves to an existing file.
# Usage: scripts/check-adr-links.sh
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADR_DIR="$ROOT/docs/adr"
broken=0

while IFS= read -r file; do
  dir="$(dirname "$file")"
  # Fenced code blocks are skipped: they show example commands, not links.
  targets="$(awk '/^```/{f=!f; next} !f' "$file" | grep -oE '\]\([^)]+\)' | sed -E 's/^\]\(//; s/\)$//' || true)"
  while IFS= read -r target; do
    [ -z "$target" ] && continue
    case "$target" in
      http://*|https://*|mailto:*|\#*) continue ;;
    esac
    path="${target%%#*}"
    if [ ! -e "$dir/$path" ]; then
      echo "BROKEN: ${file#"$ROOT"/} -> $target"
      broken=1
    fi
  done <<< "$targets"
done < <(find "$ADR_DIR" -name '*.md' | sort)

if [ "$broken" -eq 0 ]; then
  echo "All ADR links resolve."
fi
exit "$broken"
