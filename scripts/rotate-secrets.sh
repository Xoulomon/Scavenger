#!/usr/bin/env bash
# Rotate secrets in HashiCorp Vault.
#
# Usage: ./scripts/rotate-secrets.sh [--help]

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") [--help]

Rotate application secrets stored in HashiCorp Vault.

Environment (required):
  VAULT_TOKEN    Vault authentication token

Environment (optional):
  VAULT_ADDR     Vault server address  (default: http://localhost:8200)
  SECRET_PATH    KV secret path        (default: secret/scavenger)
EOF
  exit 0
fi

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
VAULT_TOKEN="${VAULT_TOKEN:?VAULT_TOKEN must be set}"
SECRET_PATH="${SECRET_PATH:-secret/scavenger}"

rotate_secret() {
  local path="$1"
  local key="$2"
  local new_value="$3"

  echo "Rotating $path/$key..."
  vault kv patch "$path" "$key=$new_value"
  echo "  rotated $key"
}

check_rotation_needed() {
  local path="$1"
  local threshold_days="${2:-30}"

  metadata=$(vault kv metadata get -format=json "$path" 2>/dev/null || echo '{}')
  created=$(echo "$metadata" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('updated_time',''))" 2>/dev/null || echo "")

  if [ -z "$created" ]; then
    echo "new"
    return
  fi

  age_days=$(( ( $(date +%s) - $(date -d "$created" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${created%%.*}" +%s 2>/dev/null || echo 0) ) / 86400 ))

  if [ "$age_days" -ge "$threshold_days" ]; then
    echo "stale ($age_days days)"
  else
    echo "fresh ($age_days days)"
  fi
}

echo "Checking secret ages..."

api_status=$(check_rotation_needed "secret/scavenger/api" 30)
stellar_status=$(check_rotation_needed "secret/scavenger/stellar" 90)
db_status=$(check_rotation_needed "secret/scavenger/database" 7)

echo "  API secrets:      $api_status"
echo "  Stellar secrets:  $stellar_status"
echo "  DB credentials:   $db_status"

if [[ "$api_status" == stale* ]]; then
  echo "API secrets require rotation — update via Vault UI or CI/CD pipeline"
  exit 2
fi

if [[ "$stellar_status" == stale* ]]; then
  echo "Stellar secrets require rotation — update via Vault UI or CI/CD pipeline"
  exit 2
fi

if [[ "$db_status" == stale* ]]; then
  echo "Database credentials require rotation — update via Vault UI or CI/CD pipeline"
  exit 2
fi

echo "All secrets are within rotation window."
