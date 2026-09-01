#!/bin/bash
set -euo pipefail

ACTION="${1:-status}"

echo "=== Release Tracking ==="
echo ""

list_releases() {
  echo "Recent releases:"
  git tag --sort=-version:refname | head -10 | while read -r tag; do
    local date
    date=$(git log -1 --format=%ci "$tag" 2>/dev/null | cut -d' ' -f1 || echo "unknown")
    echo "  $tag ($date)"
  done
}

show_release_details() {
  local version=$1
  echo "Release: $version"
  echo "Date: $(git log -1 --format=%ci "$version" 2>/dev/null || echo 'unknown')"
  echo "Author: $(git log -1 --format=%an "$version" 2>/dev/null || echo 'unknown')"
  echo ""
  echo "Changes since previous release:"
  local prev_tag
  prev_tag=$(git tag --sort=-version:refname | grep -A1 "$version" | tail -1 || echo "")
  if [ -n "$prev_tag" ]; then
    git log --oneline --no-decorate "${prev_tag}..${version}" 2>/dev/null || echo "  No changes found"
  else
    git log --oneline --no-decorate "$version" --max-count=10 2>/dev/null || echo "  No changes found"
  fi
  echo ""
  echo "Artifacts:"
  echo "  Tag: $version"
  echo "  Branch: $(git log -1 --format=%D "$version" 2>/dev/null | grep -o 'tag: [^,]*' | head -1 || echo 'unknown')"
}

show_pending() {
  echo "Pending changes for next release:"
  local latest_tag
  latest_tag=$(git tag --sort=-version:refname | head -1 || echo "")

  if [ -n "$latest_tag" ]; then
    local count
    count=$(git rev-list --count "${latest_tag}..HEAD" 2>/dev/null || echo "0")
    if [ "$count" -gt 0 ]; then
      echo "  $count commits since $latest_tag:"
      git log --oneline --no-decorate "${latest_tag}..HEAD" 2>/dev/null | while IFS= read -r line; do
        echo "    $line"
      done
    else
      echo "  No pending changes"
    fi
  else
    echo "  No releases yet"
  fi
}

case "$ACTION" in
  list)
    list_releases
    ;;
  show)
    shift
    show_release_details "${1:-$(git tag --sort=-version:refname | head -1)}"
    ;;
  status)
    echo "Current branch: $(git rev-parse --abbrev-ref HEAD)"
    echo "Latest commit: $(git log --oneline -1)"
    echo ""
    list_releases
    echo ""
    show_pending
    ;;
  pending)
    show_pending
    ;;
  *)
    echo "Usage: $0 {status|list|show|pending}"
    echo ""
    echo "  status  - Show overall release status"
    echo "  list    - List recent releases"
    echo "  show    - Show release details"
    echo "  pending - Show pending changes"
    exit 1
    ;;
esac
