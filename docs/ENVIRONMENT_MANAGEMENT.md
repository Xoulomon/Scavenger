# Environment Management Guide

## Overview

Scavenger operates three distinct environments with specific configurations:
- **Development**: Local/containerized for feature development
- **Staging**: QA environment mirroring production
- **Production**: Live customer environment

## Environment Promotion Process

### Flow: dev → staging → production

```
Dev (feature branch)
    ↓ (manual approval)
Staging (QA testing)
    ↓ (manual approval)
Production (blue-green deployment)
```

### Promotion to Staging

```bash
# Prerequisites
- All tests passing in CI/CD
- Code reviewed and approved
- Database migrations tested

# Execute
./scripts/promote-to-staging.sh

# Verification
- Run smoke tests
- Verify health checks
- Monitor logs for errors
```

### Promotion to Production

```bash
# Prerequisites
- Staging verified for 24 hours minimum
- Load testing completed
- Rollback plan documented

# Execute
./scripts/promote-to-prod.sh

# Verification
- Check all services healthy
- Monitor error rates
- Verify database replication
```

### Rollback Procedure

```bash
./scripts/rollback-prod.sh

# Or manual rollback
kubectl patch service scavenger-backend -n prod \
  -p '{"spec":{"selector":{"version":"blue"}}}'
```

## Configuration Management

### Environment-Specific Settings

All environment variables are defined in:
- `terraform/environments/{dev,staging,prod}.tfvars`
- `config/vault-secrets-config.hcl` (Vault policies)
- Kubernetes ConfigMaps per environment

### Secrets Management

**Development**: `.env.local` (git-ignored)
```bash
cp .env.example .env.local
# Edit with local values
```

**Staging/Production**: HashiCorp Vault
```bash
# Login to Vault
vault login -method=oidc

# Read secrets
vault kv get secret/staging/database

# Update secrets
vault kv put secret/prod/database username=user password=***
```

### Configuration Hierarchy

1. Vault/Secrets Manager (highest priority)
2. Environment variables
3. ConfigMaps
4. Terraform variables
5. Defaults in code

## Health Checks

### Environment Health Monitoring

All environments have automated health checks every 5 minutes:

```bash
# Manual check
curl http://scavenger-backend-{env}.internal:8080/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "v1.2.3",
  "services": ["contracts", "websocket", "export", "audit", "verification"]
}
```

### Alert Thresholds

- Response time > 1000ms → warning
- Error rate > 1% → critical
- Memory > 90% → warning
- CPU > 80% → warning

## Scaling Policies

### Development
- Min: 1 replica
- Max: 2 replicas
- Target CPU: 70%
- Target Memory: 80%

### Staging
- Min: 2 replicas
- Max: 5 replicas
- Target CPU: 70%
- Target Memory: 80%

### Production
- Min: 3 replicas
- Max: 10 replicas
- Target CPU: 60%
- Target Memory: 75%
- Scale-up: 50% CPU increase = 30s decision window
- Scale-down: 5 minute stability window

## Database Management

### Schema Migrations

```bash
# Dev
npm run migrate:dev

# Staging (with backup)
npm run migrate:staging

# Production (with approval + backup)
npm run migrate:prod --require-approval
```

### Backup Schedules

| Environment | Backup Frequency | Retention |
|---|---|---|
| Dev | Manual | N/A |
| Staging | Daily | 7 days |
| Production | Hourly | 90 days |

## Monitoring & Logging

### Log Aggregation

- **Dev**: Local logs + 7 day retention
- **Staging**: CloudWatch + 14 day retention
- **Production**: CloudWatch + 90 day retention

### Environment Dashboards

Access Grafana dashboards:
- Dev: http://grafana-dev.internal
- Staging: http://grafana-staging.internal
- Production: http://grafana-prod.internal

## Cost Optimization

### Development
- Scheduled shutdown: 7 PM - 7 AM
- t3.micro database
- No redundancy

### Staging
- Continuous operation
- t3.small database
- Single backup retention

### Production
- Continuous operation
- r6i.large database (HA)
- Full backup retention
- Reserved instances (30% cost savings)

## Environment Variables Reference

Environment variables are documented in three `.env.example` files, one per component:

| Component | Example file | Code that references variables |
|---|---|---|
| Root / backend | `.env.example` | `src/` (Node backend) |
| Frontend | `frontend/.env.example` | `frontend/src/` (`VITE_*` variables) |
| Indexer | `indexer/.env.example` | `indexer/src/` (`process.env.*`) |

