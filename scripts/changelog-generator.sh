#!/bin/bash
set -euo pipefail

OUTPUT_FILE="${1:-CHANGELOG.md}"
SINCE_TAG="${2:-}"
UNTIL_TAG="${3:-HEAD}"

echo "=== Changelog Generator ==="
echo ""

if [ ! -d .git ]; then
  echo "ERROR: Not a git repository"
  exit 1
fi

if [ -z "$SINCE_TAG" ]; then
  SINCE_TAG=$(git tag --sort=-version:refname | head -1 || echo "")
  if [ -z "$SINCE_TAG" ]; then
    SINCE_TAG=$(git rev-list --max-parents=0 HEAD)
  fi
fi

echo "Generating changelog since: $SINCE_TAG"

cat > "$OUTPUT_FILE" << HEADER
# Changelog

All notable changes to the Scavenger project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

HEADER

generate_section() {
  local title=$1
  local prefix=$2
  local output=""

  local commits
  commits=$(git log "${SINCE_TAG}..${UNTIL_TAG}" --oneline --no-decorate --grep="^${prefix}" 2>/dev/null || true)

  if [ -n "$commits" ]; then
    output="### ${title}\n"
    while IFS= read -r line; do
      local msg
      msg=$(echo "$line" | sed 's/^[a-f0-9]* //' | sed 's/^'"${prefix}"'//' | sed 's/^://' | xargs)
      output="${output}- ${msg}\n"
    done <<< "$commits"
    output="${output}\n"
  fi

  echo -e "$output"
}

{
  echo "## [Unreleased]"
  echo ""

  # Generate sections by conventional commit type
  generate_section "Features" "feat"
  generate_section "Bug Fixes" "fix"
  generate_section "Documentation" "docs"
  generate_section "Performance Improvements" "perf"
  generate_section "Refactoring" "refactor"
  generate_section "Tests" "test"
  generate_section "Build System" "build"
  generate_section "Continuous Integration" "ci"
  generate_section "Chores" "chore"

  # Collect all tags for version entries
  git tag --sort=-version:refname | while read -r tag; do
    echo ""
    echo "## [$tag]"
    echo ""

    local prev_tag
    prev_tag=$(git tag --sort=-version:refname | grep -A1 "$tag" | tail -1 || echo "")

    if [ -n "$prev_tag" ]; then
      git log --oneline --no-decorate "${prev_tag}..${tag}" 2>/dev/null | while IFS= read -r line; do
        echo "- $line"
      done
    else
      git log --oneline --no-decorate "$tag" 2>/dev/null | head -20 | while IFS= read -r line; do
        echo "- $line"
      done
    fi
  done

} >> "$OUTPUT_FILE"

echo "✓ Changelog generated: $OUTPUT_FILE"
