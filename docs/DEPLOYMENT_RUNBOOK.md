# Scavngr — Deployment Runbook

> **Issue:** #535
> **Category:** Operations
> **Audience:** DevOps engineers and release managers
> **Last Updated:** 2026-05-26

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Environment Overview](#environment-overview)
3. [Testnet Deployment](#testnet-deployment)
4. [Mainnet Deployment](#mainnet-deployment)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring & Alerting](#monitoring--alerting)
8. [Troubleshooting Deployment Issues](#troubleshooting-deployment-issues)

---

## Pre-Deployment Checklist

Complete **all** items before proceeding to either testnet or mainnet.

### Code Quality

- [ ] All CI checks passing on `main` branch (Rust fmt, Clippy, tests, WASM build)
- [ ] Frontend CI passing (ESLint 0 warnings, Prettier, TypeScript, build)
- [ ] All contract unit tests passing: `cargo test`
- [ ] Integration tests passing: `cargo test --test integration_test`
- [ ] Security audit passing: `cargo audit`
- [ ] Test coverage ≥ 80 % for critical paths (participant, waste, incentive, rewards)

### Build Artifacts

- [ ] Contract compiled to WASM: `cargo build --target wasm32-unknown-unknown --release`
- [ ] WASM optimized: `soroban contract optimize --wasm <path>`
- [ ] WASM size verified (< 50 KB for gas efficiency)
- [ ] Frontend production build succeeds: `npm run build`

### Configuration

- [ ] Environment variables reviewed and updated for target network
- [ ] Secrets rotated (never reuse testnet keys on mainnet)
- [ ] Token contract address confirmed for target network
- [ ] Charity contract address confirmed (if applicable)
- [ ] Reward percentages agreed upon: collector %, owner %
- [ ] Gas/fee budget allocated for deployment transaction

### Communication

- [ ] Deployment window communicated to team (UTC time)
- [ ] On-call engineer assigned
- [ ] Rollback plan reviewed and rehearsed (testnet only required for mainnet)
- [ ] Monitoring dashboards pre-opened

---

## Environment Overview

| Environment | Stellar Network | RPC URL | Horizon URL |
|-------------|----------------|---------|-------------|
| Local | Standalone | `http://localhost:8000/soroban/rpc` | `http://localhost:8000` |
| Testnet | Test SDF Network | `https://soroban-testnet.stellar.org` | `https://horizon-testnet.stellar.org` |
| Mainnet | Public Global Stellar Network | `https://soroban-mainnet.stellar.org` | `https://horizon.stellar.org` |

---

## Testnet Deployment

### Step 0 — Tool Setup (first time)

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Add WASM target
rustup target add wasm32-unknown-unknown

# Install Soroban CLI
cargo install --locked soroban-cli --features opt

# Register testnet in Soroban CLI
soroban network add \
  --global testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

### Step 1 — Generate & Fund Deployer Account

```bash
# Generate keypair (stores in ~/.config/soroban/identity/)
soroban keys generate testnet-deployer --network testnet

# Print the address
echo "Deployer address: $(soroban keys address testnet-deployer)"

# Fund via Friendbot
curl "https://friendbot.stellar.org?addr=$(soroban keys address testnet-deployer)"

# Verify balance
curl "https://horizon-testnet.stellar.org/accounts/$(soroban keys address testnet-deployer)" \
  | jq '.balances[] | select(.asset_type == "native") | .balance'
# Expected: ≥ 10000 XLM
```

### Step 2 — Build & Optimize Contract

```bash
cd stellar-contract

# Build for WASM
cargo build --target wasm32-unknown-unknown --release 2>&1 | tee build.log

# Verify binary exists
ls -lh target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm

# Optimize (reduces size and gas cost)
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm

# Verify optimized binary
ls -lh target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm
```

### Step 3 — Deploy Contract

```bash
# Deploy to testnet
CONTRACT_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source testnet-deployer \
  --network testnet \
  --fee 1000000)

echo "Contract ID: $CONTRACT_ID"

# ⚠️  SAVE THIS VALUE — required for all subsequent interactions
echo "export CONTRACT_ID=$CONTRACT_ID" >> ~/.bashrc
```

### Step 4 — Initialize Admin

```bash
# Initialize admin (can only be called ONCE)
soroban contract invoke \
  --id $CONTRACT_ID \
  --source testnet-deployer \
  --network testnet \
  -- initialize_admin \
  --admin $(soroban keys address testnet-deployer)

# Verify
soroban contract invoke \
  --id $CONTRACT_ID \
  --source testnet-deployer \
  --network testnet \
  -- get_admin
```

### Step 5 — Configure Contract

```bash
# 5a. Set reward token address (SEP-41 token contract)
soroban contract invoke \
  --id $CONTRACT_ID \
  --source testnet-deployer \
  --network testnet \
  -- set_token_address \
  --admin $(soroban keys address testnet-deployer) \
  --token_address <SEP41_TOKEN_CONTRACT_ID>

# 5b. Set charity contract address (optional)
soroban contract invoke \
  --id $CONTRACT_ID \
  --source testnet-deployer \
  --network testnet \
  -- set_charity_contract \
  --admin $(soroban keys address testnet-deployer) \
  --charity_address <CHARITY_CONTRACT_ID>

# 5c. Set reward percentages (collector%, owner%)
soroban contract invoke \
  --id $CONTRACT_ID \
  --source testnet-deployer \
  --network testnet \
  -- set_percentages \
  --admin $(soroban keys address testnet-deployer) \
  --collector_percentage 5 \
  --owner_percentage 50
```

### Step 6 — Configure Frontend (.env)

```bash
# Copy template
cp frontend/.env.example frontend/.env

# Edit values
cat > frontend/.env << EOF
VITE_CONTRACT_ID=$CONTRACT_ID
VITE_NETWORK=TESTNET
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_FIREBASE_API_KEY=<your-key>
VITE_FIREBASE_AUTH_DOMAIN=<your-domain>
VITE_FIREBASE_PROJECT_ID=<your-project>
VITE_FIREBASE_STORAGE_BUCKET=<your-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<your-id>
VITE_FIREBASE_APP_ID=<your-app-id>
VITE_FIREBASE_MEASUREMENT_ID=<your-measurement-id>
EOF
```

### Step 7 — Configure Indexer (.env)

```bash
cp indexer/.env.example indexer/.env

cat >> indexer/.env << EOF
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
CONTRACT_ID=$CONTRACT_ID
DATABASE_URL=postgresql://user:pass@localhost:5432/scavngr_testnet
REDIS_URL=redis://localhost:6379
EOF
```

### Step 8 — Start Services

```bash
# Start all services via Docker Compose
docker-compose up -d

# Verify all containers are running
docker-compose ps

# Check logs for errors
docker-compose logs -f --tail=50

# Start frontend dev server
cd frontend && npm install && npm run dev
```

### Step 9 — Smoke Tests

```bash
# Run automated smoke tests
cd integration-tests
npm test -- --network testnet --contract $CONTRACT_ID

# Manual: register a test participant
soroban contract invoke \
  --id $CONTRACT_ID \
  --source testnet-deployer \
  --network testnet \
  -- register_participant \
  --address $(soroban keys address testnet-deployer) \
  --role 0 \
  --name test_recycler \
  --latitude 52520000 \
  --longitude 13405000

# Manual: verify metrics
soroban contract invoke \
  --id $CONTRACT_ID \
  --source testnet-deployer \
  --network testnet \
  -- get_metrics
```

---

## Mainnet Deployment

> ⚠️ **CRITICAL:** Mainnet deployments are irreversible. The contract cannot be deleted. Complete all testnet testing before proceeding.

### Additional Pre-Mainnet Requirements

- [ ] Minimum 2 weeks of testnet testing with real user scenarios
- [ ] External security audit completed and all critical/high findings resolved
- [ ] Multi-sig admin setup planned (recommend ≥ 3 admins)
- [ ] Emergency pause procedure tested on testnet
- [ ] Token contract audited and deployed on mainnet
- [ ] On-chain multi-sig proposal flow tested
- [ ] Legal / compliance review completed (if applicable)
- [ ] Community announcement published

### Step 0 — Mainnet Tool Setup

```bash
# Register mainnet in Soroban CLI
soroban network add \
  --global mainnet \
  --rpc-url https://soroban-mainnet.stellar.org \
  --network-passphrase "Public Global Stellar Network ; September 2015"
```

### Step 1 — Generate & Fund Mainnet Deployer

```bash
# Generate mainnet keypair (NEVER reuse testnet keys)
soroban keys generate mainnet-deployer

echo "Mainnet deployer: $(soroban keys address mainnet-deployer)"

# ⚠️  Fund from a secure source — Friendbot does NOT work on mainnet
# Transfer XLM from your exchange or existing account
# Minimum required: ~100 XLM (1 XLM reserve + deployment fee)
```

### Step 2 — Build & Audit Artifact

```bash
cd stellar-contract

# Ensure clean build from latest main
git fetch origin && git checkout main && git pull

# Full clean build
cargo clean
cargo build --target wasm32-unknown-unknown --release

# Record SHA256 of WASM (for audit trail)
sha256sum target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm \
  | tee wasm-sha256.txt

# Optimize
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm

sha256sum target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  | tee wasm-optimized-sha256.txt
```

### Step 3 — Deploy to Mainnet

```bash
# REVIEW ONCE MORE before running
cat wasm-optimized-sha256.txt

# Deploy (this costs real XLM — ensure deployer is funded)
CONTRACT_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source mainnet-deployer \
  --network mainnet \
  --fee 10000000)

echo "✅ Mainnet Contract ID: $CONTRACT_ID"

# Record in ops log
echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') DEPLOY mainnet CONTRACT=$CONTRACT_ID" >> ops.log
```

### Step 4 — Initialize Multi-Sig Admin

```bash
# Initialize primary admin
soroban contract invoke \
  --id $CONTRACT_ID \
  --source mainnet-deployer \
  --network mainnet \
  -- initialize_admin \
  --admin $(soroban keys address mainnet-deployer)

# Add secondary admins (requires each to have a mainnet account)
soroban contract invoke \
  --id $CONTRACT_ID \
  --source mainnet-deployer \
  --network mainnet \
  -- add_admin \
  --current_admin $(soroban keys address mainnet-deployer) \
  --new_admin <ADMIN_2_ADDRESS>

soroban contract invoke \
  --id $CONTRACT_ID \
  --source mainnet-deployer \
  --network mainnet \
  -- add_admin \
  --current_admin $(soroban keys address mainnet-deployer) \
  --new_admin <ADMIN_3_ADDRESS>

# Verify admin list
soroban contract invoke \
  --id $CONTRACT_ID \
  --source mainnet-deployer \
  --network mainnet \
  -- get_admins
```

### Step 5 — Configure Mainnet Contract

```bash
# Token address (deployed SEP-41 mainnet contract)
soroban contract invoke \
  --id $CONTRACT_ID \
  --source mainnet-deployer \
  --network mainnet \
  -- set_token_address \
  --admin $(soroban keys address mainnet-deployer) \
  --token_address <MAINNET_TOKEN_CONTRACT_ID>

# Charity address
soroban contract invoke \
  --id $CONTRACT_ID \
  --source mainnet-deployer \
  --network mainnet \
  -- set_charity_contract \
  --admin $(soroban keys address mainnet-deployer) \
  --charity_address <MAINNET_CHARITY_CONTRACT_ID>

# Set percentages
soroban contract invoke \
  --id $CONTRACT_ID \
  --source mainnet-deployer \
  --network mainnet \
  -- set_percentages \
  --admin $(soroban keys address mainnet-deployer) \
  --collector_percentage 5 \
  --owner_percentage 50
```

### Step 6 — Configure Production Services

```bash
# Frontend production build
cat > frontend/.env.production << EOF
VITE_CONTRACT_ID=$CONTRACT_ID
VITE_NETWORK=MAINNET
VITE_RPC_URL=https://soroban-mainnet.stellar.org
# ... Firebase prod keys
EOF

cd frontend && npm run build

# Indexer production config
cat >> indexer/.env.production << EOF
STELLAR_RPC_URL=https://soroban-mainnet.stellar.org
NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
CONTRACT_ID=$CONTRACT_ID
DATABASE_URL=<production-db-url>
REDIS_URL=<production-redis-url>
EOF
```

### Step 7 — Production Services Deployment

```bash
# Deploy via Kubernetes (if using k8s)
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/deployments/
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress.yaml

# Or via Docker Compose (staging/smaller deploys)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify all pods/containers healthy
kubectl get pods -n scavngr
# or
docker-compose ps
```

---

## Post-Deployment Verification

Run after **every** deployment (testnet and mainnet).

### Contract Verification

```bash
# 1. Verify contract info
soroban contract info \
  --id $CONTRACT_ID \
  --network $NETWORK

# 2. Check admin is set
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network $NETWORK \
  -- get_admin

# 3. Verify token address
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network $NETWORK \
  -- get_token_address

# 4. Check percentages
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network $NETWORK \
  -- get_collector_percentage

soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network $NETWORK \
  -- get_owner_percentage

# 5. Verify metrics return successfully
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network $NETWORK \
  -- get_metrics
```

### Service Health Checks

```bash
# Backend health endpoint
curl -sf http://localhost:8080/health || echo "❌ Backend unhealthy"

# Indexer health
curl -sf http://localhost:3001/health || echo "❌ Indexer unhealthy"

# Frontend reachable
curl -sf http://localhost:5173/ || echo "❌ Frontend unreachable"

# Database connection
docker exec scavngr-db psql -U scavngr -c "SELECT 1" || echo "❌ DB unreachable"

# Redis ping
docker exec scavngr-redis redis-cli ping || echo "❌ Redis unreachable"
```

### End-to-End Smoke Test

```bash
# Register a test participant and verify the full cycle
PARTICIPANT=$(soroban keys address testnet-deployer)

# Register
soroban contract invoke --id $CONTRACT_ID --source testnet-deployer \
  --network $NETWORK \
  -- register_participant \
  --address $PARTICIPANT --role 0 --name smoke_test \
  --latitude 0 --longitude 0

# Submit waste
WASTE_ID=$(soroban contract invoke --id $CONTRACT_ID --source testnet-deployer \
  --network $NETWORK \
  -- recycle_waste \
  --waste_type '{"Plastic": {}}' --weight 1000 \
  --recycler $PARTICIPANT --latitude 0 --longitude 0)

echo "Waste ID: $WASTE_ID"

# Get waste
soroban contract invoke --id $CONTRACT_ID --source testnet-deployer \
  --network $NETWORK -- get_waste_v2 --waste_id $WASTE_ID

echo "✅ Smoke test passed"
```

---

## Rollback Procedures

> **Important:** Soroban contracts cannot be deleted or rolled back directly. Rollback means deploying a new contract version and routing traffic to it.

### Contract Rollback

```bash
# 1. Immediately pause the faulty contract
soroban contract invoke \
  --id $FAULTY_CONTRACT_ID \
  --source admin \
  --network $NETWORK \
  -- pause_contract \
  --admin $(soroban keys address admin)

# 2. Deploy the previous known-good WASM
# (Retrieve from your artifact registry / git tag)
git checkout <LAST_GOOD_TAG>
cd stellar-contract
cargo build --target wasm32-unknown-unknown --release
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm

ROLLBACK_CONTRACT_ID=$(soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source admin \
  --network $NETWORK \
  --fee 10000000)

# 3. Re-initialize the rollback contract
soroban contract invoke \
  --id $ROLLBACK_CONTRACT_ID \
  --source admin \
  --network $NETWORK \
  -- initialize_admin \
  --admin $(soroban keys address admin)

# 4. Re-apply configuration (see Step 5 above)

# 5. Update .env files to point to ROLLBACK_CONTRACT_ID
sed -i "s|VITE_CONTRACT_ID=.*|VITE_CONTRACT_ID=$ROLLBACK_CONTRACT_ID|" frontend/.env
sed -i "s|CONTRACT_ID=.*|CONTRACT_ID=$ROLLBACK_CONTRACT_ID|" indexer/.env

# 6. Rebuild and redeploy frontend
cd frontend && npm run build
# re-deploy static assets

# 7. Restart indexer
docker-compose restart indexer

# 8. Verify rollback
echo "Rollback contract: $ROLLBACK_CONTRACT_ID"
soroban contract invoke --id $ROLLBACK_CONTRACT_ID \
  --source admin --network $NETWORK -- get_metrics
```

### Service Rollback

```bash
# Rollback to previous Docker image
docker-compose pull       # or specify previous image tag
docker-compose up -d

# Rollback Kubernetes deployments
kubectl rollout undo deployment/scavngr-frontend -n scavngr
kubectl rollout undo deployment/scavngr-backend -n scavngr
kubectl rollout undo deployment/scavngr-indexer -n scavngr

# Monitor rollout
kubectl rollout status deployment/scavngr-frontend -n scavngr
```

### Database Rollback

```bash
# Restore from last backup (PostgreSQL)
pg_restore \
  --host $DB_HOST \
  --user $DB_USER \
  --dbname scavngr \
  --clean \
  --if-exists \
  /backups/scavngr_$(date +%Y%m%d).dump

# Verify row counts
psql $DATABASE_URL -c "SELECT count(*) FROM participants;"
psql $DATABASE_URL -c "SELECT count(*) FROM wastes;"
```

---

## Monitoring & Alerting

### Key Metrics to Watch

| Metric | Warning | Critical | Check |
|--------|---------|----------|-------|
| Contract invocation success rate | < 95% | < 90% | Horizon API |
| Transaction latency | > 15 s | > 30 s | Soroban RPC |
| Indexer lag (last synced ledger) | > 100 ledgers | > 500 ledgers | Indexer health endpoint |
| Backend API p99 latency | > 2 s | > 5 s | Prometheus |
| Error rate (4xx + 5xx) | > 1% | > 5% | Application logs |
| Database connections | > 80% | > 95% | PostgreSQL metrics |
| Redis memory usage | > 70% | > 90% | Redis INFO |

### Post-Deployment Monitoring Checklist

After deployment, monitor continuously for **1 hour** (testnet) / **4 hours** (mainnet):

- [ ] No spike in contract error rates
- [ ] Indexer syncing latest ledgers (lag < 10)
- [ ] No OOM kills in Docker/Kubernetes
- [ ] Frontend load time < 3 s
- [ ] No alerts firing in monitoring dashboards
- [ ] At least one successful end-to-end transaction per 5 minutes

### Alert Channels

Configure alerts in your monitoring stack (Grafana/Datadog/CloudWatch) to notify:

- **Email:** ops-team@scavenger.app
- **Slack:** #scavngr-ops
- **PagerDuty:** on-call rotation for P0/P1 incidents

---

## Troubleshooting Deployment Issues

### "Admin already initialized" when calling `initialize_admin`

The contract has already been initialized. You have deployed a fresh contract but initialized it before, or you are re-running on an existing deployed contract.

**Fix:** Verify the Contract ID — you may be pointing to an already-configured contract. If deploying fresh, the issue is likely a duplicate invocation.

---

### Contract deploy fails with "insufficient fee"

```bash
# Increase fee (--fee is in stroops; 1 XLM = 10,000,000 stroops)
soroban contract deploy \
  --wasm ... \
  --source deployer \
  --network mainnet \
  --fee 50000000   # 5 XLM — increase if network is congested
```

---

### Indexer fails to connect to Soroban RPC

```bash
# Check RPC endpoint reachability
curl -s https://soroban-testnet.stellar.org/ | jq .

# If using a private RPC node, verify it is up
docker logs soroban-rpc --tail=50

# Update indexer RPC URL
sed -i "s|STELLAR_RPC_URL=.*|STELLAR_RPC_URL=https://soroban-testnet.stellar.org|" indexer/.env
docker-compose restart indexer
```

---

### Frontend shows "Contract ID invalid"

The `VITE_CONTRACT_ID` environment variable must be a valid Stellar contract address (56 alphanumeric characters).

```bash
# Verify format
echo $VITE_CONTRACT_ID | wc -c   # should be 57 (56 chars + newline)

# Re-export and rebuild
export VITE_CONTRACT_ID=<correct-id>
cd frontend && npm run build
```

---

### WASM size too large

Soroban has a maximum contract size. If your WASM exceeds limits:

```bash
# Check size
ls -lh target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm

# Ensure optimization ran
soroban contract optimize --wasm <path>

# Build with size optimization
RUSTFLAGS="-C opt-level=z" cargo build --target wasm32-unknown-unknown --release
```

---

## Related Documentation

- [Architecture Diagram](./architecture-diagram.svg)
- [API Reference Guide](./API_REFERENCE_GUIDE.md)
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md)
- [Kubernetes Deployment](./KUBERNETES_DEPLOYMENT.md)
- [CI/CD Pipeline](./CI_CD_PIPELINE.md)
- [Security Audit](./SECURITY_AUDIT.md)
