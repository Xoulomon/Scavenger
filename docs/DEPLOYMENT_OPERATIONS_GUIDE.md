# Deployment & Operations Guide

Comprehensive guide for deploying and operating Scavngr across all environments.

---

## Table of Contents

1. [Testnet Deployment](#testnet-deployment)
2. [Mainnet Deployment](#mainnet-deployment)
3. [Deployment Checklist](#deployment-checklist)
4. [Monitoring Guide](#monitoring-guide)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Upgrade Procedures](#upgrade-procedures)
7. [Disaster Recovery Guide](#disaster-recovery-guide)
8. [Capacity Planning Guide](#capacity-planning-guide)
9. [Operations Runbooks](#operations-runbooks)

---

## Testnet Deployment

### Prerequisites

| Requirement   | Version | Install                                                           |
| ------------- | ------- | ----------------------------------------------------------------- |
| Rust          | 1.70+   | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32 target | —       | `rustup target add wasm32-unknown-unknown`                        |
| Soroban CLI   | latest  | `cargo install --locked soroban-cli`                              |
| Node.js       | 18+     | https://nodejs.org                                                |
| Docker        | 24+     | https://docker.com                                                |

### Step 1 — Generate and Fund a Keypair

```bash
# Generate a testnet deployer key
soroban keys generate testnet-deployer --network testnet

# Check address
soroban keys address testnet-deployer

# Fund via Friendbot
curl "https://friendbot.stellar.org?addr=$(soroban keys address testnet-deployer)"

# Confirm balance
curl "https://horizon-testnet.stellar.org/accounts/$(soroban keys address testnet-deployer)" \
  | jq '.balances[] | select(.asset_type=="native") | .balance'
```

### Step 2 — Build the Contract

```bash
cd stellar-contract

# Build WASM
cargo build --target wasm32-unknown-unknown --release

# Optimise (reduces fees)
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm

# Verify output
ls -lh target/wasm32-unknown-unknown/release/*.optimized.wasm
```

### Step 3 — Deploy to Testnet

```bash
CONTRACT_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source testnet-deployer \
  --network testnet)

echo "Contract deployed: $CONTRACT_ID"
echo "CONTRACT_ID=$CONTRACT_ID" >> ../.env
```

### Step 4 — Initialise the Contract

```bash
# Initialise admin
soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source testnet-deployer \
  --network testnet \
  -- initialize_admin \
  --admin "$(soroban keys address testnet-deployer)"
```

### Step 5 — Configure the Frontend

```bash
cd ../frontend
cp .env.example .env

# Update .env
cat > .env << EOF
VITE_CONTRACT_ID=$CONTRACT_ID
VITE_NETWORK=TESTNET
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_FIREBASE_API_KEY=<your-key>
VITE_FIREBASE_AUTH_DOMAIN=<your-domain>
VITE_FIREBASE_PROJECT_ID=<your-project>
VITE_FIREBASE_STORAGE_BUCKET=<your-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
VITE_FIREBASE_APP_ID=<your-app-id>
VITE_FIREBASE_MEASUREMENT_ID=<your-measurement-id>
EOF

npm install
npm run build
```

### Step 6 — Verify Deployment

```bash
# Check contract exists
soroban contract info --id "$CONTRACT_ID" --network testnet

# Test participant registration
soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source testnet-deployer \
  --network testnet \
  -- register_participant \
  --address "$(soroban keys address testnet-deployer)" \
  --role 0 \
  --name "Test Recycler" \
  --latitude 52520000 \
  --longitude 13405000

# Check global metrics
soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source testnet-deployer \
  --network testnet \
  -- get_metrics
```

---

## Mainnet Deployment

> ⚠️ **Complete testnet validation before mainnet deployment.**

### Additional Prerequisites

- [ ] All tests passing on testnet for at least 72 hours
- [ ] Security audit completed and findings resolved
- [ ] Multi-signature admin setup configured
- [ ] Disaster recovery plan tested
- [ ] Rollback procedure rehearsed
- [ ] Team trained on emergency procedures

### Step 1 — Prepare Mainnet Account

```bash
# Generate mainnet deployer (store secret in vault)
soroban keys generate mainnet-deployer

# Fund account (transfer XLM from exchange)
# Minimum recommended: 100 XLM for deployment + operations buffer
```

### Step 2 — Build and Optimise

```bash
# Build in release mode with full optimisation
cd stellar-contract
cargo build --target wasm32-unknown-unknown --release
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm

# Verify WASM hash matches expected (from CI artifact)
sha256sum target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm
```

### Step 3 — Deploy to Mainnet

```bash
MAINNET_CONTRACT_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source mainnet-deployer \
  --network public)

echo "Mainnet Contract: $MAINNET_CONTRACT_ID"
```

### Step 4 — Verify and Monitor

```bash
# Verify contract
soroban contract info --id "$MAINNET_CONTRACT_ID" --network public

# Monitor initial transactions in Stellar Expert
echo "https://stellar.expert/explorer/public/contract/$MAINNET_CONTRACT_ID"
```

---

## Deployment Checklist

### Pre-Deployment (T-24h)

- [ ] All unit and integration tests passing (`cargo test`)
- [ ] Frontend builds without errors (`npm run build`)
- [ ] WASM optimised and hash recorded
- [ ] Environment variables configured for target network
- [ ] Monitoring dashboards ready
- [ ] On-call rotation confirmed
- [ ] Rollback procedure documented

### Deployment (T-0)

- [ ] Announce maintenance window to users
- [ ] Deploy contract and record contract ID
- [ ] Initialise contract (admin, token address)
- [ ] Update frontend environment variables
- [ ] Deploy frontend to CDN/hosting
- [ ] Verify contract ID in frontend is correct
- [ ] Run smoke test (register, submit waste, get metrics)

### Post-Deployment (T+1h)

- [ ] All smoke tests passing
- [ ] No error spikes in logs
- [ ] Response times within SLA (< 2s p95)
- [ ] Contract events emitting correctly
- [ ] Notify stakeholders of successful deployment

---

## Monitoring Guide

### Key Metrics to Watch

| Metric                           | Source                   | Alert Threshold         |
| -------------------------------- | ------------------------ | ----------------------- |
| Contract invocation success rate | Stellar Horizon          | < 99%                   |
| RPC endpoint latency             | Prometheus               | > 2 000 ms p95          |
| Frontend error rate              | Browser console / Sentry | > 1%                    |
| Active participants              | Contract `get_metrics()` | Drop > 20% in 1h        |
| Total waste submitted            | Contract `get_metrics()` | No new submissions > 4h |

### Prometheus Setup

```bash
# Start monitoring stack
docker compose -f docker-compose.monitoring.yml up -d

# Access dashboards
# Grafana:    http://localhost:3000 (admin / admin)
# Prometheus: http://localhost:9090
# Alertmanager: http://localhost:9093
```

### Useful Monitoring Queries

```promql
# Contract call success rate (last 5 minutes)
rate(stellar_contract_calls_total{status="success"}[5m])
  / rate(stellar_contract_calls_total[5m])

# RPC latency p95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job="rpc"}[5m]))

# Active indexer lag (seconds behind chain)
indexer_ledger_lag_seconds
```

### Alert Configuration

```yaml
# config/prometheus-rules.yml
groups:
  - name: scavngr
    rules:
      - alert: HighContractErrorRate
        expr: |
          rate(stellar_contract_errors_total[5m]) > 0.01
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: Contract error rate above 1%

      - alert: IndexerLag
        expr: indexer_ledger_lag_seconds > 60
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: Indexer is more than 60 seconds behind chain
```

---

## Troubleshooting Guide

### Contract Issues

| Symptom                          | Likely Cause                    | Resolution                                         |
| -------------------------------- | ------------------------------- | -------------------------------------------------- |
| "insufficient balance" on deploy | Account XLM too low             | Fund account; minimum 20 XLM for fees              |
| "contract not found"             | Wrong network or contract ID    | Verify `VITE_CONTRACT_ID` matches deployed network |
| Transaction stuck pending        | Network congestion              | Retry with higher fee: `--fee 1000`                |
| "already initialized"            | `initialize_admin` called twice | Contract is already set up — skip init             |

### Frontend Issues

| Symptom                              | Likely Cause          | Resolution                                      |
| ------------------------------------ | --------------------- | ----------------------------------------------- |
| "Wallet not connected" after refresh | Session not persisted | Reconnect wallet; check `localStorage`          |
| CORS errors in console               | RPC URL mismatch      | Verify `VITE_RPC_URL` is correct and accessible |
| Contract calls timeout               | Slow RPC endpoint     | Try alternative RPC; increase timeout           |
| Firebase auth fails                  | Missing env vars      | Check all `VITE_FIREBASE_*` are set             |

### Debug Commands

```bash
# Check account balance
curl "https://horizon-testnet.stellar.org/accounts/G..." | jq '.balances'

# Inspect contract state
soroban contract read --id "$CONTRACT_ID" --network testnet

# Check transaction details
curl "https://horizon-testnet.stellar.org/transactions/<hash>" | jq '.result_xdr'

# Verify RPC connectivity
curl -X POST "$VITE_RPC_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

---

## Upgrade Procedures

### Contract Upgrade Flow

Soroban contracts are immutable — "upgrades" deploy a new contract and migrate users.

```bash
# 1. Deploy new contract version
NEW_CONTRACT_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source deployer \
  --network testnet)

# 2. Run migration script (if needed)
node scripts/migrate.js \
  --old-contract "$OLD_CONTRACT_ID" \
  --new-contract "$NEW_CONTRACT_ID" \
  --network testnet

# 3. Update frontend to point to new contract
# Update VITE_CONTRACT_ID in .env and redeploy frontend

# 4. Monitor both contracts for 24h
# (Keep old contract live for users still on old frontend)
```

### Rollback Procedure

```bash
# Rollback = repoint frontend to previous contract ID
# Previous contract is never deleted (immutable)

# 1. Identify previous stable contract ID
cat .env.backup | grep CONTRACT_ID

# 2. Update frontend
sed -i "s/VITE_CONTRACT_ID=.*/VITE_CONTRACT_ID=$PREVIOUS_ID/" .env
npm run build && npm run deploy

# 3. Notify users of rollback
# 4. Post-mortem within 48h
```

---

## Disaster Recovery Guide

### Scenarios and Responses

#### Scenario 1: RPC endpoint down

```
Impact: All contract interactions fail
Response time: < 15 minutes
Steps:
1. Switch to backup RPC (update VITE_RPC_URL)
2. Redeploy frontend with new RPC URL
3. Monitor for 30 minutes
4. File incident report
```

#### Scenario 2: Frontend CDN outage

```
Impact: Users cannot access platform
Response time: < 30 minutes
Steps:
1. Deploy to backup CDN / self-hosted fallback
2. Update DNS to point to backup
3. Monitor resolution
4. Notify users via social media
```

#### Scenario 3: Admin key compromised

```
Impact: Unauthorized admin actions possible
Response time: IMMEDIATE
Steps:
1. Transfer admin to new secure key:
   soroban contract invoke --id $CONTRACT_ID \
     -- transfer_admin \
     --current_admin OLD_ADMIN \
     --new_admins [NEW_ADMIN]
2. Revoke old key from all systems
3. Audit all transactions from old key
4. Reset all API keys and secrets
5. Security incident report within 24h
```

### Recovery Time Objectives

| Incident            | RTO     | RPO                |
| ------------------- | ------- | ------------------ |
| Frontend outage     | 30 min  | N/A (no data loss) |
| RPC outage          | 15 min  | N/A                |
| Indexer crash       | 1 hour  | Last ledger sync   |
| Database corruption | 4 hours | Last backup        |

### Backup Verification

```bash
# Run weekly backup test
./scripts/verify-backup-restore.sh --network testnet

# Expected output:
# ✓ Database snapshot restored
# ✓ Indexer re-synced from snapshot
# ✓ Contract state matches
```

---

## Capacity Planning Guide

### Current Limits

| Resource         | Limit                                 | Notes                         |
| ---------------- | ------------------------------------- | ----------------------------- |
| Contract storage | ~64 KB instance, unlimited persistent | Cost scales with storage used |
| WASM size        | 64 KB optimised                       | Currently ~45 KB              |
| Batch size       | 25 participants / tx                  | Hard limit in contract        |
| RPC calls/second | ~100 (shared testnet)                 | Dedicated node for mainnet    |

### Scaling Triggers

| Metric                          | Action                            |
| ------------------------------- | --------------------------------- |
| > 1 000 active participants/day | Add dedicated RPC node            |
| > 10 000 waste submissions/day  | Optimise indexer query patterns   |
| > 5 MB/day indexer DB growth    | Review data retention policy      |
| p95 RPC latency > 1 500 ms      | Scale horizontally or cache layer |

---

## Operations Runbooks

### Runbook: Daily Health Check

```bash
#!/bin/bash
# Run every morning before peak hours

# 1. Check contract metrics
soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source readonly-key \
  --network testnet \
  -- get_metrics | jq .

# 2. Check indexer sync status
curl http://localhost:3001/health | jq .

# 3. Check error rate (last 24h)
curl -G "http://localhost:9090/api/v1/query" \
  --data-urlencode 'query=increase(stellar_contract_errors_total[24h])'

# 4. Verify RPC latency
curl -w "@curl-format.txt" -o /dev/null -s "$VITE_RPC_URL"
```

### Runbook: Emergency Pause

```bash
# Pause all contract operations (admin only)
soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source admin-key \
  --network testnet \
  -- pause \
  --admin "$(soroban keys address admin-key)"

# Verify paused
soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source admin-key \
  --network testnet \
  -- is_paused

# Notify users via status page
echo "Platform paused at $(date -u)" >> ops-log.txt
```

### Runbook: Resume After Pause

```bash
# Resume operations
soroban contract invoke \
  --id "$CONTRACT_ID" \
  --source admin-key \
  --network testnet \
  -- unpause \
  --admin "$(soroban keys address admin-key)"

# Smoke test
# ... (register, submit, verify basics)
echo "Platform resumed at $(date -u)" >> ops-log.txt
```

---

_Last updated: June 2026 | Maintained by: Scavngr Core Team_
