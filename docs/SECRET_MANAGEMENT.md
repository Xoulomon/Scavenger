# Secret Management

Scavenger uses HashiCorp Vault for secure secret management with automatic rotation and audit logging.

## Architecture

- **Vault Server**: Central secret store with encryption at rest
- **Vault Agent**: Sidecar for automatic secret injection
- **Kubernetes Auth**: Pod identity-based authentication
- **Audit Logging**: All secret access is logged

## Setup

### Prerequisites

- Vault 1.12+
- Kubernetes cluster
- kubectl access

### Installation

1. **Deploy Vault**

```bash
helm repo add hashicorp https://helm.releases.hashicorp.com
helm install vault hashicorp/vault \
  --namespace vault \
  --create-namespace \
  -f config/vault-values.yaml
```

2. **Initialize Vault**

```bash
./scripts/init-vault.sh
```

3. **Configure Kubernetes Auth**

```bash
vault auth enable kubernetes
vault write auth/kubernetes/config \
  kubernetes_host="https://$KUBERNETES_SERVICE_HOST:$KUBERNETES_SERVICE_PORT" \
  kubernetes_ca_cert=@/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  token_reviewer_jwt=@/var/run/secrets/kubernetes.io/serviceaccount/token
```

## Secret Rotation

Rotation intervals per secret type:

| Secret               | Interval | Policy file                        |
| -------------------- | -------- | ---------------------------------- |
| API keys / Firebase  | 30 days  | `config/vault-rotation-policy.hcl` |
| Stellar signing key  | 90 days  | `config/vault-rotation-policy.hcl` |
| Database credentials | 7 days   | `config/vault-rotation-policy.hcl` |

Apply rotation policy:

```bash
vault policy write scavenger-rotation config/vault-rotation-policy.hcl
```

Check which secrets need rotation:

```bash
VAULT_TOKEN=<token> ./scripts/rotate-secrets.sh
```

The script exits with code `2` if any secret exceeds its rotation window.

## Secret Injection (Kubernetes)

Vault Agent is configured as a sidecar injector. Apply the manifest:

```bash
kubectl apply -f k8s/vault-agent-injector.yaml
```

Secrets are mounted at `/vault/secrets/` inside the pod and sourced into the environment at startup. The injector uses pod annotations — see `k8s/vault-agent-injector.yaml` for the full annotation set.

The agent config is in `config/vault-config.hcl`. Templates that render `.env`-style files live in `config/vault-templates/`.

## Access Control

Secrets are accessed via Kubernetes service account authentication. The `scavenger` service account is bound to the `scavenger-app` Vault role, which grants read-only access to `secret/data/scavenger/*`.

## Audit Logging

All secret access is logged to `/vault/logs/audit.log`.

Enable during setup:

```bash
vault audit enable file file_path=/vault/logs/audit.log
```

## Local Development

For local development, use environment variables or a `.env` file. Do not run `scripts/init-vault.sh` against production Vault.

## Emergency Access

In an emergency, use the break-glass procedure with the root token. The root token must be regenerated after use:

```bash
vault token revoke <root-token>
vault operator generate-root
```
