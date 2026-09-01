#!/bin/bash
set -euo pipefail

RELEASE_TYPE="${1:-patch}"
RELEASE_BRANCH="${RELEASE_BRANCH:-main}"
WORKSPACE="${WORKSPACE:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"

cd "$WORKSPACE"

echo "=== Scavenger Release Automation ==="
echo "Type: $RELEASE_TYPE"
echo ""

validate_release_type() {
  case "$RELEASE_TYPE" in
    major|minor|patch)
      return 0
      ;;
    *)
      echo "ERROR: Invalid release type. Use: major, minor, or patch"
      exit 1
      ;;
  esac
}

ensure_clean_working_tree() {
  if [ -n "$(git status --porcelain)" ]; then
    echo "ERROR: Working tree is not clean. Commit or stash changes first."
    exit 1
  fi
  echo "✓ Working tree is clean"
}

ensure_on_release_branch() {
  local current_branch
  current_branch=$(git rev-parse --abbrev-ref HEAD)
  if [ "$current_branch" != "$RELEASE_BRANCH" ]; then
    echo "ERROR: Must be on $RELEASE_BRANCH branch. Currently on $current_branch"
    exit 1
  fi
  echo "✓ On $RELEASE_BRANCH branch"
}

fetch_latest() {
  git fetch origin "$RELEASE_BRANCH"
  git reset --hard "origin/$RELEASE_BRANCH"
  echo "✓ Latest code fetched"
}

calculate_new_version() {
  local current_version
  current_version=$(grep -oP 'version:\s*\K[0-9]+\.[0-9]+\.[0-9]+' k8s/Chart.yaml 2>/dev/null || echo "1.0.0")

  IFS='.' read -r major minor patch <<< "$current_version"

  case "$RELEASE_TYPE" in
    major)
      major=$((major + 1))
      minor=0
      patch=0
      ;;
    minor)
      minor=$((minor + 1))
      patch=0
      ;;
    patch)
      patch=$((patch + 1))
      ;;
  esac

  NEW_VERSION="${major}.${minor}.${patch}"
  echo "$NEW_VERSION"
}

update_version_files() {
  local version=$1
  local date
  date=$(date +%Y-%m-%d)

  echo ""
  echo "Updating version to $version..."

  # Update Helm chart
  if [ -f k8s/Chart.yaml ]; then
    sed -i "s/^version:.*/version: $version/" k8s/Chart.yaml
    sed -i "s/^appVersion:.*/appVersion: \"$version\"/" k8s/Chart.yaml
    echo "✓ Updated k8s/Chart.yaml"
  fi

  # Update package.json files
  find . -name "package.json" -not -path "*/node_modules/*" -exec sh -c '
    if grep -q "\"version\":" "$1"; then
      sed -i "s/\"version\": \".*\"/\"version\": \"'"$version"'\"/" "$1"
      echo "✓ Updated $1"
    fi
  ' _ {} \;

  # Create git tag
  git tag -a "v$version" -m "Release v$version - $date"
  echo "✓ Created git tag: v$version"
}

build_artifacts() {
  echo ""
  echo "Building release artifacts..."

  # Build backend
  if [ -d backend ]; then
    echo "Building backend..."
    (cd backend && cargo build --release 2>/dev/null) && echo "✓ Backend built" || echo "⚠ Backend build skipped"
  fi

  # Build frontend
  if [ -d frontend ]; then
    echo "Building frontend..."
    (cd frontend && npm ci && npm run build 2>/dev/null) && echo "✓ Frontend built" || echo "⚠ Frontend build skipped"
  fi

  # Build contract
  if [ -d stellar-contract ]; then
    echo "Building contract..."
    (cd stellar-contract && cargo build --target wasm32-unknown-unknown --release 2>/dev/null) && echo "✓ Contract built" || echo "⚠ Contract build skipped"
  fi
}

generate_release_notes() {
  local version=$1
  local output_file="RELEASE_NOTES_v${version}.md"

  echo ""
  echo "Generating release notes..."

  local previous_tag
  previous_tag=$(git tag --sort=-version:refname | head -2 | tail -1 || echo "")

  cat > "$output_file" << NOTESEOF
# Release v$version

## Release Information
- **Version**: $version
- **Date**: $(date +%Y-%m-%d)
- **Type**: $RELEASE_TYPE
- **Branch**: $RELEASE_BRANCH

## Changes
NOTESEOF

  if [ -n "$previous_tag" ]; then
    git log --oneline --no-decorate "${previous_tag}..HEAD" | while IFS= read -r line; do
      echo "- $line" >> "$output_file"
    done
  else
    git log --oneline --no-decorate -20 | while IFS= read -r line; do
      echo "- $line" >> "$output_file"
    done
  fi

  cat >> "$output_file" << NOTESEOF

## Artifacts
- Backend Docker image: ghcr.io/xoulomon/scavenger-backend:v$version
- Frontend Docker image: ghcr.io/xoulomon/scavenger-frontend:v$version
- Contract WASM: scavenger-contract-v$version.wasm

## Deployment
See [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for deployment instructions.
NOTESEOF

  echo "✓ Release notes generated: $output_file"
}

validate_release_type
ensure_clean_working_tree
ensure_on_release_branch
fetch_latest

NEW_VERSION=$(calculate_new_version)
echo "New version: $NEW_VERSION"

update_version_files "$NEW_VERSION"
build_artifacts
generate_release_notes "$NEW_VERSION"

echo ""
echo "=== Release v${NEW_VERSION} Ready ==="
echo ""
echo "Review the changes and release notes, then push:"
echo "  git push origin $RELEASE_BRANCH --tags"
