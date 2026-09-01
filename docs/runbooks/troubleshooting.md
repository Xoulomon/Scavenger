# Troubleshooting Guide

Version: 1.0
Last updated: 2026-06-28
Owner: @on-call-team

Use this guide to diagnose symptoms. For active incidents follow [incident-response.md](./incident-response.md) in parallel.

---

## Symptom Index

| Symptom | Section |
|---------|---------|
| HTTP error rate spike | [Error Rate Spike](#1-error-rate-spike) |
| High API latency | [Latency Spike](#2-latency-spike) |
| WebSocket connections dropping | [WebSocket Issues](#3-websocket-issues) |
| Contract calls failing | [Contract Call Failures](#4-contract-call-failures) |
| Export jobs hanging | [Export Timeouts](#5-export-timeouts) |
| Email delivery failures | [Email Failures](#6-email-failures) |
| Rate limit errors from legitimate traffic | [False Rate Limit Triggers](#7-false-rate-limit-triggers) |
| CSRF errors in browser | [CSRF Errors](#8-csrf-errors) |
| Pod crash-looping | [Pod Crash Loop](#9-pod-crash-loop) |
| Missing audit logs | [Missing Audit Logs](#10-missing-audit-logs) |

---

## 1. Error Rate Spike

**Signals:** Grafana alert `HighErrorRate`, 5xx responses > 5 % of traffic.

### Step 1 — Identify error distribution

```bash
# Check recent error codes in structured logs
kubectl logs -l app=scavenger-backend -n scavenger-backend --since=5m \
  | jq 'select(.status >= 500) | {code: .error_code, path: .path}' \
  | sort | uniq -c | sort -rn | head -20
```

### Step 2 — Check for upstream dependency failures

```bash
# Stellar network status
curl -s https://horizon-testnet.stellar.org/ | jq '.network'

# S3 connectivity
aws s3 ls s3://scavenger-prod/ --region us-east-1

# Database connectivity
psql -h "$DB_HOST" -U "$DB_USER" -d scavenger_prod -c "SELECT 1;"
```

### Step 3 — Correlate with recent deploys

```bash
kubectl rollout history deployment/scavenger-backend -n scavenger-backend
```

If a recent deploy correlates with the spike, trigger [Rollback](./deployment.md#rollback).

### Resolution paths

| Root cause | Action |
|-----------|--------|
| Stellar network outage | Wait for network recovery; errors will self-resolve |
| Database unreachable | See [Pod Crash Loop](#9-pod-crash-loop) for DB connection exhaustion |
| Bad deploy | Rollback — see [deployment.md](./deployment.md) |
| Bug in request handling | Hotfix deploy after reproducing locally |

---

## 2. Latency Spike

**Signals:** P95 latency > 2 s on `/api/contracts/*`, Grafana alert `HighLatency`.

### Step 1 — Identify slow endpoints

```bash
kubectl logs -l app=scavenger-backend -n scavenger-backend --since=10m \
  | jq 'select(.duration_ms > 2000) | {path: .path, duration_ms: .duration_ms}' \
  | sort -t: -k2 -rn | head -20
```

### Step 2 — Check resource pressure

```bash
kubectl top pods -n scavenger-backend
kubectl top nodes
```

If CPU > 80 %: scale up replicas (see [common-procedures.md](./common-procedures.md#1-horizontal-scaling)).

### Step 3 — Check cache hit rate

```bash
kubectl logs -l app=scavenger-backend -n scavenger-backend --since=5m \
  | jq 'select(.cache_hit != null) | .cache_hit' \
  | sort | uniq -c
```

A sudden drop in cache hits (e.g. after a restart) causes a thundering-herd effect on the database. Wait 5 minutes for the cache to warm.

### Step 4 — Check Stellar RPC latency

```bash
time stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source dev-key \
  --network mainnet \
  -- get_version
```

If > 3 s, the Stellar RPC node is slow. Check status.stellar.org and consider switching to a backup RPC endpoint via `STELLAR_RPC_URL` env var.

---

## 3. WebSocket Issues

**Signals:** Frontend shows "Connection lost" repeatedly; WS connections not appearing in logs.

### Step 1 — Count active connections

```bash
kubectl logs -l app=scavenger-backend -n scavenger-backend --since=5m \
  | jq 'select(.event == "ws_connected" or .event == "ws_disconnected")' \
  | jq -s 'group_by(.event) | map({(.[0].event): length}) | add'
```

### Step 2 — Check load balancer timeout

WebSocket connections require long-lived TCP sessions. Verify the ALB idle timeout:

```bash
aws elbv2 describe-load-balancer-attributes \
  --load-balancer-arn "$ALB_ARN" \
  | jq '.Attributes[] | select(.Key == "idle_timeout.timeout_seconds")'
```

The value must be > 60 s (default). Set it to 300:

```bash
aws elbv2 modify-load-balancer-attributes \
  --load-balancer-arn "$ALB_ARN" \
  --attributes Key=idle_timeout.timeout_seconds,Value=300
```

### Step 3 — Check for CORS / upgrade header issues

```bash
curl -v -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: $(openssl rand -base64 16)" \
  -H "Sec-WebSocket-Version: 13" \
  https://api.scavenger.io/ws 2>&1 | head -30
```

Expected: `HTTP/1.1 101 Switching Protocols`.

---

## 4. Contract Call Failures

**Signals:** `contract.call_failed` errors in API logs; blockchain transactions failing.

### Step 1 — Check Stellar network

```bash
curl -s https://horizon.stellar.org/ledgers?order=desc&limit=1 \
  | jq '{sequence: .._embedded.records[0].sequence, closed_at: .._embedded.records[0].closed_at}'
```

If no new ledgers in > 30 s, the network is stalled. Wait and monitor.

### Step 2 — Check account balance

```bash
stellar account balances \
  --account "$(soroban keys address admin-key)" \
  --network mainnet
```

The admin account needs XLM for fees. Minimum safe balance: 5 XLM above base reserve.

### Step 3 — Decode transaction result

```bash
# Get the failed transaction hash from the API logs
TX_HASH="<hash from log>"

curl -s "https://horizon.stellar.org/transactions/$TX_HASH" \
  | jq '.result_xdr' \
  | xargs stellar tx result
```

Map the result code to a `ContractError` variant using [docs/ERROR_CODES.md](../ERROR_CODES.md).

---

## 5. Export Timeouts

**Signals:** `/api/export` returns 500 or hangs beyond 30 s; `export.pdf_error` in logs.

### Step 1 — Check export service logs

```bash
kubectl logs -l app=scavenger-backend -n scavenger-backend --since=10m \
  | jq 'select(.service == "export")'
```

### Step 2 — Check available disk

```bash
kubectl exec -it \
  $(kubectl get pod -l app=scavenger-backend -n scavenger-backend -o name | head -1) \
  -n scavenger-backend \
  -- df -h /tmp
```

Large PDF exports write to `/tmp`. If disk is full, clear old export files:

```bash
kubectl exec -it <pod-name> -n scavenger-backend -- find /tmp -name "*.pdf" -mmin +60 -delete
```

### Step 3 — Verify S3 upload path

```bash
aws s3 ls s3://scavenger-exports/ --region us-east-1
```

If missing, the S3 bucket may be unreachable. Check IAM role and bucket policy.

---

## 6. Email Failures

**Signals:** `email.delivery_failed` errors; users not receiving transactional emails.

### Step 1 — Check SendGrid status

Visit https://status.sendgrid.com. If degraded, wait for recovery.

### Step 2 — Verify API key

```bash
curl -X GET https://api.sendgrid.com/v3/user/profile \
  -H "Authorization: Bearer $SENDGRID_API_KEY"
```

HTTP 401 → key is invalid or rotated. Rotate using [common-procedures.md](./common-procedures.md#2-secret-rotation-automated).

### Step 3 — Check suppression list

```bash
curl -X GET "https://api.sendgrid.com/v3/suppression/bounces" \
  -H "Authorization: Bearer $SENDGRID_API_KEY" \
  | jq '.[].email'
```

Remove a recipient from the bounce list if they are legitimate:

```bash
curl -X DELETE "https://api.sendgrid.com/v3/suppression/bounces/user@example.com" \
  -H "Authorization: Bearer $SENDGRID_API_KEY"
```

---

## 7. False Rate Limit Triggers

**Signals:** Legitimate users receiving `rate_limit.exceeded` (HTTP 429).

### Step 1 — Identify affected IP

```bash
kubectl logs -l app=scavenger-backend -n scavenger-backend --since=10m \
  | jq 'select(.error_code == "rate_limit.exceeded") | .remote_addr' \
  | sort | uniq -c | sort -rn | head -10
```

### Step 2 — Check if IP is behind NAT

Multiple users sharing a corporate NAT appear as a single IP. If confirmed, increase the limit or add IP to the allowlist via the `RATE_LIMIT_ALLOWLIST` env var (comma-separated CIDRs).

### Step 3 — Temporary override

See [common-procedures.md — Rate Limit Override](./common-procedures.md#6-rate-limit-override-temporary).

---

## 8. CSRF Errors

**Signals:** Browser receives HTTP 403 with `auth.csrf_mismatch`; mutations failing.

### Step 1 — Confirm CSRF header is sent

Open browser devtools → Network → select failing request → Headers. Verify `X-CSRF-Token` is present.

### Step 2 — Check token freshness

CSRF tokens expire with the session. If the user has had the page open for a long time, instruct them to reload.

### Step 3 — Check CORS configuration

```bash
kubectl get deployment scavenger-backend -n scavenger-backend -o yaml \
  | grep ALLOWED_ORIGINS
```

The `ALLOWED_ORIGINS` env var must include the exact origin of the frontend (protocol + hostname + port).

---

## 9. Pod Crash Loop

**Signals:** `kubectl get pods` shows `CrashLoopBackOff`.

```bash
# Get crash reason
kubectl describe pod <pod-name> -n scavenger-backend | grep -A 5 "Last State"

# Get last startup logs
kubectl logs <pod-name> -n scavenger-backend --previous
```

Common causes:

| Log message | Action |
|------------|--------|
| `connection refused` to DB | Check RDS security group allows pod CIDR |
| `SENDGRID_API_KEY not set` | Add missing env var to deployment |
| `address already in use :8080` | Another process; restart the node |
| `SIGSEGV` / `signal 11` | Likely OOM — increase memory limit |

---

## 10. Missing Audit Logs

**Signals:** Audit dashboard shows gaps; compliance team reports missing entries.

### Step 1 — Check audit service logs

```bash
kubectl logs -l app=scavenger-backend -n scavenger-backend --since=1h \
  | jq 'select(.service == "audit")'
```

### Step 2 — Verify audit service is not rate-limited

The audit service writes to an internal buffer. If the buffer fills (high-throughput periods), entries may be dropped. Increase `AUDIT_BUFFER_SIZE` env var.

### Step 3 — Check for database write errors

```bash
kubectl logs -l app=scavenger-backend -n scavenger-backend --since=1h \
  | jq 'select(.error_code != null and .service == "audit")'
```

If database errors, the database may have run out of connections. Check the connection pool:

```bash
psql -h "$DB_HOST" -U "$DB_USER" -d scavenger_prod \
  -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"
```
