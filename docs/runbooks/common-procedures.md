# Common Operational Procedures

Version: 1.0
Last updated: 2026-06-28
Owner: @on-call-team

---

## 1. Horizontal Scaling — Backend Pods

**Trigger:** CPU or memory utilisation above 80 % sustained for > 5 minutes, or request queue depth rising.

**Prerequisites:** `kubectl` configured for the target cluster, `scavenger-backend` namespace access.

### Steps

```bash
# 1. Check current replica count
kubectl get deployment scavenger-backend -n scavenger-backend

# 2. Scale up (replace N with desired count)
kubectl scale deployment scavenger-backend \
  --replicas=N \
  -n scavenger-backend

# 3. Watch pods come up
kubectl rollout status deployment/scavenger-backend -n scavenger-backend
```

### Verification

```bash
# All N pods should be Running
kubectl get pods -n scavenger-backend -l app=scavenger-backend

# P95 latency should drop within 2 minutes; check Grafana dashboard:
# grafana.internal/d/api-latency
```

### Rollback

```bash
kubectl scale deployment scavenger-backend --replicas=<previous-count> -n scavenger-backend
```

---

## 2. Secret Rotation [AUTOMATED]

**Trigger:** Quarterly rotation schedule, or suspected credential compromise.

**Prerequisites:** AWS IAM access, `aws` CLI, `kubectl`.

### Steps

```bash
# 1. Generate new secrets
NEW_SENDGRID_KEY=$(openssl rand -hex 32)
NEW_CSRF_SECRET=$(openssl rand -hex 32)

# 2. Update AWS Secrets Manager
aws secretsmanager put-secret-value \
  --secret-id scavenger/sendgrid-api-key \
  --secret-string "$NEW_SENDGRID_KEY"

aws secretsmanager put-secret-value \
  --secret-id scavenger/csrf-secret \
  --secret-string "$NEW_CSRF_SECRET"

# 3. Trigger a rolling restart to pick up new secrets
kubectl rollout restart deployment/scavenger-backend -n scavenger-backend

# 4. Watch rollout
kubectl rollout status deployment/scavenger-backend -n scavenger-backend
```

### Verification

```bash
# Check that pods restarted and are healthy
kubectl get pods -n scavenger-backend

# Verify the new key is active by sending a test email via API
curl -X POST https://api.scavenger.io/api/test-email \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Rollback

Re-run steps 1–3 with the previous secret values, which must be stored in a secure credential store before rotation begins.

---

## 3. Database Backup and Restore

**Trigger:** Pre-migration backup, DR drill, or data recovery request.

**Prerequisites:** `psql` access to the RDS instance, S3 write access to `s3://scavenger-backups/`.

### Backup

```bash
# Full logical backup
pg_dump \
  --host="$DB_HOST" \
  --username="$DB_USER" \
  --dbname="scavenger_prod" \
  --format=custom \
  --file="/tmp/scavenger_$(date +%Y%m%d_%H%M%S).dump"

# Upload to S3
aws s3 cp /tmp/scavenger_*.dump s3://scavenger-backups/manual/
```

### Restore (non-prod only — NEVER restore to prod without change approval)

```bash
# Download backup
aws s3 cp s3://scavenger-backups/manual/scavenger_<timestamp>.dump /tmp/restore.dump

# Restore to staging
pg_restore \
  --host="$STAGING_DB_HOST" \
  --username="$DB_USER" \
  --dbname="scavenger_staging" \
  --clean \
  --if-exists \
  /tmp/restore.dump
```

### Verification

```bash
# Row count sanity check
psql -h "$DB_HOST" -U "$DB_USER" -d scavenger_prod \
  -c "SELECT COUNT(*) FROM waste_records;"
```

---

## 4. Contract Upgrade

**Trigger:** New contract version ready for mainnet, approved by security review and multisig.

**Prerequisites:** Admin Stellar account (multisig), `stellar` CLI, new WASM artifact from CI.

### Steps

```bash
# 1. Verify new WASM hash from CI artifact
NEW_WASM=artifacts/scavenger_contract.wasm
EXPECTED_HASH="<hash from CI build>"
ACTUAL_HASH=$(sha256sum "$NEW_WASM" | cut -d' ' -f1)
[ "$ACTUAL_HASH" = "$EXPECTED_HASH" ] || { echo "HASH MISMATCH — ABORT"; exit 1; }

# 2. Upload new WASM to Stellar network
NEW_HASH=$(stellar contract upload \
  --wasm "$NEW_WASM" \
  --source admin-key \
  --network mainnet)

echo "New WASM hash: $NEW_HASH"

# 3. Invoke upgrade (requires multisig — all signers must approve)
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source admin-key \
  --network mainnet \
  -- upgrade \
  --new_wasm_hash "$NEW_HASH"

# 4. Record upgrade in audit log
curl -X POST https://api.scavenger.io/api/audit \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"event\": \"contract_upgrade\", \"new_hash\": \"$NEW_HASH\"}"
```

### Verification

```bash
# Confirm contract now responds to a function added in the new version
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source admin-key \
  --network mainnet \
  -- get_version
```

### Rollback

Soroban contracts can be rolled back by uploading the previous WASM and invoking `upgrade` again with the old hash. The old hash must be retained as a build artifact in CI.

---

## 5. Cache Flush

**Trigger:** Stale data reported in API responses after a hot-fix deployment.

**Prerequisites:** Access to the backend pod.

```bash
# Restart the backend — the in-process cache (300 s TTL) is cleared on startup
kubectl rollout restart deployment/scavenger-backend -n scavenger-backend
kubectl rollout status deployment/scavenger-backend -n scavenger-backend
```

The cache TTL is 300 seconds by default. If stale data is critical, a restart is the fastest flush. Adjust `CACHE_TTL_SECS` in the deployment environment to a lower value if frequent flushes are needed.

---

## 6. Rate Limit Override (Temporary)

**Trigger:** A trusted partner or internal automation is hitting the default 100 req/min limit.

**Prerequisites:** Ability to set environment variables on the backend deployment.

```bash
# Increase limit for all clients (use sparingly — impacts protection)
kubectl set env deployment/scavenger-backend \
  RATE_LIMIT_PER_MINUTE=500 \
  -n scavenger-backend

kubectl rollout status deployment/scavenger-backend -n scavenger-backend
```

**Remember:** Revert the override after the partner operation completes.

```bash
kubectl set env deployment/scavenger-backend \
  RATE_LIMIT_PER_MINUTE=100 \
  -n scavenger-backend
```
