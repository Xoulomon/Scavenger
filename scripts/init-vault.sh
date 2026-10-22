#!/usr/bin/env bash
# Initialise HashiCorp Vault secrets for the Scavenger project.
#
# Usage: ./scripts/init-vault.sh [--help]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--help]

Bootstrap Vault with the KV secrets, policy, and Kubernetes auth role required
by the Scavenger application.

Environment (required):
  VAULT_TOKEN                HashiCorp Vault root/admin token
  CONTRACT_ID                Soroban contract ID
  RPC_URL                    Stellar RPC URL
  STELLAR_SECRET_KEY         Stellar account secret key
  FIREBASE_API_KEY           Firebase API key
  FIREBASE_AUTH_DOMAIN       Firebase auth domain
  FIREBASE_PROJECT_ID        Firebase project ID
  FIREBASE_STORAGE_BUCKET    Firebase storage bucket
  FIREBASE_MESSAGING_SENDER_ID  Firebase messaging sender ID
  FIREBASE_APP_ID            Firebase app ID
  FIREBASE_MEASUREMENT_ID    Firebase measurement ID

Environment (optional):
  VAULT_ADDR   Vault server address  (default: http://localhost:8200)
  NETWORK      Stellar network       (default: TESTNET)
EOF
  exit 0
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
fi

VAULT_ADDR="${VAULT_ADDR:-http://localhost:8200}"
# VAULT_TOKEN is required — do not self-assign (SC2269).
# It must be set in the caller's environment.
: "${VAULT_TOKEN:?VAULT_TOKEN must be set}"

export VAULT_ADDR
export VAULT_TOKEN

echo "Initializing Vault secrets for Scavenger..."

# Enable KV v2 secrets engine
vault secrets enable -version=2 -path=secret kv || true

# Create API secrets
vault kv put secret/scavenger/api \
  contract_id="${CONTRACT_ID}" \
  network="${NETWORK:-TESTNET}" \
  rpc_url="${RPC_URL}" \
  firebase_api_key="${FIREBASE_API_KEY}" \
  firebase_auth_domain="${FIREBASE_AUTH_DOMAIN}" \
  firebase_project_id="${FIREBASE_PROJECT_ID}" \
  firebase_storage_bucket="${FIREBASE_STORAGE_BUCKET}" \
  firebase_messaging_sender_id="${FIREBASE_MESSAGING_SENDER_ID}" \
  firebase_app_id="${FIREBASE_APP_ID}" \
  firebase_measurement_id="${FIREBASE_MEASUREMENT_ID}"

# Create Stellar secrets
vault kv put secret/scavenger/stellar \
  secret_key="${STELLAR_SECRET_KEY}" \
  network="${NETWORK:-TESTNET}"

# Enable audit logging
vault audit enable file file_path=/vault/logs/audit.log || true

# Create policy for app access
vault policy write scavenger-policy - <<'POLICY'
path "secret/data/scavenger/*" {
  capabilities = ["read", "list"]
}

path "secret/metadata/scavenger/*" {
  capabilities = ["list"]
}

path "auth/token/renew-self" {
  capabilities = ["update"]
}
POLICY

# Create Kubernetes auth role
vault write auth/kubernetes/role/scavenger-app \
  bound_service_account_names=scavenger \
  bound_service_account_namespaces=default \
  policies=scavenger-policy \
  ttl=24h

echo "Vault initialization complete!"
