# Deployment Guide

Comprehensive guide for deploying Scavenger across all environments.

## Table of Contents

- [Local Deployment](#local-deployment)
- [Testnet Deployment](#testnet-deployment)
- [Mainnet Deployment](#mainnet-deployment)
- [Environment Configuration](#environment-configuration)
- [Deployment Verification](#deployment-verification)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)
- [Post-Deployment Checklist](#post-deployment-checklist)

## Local Deployment

### Prerequisites

- Docker and Docker Compose
- Rust 1.70+
- Soroban CLI
- Node.js 18+

### Setup Steps

1. **Clone and navigate to project:**

```bash
git clone https://github.com/Xoulomon/Scavenger.git
cd Scavenger
```

2. **Start Stellar standalone network:**

```bash
docker run --rm -it -p 8000:8000 \
  stellar/quickstart:latest --standalone --enable-soroban-rpc
```

3. **Build the contract:**

```bash
cd stellar-contract
cargo build --target wasm32-unknown-unknown --release
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm
```

4. **Deploy contract locally:**

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source default \
  --network standalone
```

5. **Start backend services:**

```bash
docker-compose up -d
```

6. **Initialize frontend:**

```bash
cd frontend
npm install
cp .env.example .env
# Update .env with local contract ID and RPC URL
npm run dev
```

### Local Environment Variables

Create `frontend/.env`:

```
VITE_CONTRACT_ID=<deployed-contract-id>
VITE_NETWORK=STANDALONE
VITE_RPC_URL=http://localhost:8000/soroban/rpc
VITE_FIREBASE_API_KEY=test-key
VITE_FIREBASE_AUTH_DOMAIN=test.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=test-project
VITE_FIREBASE_STORAGE_BUCKET=test-bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-ABC123
```

## Testnet Deployment

### Prerequisites

- Stellar testnet account with XLM
- Soroban CLI configured
- GitHub Actions secrets configured

### Manual Deployment

1. **Generate or use existing keypair:**

```bash
soroban keys generate testnet-deployer
```

2. **Fund account via Friendbot:**

```bash
curl "https://friendbot.stellar.org?addr=$(soroban keys address testnet-deployer)"
```

3. **Build optimized WASM:**

```bash
cd stellar-contract
cargo build --target wasm32-unknown-unknown --release
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm
```

4. **Deploy to testnet:**

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source testnet-deployer \
  --network testnet
```

5. **Record contract ID:**

```bash
# Save the returned contract ID for frontend configuration
export TESTNET_CONTRACT_ID=<contract-id>
```

### Testnet Environment Variables

Create `frontend/.env.testnet`:

```
VITE_CONTRACT_ID=<testnet-contract-id>
VITE_NETWORK=TESTNET
VITE_RPC_URL=https://soroban-testnet.stellar.org
VITE_FIREBASE_API_KEY=<your-firebase-key>
VITE_FIREBASE_AUTH_DOMAIN=<your-domain>
VITE_FIREBASE_PROJECT_ID=<your-project>
VITE_FIREBASE_STORAGE_BUCKET=<your-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<your-sender-id>
VITE_FIREBASE_APP_ID=<your-app-id>
VITE_FIREBASE_MEASUREMENT_ID=<your-measurement-id>
```

### Automated Testnet Deployment

GitHub Actions workflow (`.github/workflows/deploy-testnet.yml`):

```yaml
name: Deploy to Testnet
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
          target: wasm32-unknown-unknown
      - name: Build contract
        run: |
          cd stellar-contract
          cargo build --target wasm32-unknown-unknown --release
          soroban contract optimize --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm
      - name: Deploy to testnet
        env:
          SOROBAN_SECRET_KEY: ${{ secrets.TESTNET_SECRET_KEY }}
        run: |
          soroban contract deploy \
            --wasm stellar-contract/target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
            --source testnet-deployer \
            --network testnet
```

## Mainnet Deployment

### Prerequisites

- Mainnet account with sufficient XLM
- Multi-signature setup recommended
- Comprehensive testing on testnet
- Audit completion
- Disaster recovery plan in place

### Pre-Deployment Checklist

- [ ] All tests passing on testnet
- [ ] Security audit completed
- [ ] Performance benchmarks acceptable
- [ ] Rollback plan documented
- [ ] Team trained on procedures
- [ ] Monitoring configured
- [ ] Backup systems verified

### Deployment Steps

1. **Prepare mainnet keypair:**

```bash
soroban keys generate mainnet-deployer
# Store securely in vault/secrets manager
```

2. **Fund account:**

```bash
# Transfer XLM from exchange or existing account
# Ensure sufficient balance for deployment + operations
```

3. **Build and optimize:**

```bash
cd stellar-contract
cargo build --target wasm32-unknown-unknown --release
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm
```

4. **Deploy to mainnet:**

```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source mainnet-deployer \
  --network public
```

5. **Verify deployment:**

```bash
soroban contract info \
  --id <contract-id> \
  --network public
```

### Mainnet Environment Variables

```
VITE_CONTRACT_ID=<mainnet-contract-id>
VITE_NETWORK=MAINNET
VITE_RPC_URL=https://soroban-mainnet.stellar.org
VITE_FIREBASE_API_KEY=<production-firebase-key>
VITE_FIREBASE_AUTH_DOMAIN=<production-domain>
VITE_FIREBASE_PROJECT_ID=<production-project>
VITE_FIREBASE_STORAGE_BUCKET=<production-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<production-sender-id>
VITE_FIREBASE_APP_ID=<production-app-id>
VITE_FIREBASE_MEASUREMENT_ID=<production-measurement-id>
```

## Environment Configuration

### Configuration Files

**soroban.toml:**

```toml
[build]
workspace = true

[env.standalone]
rpc_url = "http://localhost:8000/soroban/rpc"
network_passphrase = "Standalone Network ; February 2021"

[env.testnet]
rpc_url = "https://soroban-testnet.stellar.org"
network_passphrase = "Test SDF Network ; September 2015"

[env.public]
rpc_url = "https://soroban-mainnet.stellar.org"
network_passphrase = "Public Global Stellar Network ; September 2015"
```

### Environment Variables Reference

| Variable             | Environment | Required | Description                           |
| -------------------- | ----------- | -------- | ------------------------------------- |
| `VITE_CONTRACT_ID`   | All         | ✅       | Deployed contract ID                  |
| `VITE_NETWORK`       | All         | ✅       | Network: STANDALONE, TESTNET, MAINNET |
| `VITE_RPC_URL`       | All         | ✅       | Soroban RPC endpoint                  |
| `SOROBAN_SECRET_KEY` | CI/CD       | ✅       | Private key for deployment            |
| `VITE_FIREBASE_*`    | All         | ✅       | Firebase configuration                |

## Deployment Verification

### Contract Verification

```bash
# Check contract exists
soroban contract info \
  --id <contract-id> \
  --network <network>

# Verify contract code
soroban contract inspect \
  --id <contract-id> \
  --network <network>
```

### Functional Verification

```bash
# Test participant registration
soroban contract invoke \
  --id <contract-id> \
  --source <account> \
  --network <network> \
  -- register_participant \
  --address <address> \
  --role 0 \
  --name "Test" \
  --lat 0 \
  --lon 0

# Verify metrics
soroban contract invoke \
  --id <contract-id> \
  --source <account> \
  --network <network> \
  -- get_metrics
```

### Frontend Verification

```bash
# Check contract ID validation
curl http://localhost:5173/api/health

# Verify RPC connectivity
curl <VITE_RPC_URL>/health
```

## Troubleshooting

### Common Issues

**Contract deployment fails with "insufficient balance"**

- Ensure account has enough XLM for deployment fee
- Check network fees: `soroban network info --network <network>`
- Fund account with additional XLM

**RPC endpoint unreachable**

- Verify RPC URL is correct
- Check network connectivity
- Try alternative RPC endpoint
- Check Stellar network status

**Frontend cannot connect to contract**

- Verify `VITE_CONTRACT_ID` is correct
- Confirm `VITE_RPC_URL` is accessible
- Check browser console for CORS errors
- Verify contract exists on network

**Transaction timeout**

- Increase timeout in soroban CLI: `--timeout-secs 300`
- Check network congestion
- Retry deployment

### Debug Commands

```bash
# Check account balance
soroban account balance \
  --account <account> \
  --network <network>

# View transaction details
soroban contract invoke \
  --id <contract-id> \
  --source <account> \
  --network <network> \
  --verbose \
  -- <function>

# Check contract storage
soroban contract read \
  --id <contract-id> \
  --network <network>
```

## Rollback Procedures

### Pre-Rollback Checklist

- [ ] Identify issue requiring rollback
- [ ] Notify stakeholders
- [ ] Prepare previous contract ID
- [ ] Test rollback in staging
- [ ] Document rollback reason

### Rollback Steps

1. **Identify previous stable version:**

```bash
# Check deployment history
git log --oneline | grep "deploy"
```

2. **Redeploy previous contract:**

```bash
# Build previous version
git checkout <previous-commit>
cd stellar-contract
cargo build --target wasm32-unknown-unknown --release
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm

# Deploy
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source <deployer> \
  --network <network>
```

3. **Update frontend configuration:**

```bash
# Update VITE_CONTRACT_ID to previous contract
# Redeploy frontend
npm run build
# Deploy to CDN/hosting
```

4. **Verify rollback:**

```bash
# Test critical functions
soroban contract invoke \
  --id <previous-contract-id> \
  --source <account> \
  --network <network> \
  -- get_metrics
```

5. **Post-rollback analysis:**

- Document what went wrong
- Create issue for fix
- Plan re-deployment

## Post-Deployment Checklist

### Immediate (0-1 hour)

- [ ] Contract deployed successfully
- [ ] Contract ID recorded
- [ ] Frontend updated with new contract ID
- [ ] Basic functionality tested
- [ ] Monitoring alerts configured
- [ ] Team notified

### Short-term (1-24 hours)

- [ ] All critical functions tested
- [ ] Performance metrics acceptable
- [ ] No error spikes in logs
- [ ] User reports monitored
- [ ] Database backups verified
- [ ] Disaster recovery tested

### Medium-term (1-7 days)

- [ ] Full regression testing completed
- [ ] Load testing performed
- [ ] Security scan completed
- [ ] Documentation updated
- [ ] Deployment notes archived
- [ ] Team retrospective held

### Long-term (ongoing)

- [ ] Monitor contract metrics
- [ ] Track performance trends
- [ ] Review security logs
- [ ] Plan next deployment
- [ ] Update runbooks based on learnings
