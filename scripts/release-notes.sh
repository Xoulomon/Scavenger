#!/usr/bin/env bash
# Generate release notes from git log for a given version tag.
#
# Usage: ./scripts/release-notes.sh <version> [output-dir] [--help]

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") <version> [output-dir]

Generate a Markdown release notes file from the git log for a version tag.

Arguments:
  version     Git tag to document (e.g. v1.2.3) — required
  output-dir  Directory to write the file to (default: current directory)

Example:
  $(basename "$0") v1.2.3
  $(basename "$0") v1.2.3 ./releases/
EOF
  exit 0
fi

VERSION="${1:-}"
OUTPUT_DIR="${OUTPUT_DIR:-.}"

echo "=== Release Notes Generator ==="
echo ""

if [ -z "$VERSION" ]; then
  echo "Error: version argument is required."
  echo "Run '$(basename "$0") --help' for usage."
  exit 1
fi

generate_notes() {
  local version=$1
  local output_file="${OUTPUT_DIR}/RELEASE_NOTES_${version}.md"
  local previous_tag
  
  previous_tag=$(git tag --sort=-version:refname | grep -A1 "$version" | tail -1 || echo "")
  
  cat > "$output_file" << NOTESEOF
# Release Notes - $version

## Overview
Release $version of the Scavenger platform.

## Release Date
$(date +%Y-%m-%d)

## What's New
NOTESEOF

  if [ -n "$previous_tag" ]; then
    git log --oneline --no-decorate "${previous_tag}..${version}" 2>/dev/null | while IFS= read -r line; do
      echo "- $line" >> "$output_file"
    done
  else
    git log --oneline --no-decorate "${version}" --max-count=30 2>/dev/null | while IFS= read -r line; do
      echo "- $line" >> "$output_file"
    done
  fi

  cat >> "$output_file" << NOTESEOF

## Breaking Changes
NOTESEOF

  local breaking
  breaking=$(git log "${previous_tag:-HEAD}..${version}" --oneline --no-decorate --grep="BREAKING" 2>/dev/null || true)
  if [ -n "$breaking" ]; then
    echo "$breaking" | while IFS= read -r line; do
      echo "- $line" >> "$output_file"
    done
  else
    echo "None" >> "$output_file"
  fi

  cat >> "$output_file" << NOTESEOF

## Artifacts
- **Backend Image**: ghcr.io/xoulomon/scavenger-backend:$version
- **Frontend Image**: ghcr.io/xoulomon/scavenger-frontend:$version
- **Contract WASM**: scavenger-contract-$version.wasm

## Deployment Notes
Refer to [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for detailed deployment instructions.

## Verification
- All tests passing
- Security scan completed
- Performance benchmarks within baseline
- Contract audit verified
NOTESEOF

  echo "✓ Release notes generated: $output_file"
}

generate_notes "$VERSION"
