#!/usr/bin/env bash
# Invalidate a CloudFront distribution.
# Canonical implementation — called directly or from CI.
#
# Usage: ./scripts/cdn-invalidation.sh [distribution-id] [paths]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [distribution-id] [paths]

Invalidate objects in a CloudFront distribution.

Arguments:
  distribution-id   CloudFront distribution ID (e.g. E1234567890ABC).
                    Falls back to DISTRIBUTION_ID env var if omitted.
  paths             Space-separated path(s) to invalidate (default: /*)

Examples:
  $(basename "$0") E1234567890ABC "/*"
  $(basename "$0") E1234567890ABC "/index.html /app.js"
  DISTRIBUTION_ID=E1234567890ABC $(basename "$0") "/index.html"
EOF
  exit 0
}

if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
  usage
fi

if [[ "${1:-}" =~ ^E[A-Z0-9]{10,}$ ]]; then
  DISTRIBUTION_ID="$1"
  shift
else
  DISTRIBUTION_ID="${DISTRIBUTION_ID:-}"
fi

if [[ -z "$DISTRIBUTION_ID" ]]; then
  echo "Error: CloudFront distribution ID is required." >&2
  usage
fi

PATHS="${1:-/*}"

command -v aws >/dev/null 2>&1 || {
  echo "Error: AWS CLI is required to run this script." >&2
  exit 1
}

echo "Invalidating CloudFront distribution: $DISTRIBUTION_ID"
echo "Paths: $PATHS"

# Create invalidation
# Word-splitting on $PATHS is intentional here: the --paths flag accepts
# space-separated path tokens, so we deliberately do not quote it.
# shellcheck disable=SC2086
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "$DISTRIBUTION_ID" \
  --paths $PATHS \
  --query 'Invalidation.Id' \
  --output text)

echo "Invalidation created: $INVALIDATION_ID"

# Wait for invalidation to complete
echo "Waiting for invalidation to complete..."
aws cloudfront wait invalidation-completed \
  --distribution-id "$DISTRIBUTION_ID" \
  --id "$INVALIDATION_ID"

echo "Invalidation complete!"