### Common Variables
```
ENVIRONMENT=dev|staging|prod
RUST_LOG=debug|info|warn
LOG_FORMAT=json|text
ENABLE_PROFILING=true|false
```

### Service-Specific
```
# Backend
DATABASE_MAX_CONNECTIONS=20|50|100
REDIS_URL=redis://...
S3_BUCKET=scavenger-{env}

# Indexer
SOROBAN_NETWORK=standalone|testnet|mainnet
CONTRACT_ID={environment-specific}
SYNC_INTERVAL_SECONDS=30|60|120
```

### Required Variables by Component

**Root / backend (`.env.example`)**
- Every variable read via `process.env.*` in the backend source must be listed here.
- Includes database, Redis, S3, logging and environment settings shown above.

**Frontend (`frontend/.env.example`)**
- Only `VITE_*` variables are exposed to the browser bundle and must be prefixed with `VITE_`.
- Every `import.meta.env.VITE_*` / `VITE_*` reference in `frontend/src` must appear in this file.
- Never put secrets in `VITE_*` variables — they are embedded in the client bundle.

**Indexer (`indexer/.env.example`)**
- Every `process.env.*` reference in `indexer/src` must appear in this file.
- Includes `SOROBAN_NETWORK`, `CONTRACT_ID`, `SYNC_INTERVAL_SECONDS` and related settings.

## Environment Variable Parity Check

To prevent setup failures for new contributors, the repository enforces parity between
code usage and the `.env.example` files with `scripts/check-env-parity.mjs`.

### What it does

1. Extracts every `VITE_*` reference from `frontend/src`.
2. Extracts every `process.env.*` reference from `indexer/src` (and the backend source).
3. Compares the extracted names against the corresponding `.env.example` file.
4. Reports:
   - **Missing**: variables used in code but absent from the example file.
   - **Unused**: variables present in the example file but not referenced in code.

### Running the check

```bash
# Run directly
node scripts/check-env-parity.mjs

# Or via npm script (if defined)
npm run check:env-parity
```

The script exits with a non-zero status code when drift is detected, so it can be wired
into CI and pre-commit hooks. A clean run exits `0`.

### Fixing drift

- **Missing variable**: add it to the relevant `.env.example` with a safe placeholder value
  and a short comment describing its purpose.
- **Unused variable**: remove it from the `.env.example`, or — if it is intentionally kept
  (e.g. reserved for an upcoming feature or consumed by tooling outside the scanned source) —
  document it as an intentional exception (see below).

### Intentional exceptions

When a variable must remain in an `.env.example` without a direct code reference, record it
in the exception list inside `scripts/check-env-parity.mjs` (with a comment explaining why).
The script ignores listed exceptions when reporting unused variables. Keep this list small
and review it during code review; remove entries once the variable is either used or deleted.

### Verifying the check

```bash
# 1. Run the script — should exit 0 on a clean tree
node scripts/check-env-parity.mjs

# 2. Deliberately introduce drift, e.g. add an unused entry to frontend/.env.example
echo "VITE_UNUSED_EXAMPLE=1" >> frontend/.env.example

# 3. Re-run — should exit non-zero and report the unused variable
node scripts/check-env-parity.mjs

# 4. Revert the change
git checkout frontend/.env.example
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
kubectl logs -f deployment/scavenger-backend -n {env}

# Check environment variables
kubectl describe pod -n {env} scavenger-backend-xxx

# Verify secrets loaded
kubectl exec -it pod/scavenger-backend-xxx -- env | grep DB_
```

### Database Connection Issues

```bash
# Test connectivity
psql -h db-{env}.internal -U user -d scavenger

# Check replication status
SELECT * FROM pg_stat_replication;

# Monitor query performance
SELECT query, calls, mean_time FROM pg_stat_statements;
```

### Scaling Issues

```bash
# Check HPA status
kubectl get hpa -n {env}

# View scaling events
kubectl describe hpa backend-hpa-{env} -n {env}

# Manual scaling
kubectl scale deployment scavenger-backend --replicas=5 -n {env}
```

## Disaster Recovery

For environment-specific recovery procedures, see:
- [Disaster Recovery Runbook](DISASTER_RECOVERY_RUNBOOK.md)
- RTO/RPO SLAs by environment in runbook
- Automated backup verification scripts

## Documentation References

- Deployment: [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md)
- Infrastructure: [terraform/](../terraform/)
- Kubernetes: [k8s/](../k8s/)
- Monitoring: [MONITORING_AND_ALERTING_GUIDE.md](MONITORING_AND_ALERTING_GUIDE.md)
