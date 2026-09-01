# Scavngr — Troubleshooting Guide

> **Issue:** #536
> **Category:** Operations / Developer Support
> **Audience:** Developers, operators, and end users
> **Last Updated:** 2026-05-26

---

## Table of Contents

1. [Quick Diagnostic Checklist](#quick-diagnostic-checklist)
2. [Contract Errors & Fixes](#contract-errors--fixes)
3. [Frontend Debugging Tips](#frontend-debugging-tips)
4. [Backend Service Troubleshooting](#backend-service-troubleshooting)
5. [Indexer Sync Troubleshooting](#indexer-sync-troubleshooting)
6. [Performance Tuning Guide](#performance-tuning-guide)
7. [Wallet & Transaction Issues](#wallet--transaction-issues)
8. [Network & Connectivity Issues](#network--connectivity-issues)
9. [FAQ](#faq)
10. [Escalation & Support](#escalation--support)

---

## Quick Diagnostic Checklist

Run this first before deeper investigation.

```
[ ] Internet connection working
[ ] Wallet extension installed, enabled, and unlocked
[ ] Correct network selected (TESTNET / MAINNET)
[ ] Account has sufficient XLM balance (≥ 1 XLM for fees)
[ ] Participant is registered (is_participant_registered → true)
[ ] Contract ID is correct (56 chars, no trailing spaces)
[ ] RPC endpoint reachable (curl https://soroban-testnet.stellar.org/)
[ ] Backend service running (curl http://localhost:8080/health)
[ ] Indexer service running (curl http://localhost:3001/health)
[ ] Database accepting connections
[ ] Redis responding (redis-cli ping → PONG)
[ ] No CI/CD deployment currently in progress
```

---

## Contract Errors & Fixes

This section maps each contract panic message to its root cause and resolution.

---

### `"Admin already initialized"`

**Cause:** `initialize_admin` was called on a contract that already has an admin set. This function is one-time only.

**Fix:**
```bash
# Verify admin state before calling
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network $NETWORK \
  -- get_admin
# If this returns an address, initialization is complete — do NOT call initialize_admin again.
```

---

### `"Admin not set"` / `"Contract admin has not been set"`

**Cause:** An admin-only function was called before `initialize_admin`.

**Fix:**
```bash
# Call initialize_admin once
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network testnet \
  -- initialize_admin \
  --admin $(soroban keys address deployer)
```

---

### `"Unauthorized: caller is not admin"` / `"Caller is not the contract admin"`

**Cause:** The transaction signer is not in the admin list.

**Diagnosis:**
```bash
# Check who the current admins are
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network $NETWORK \
  -- get_admins

# Check your address
soroban keys address <your-key-name>
```

**Fix:**
- Use a key that is in the admin list, OR
- Ask an existing admin to call `add_admin` to add your address.

---

### `"Participant already registered"`

**Cause:** `register_participant` was called twice for the same address.

**Diagnosis:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network $NETWORK \
  -- is_participant_registered \
  --address <ADDRESS>
# Returns: true → already registered
```

**Fix:** No action needed — the participant exists. Use `update_role` or `get_participant` as needed.

---

### `"Caller is not a registered participant"`

**Cause:** The address has not called `register_participant`, or the address was deregistered.

**Fix:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source participant \
  --network $NETWORK \
  -- register_participant \
  --address $(soroban keys address participant) \
  --role 0 \
  --name my_name \
  --latitude 52520000 \
  --longitude 13405000
```

---

### `"Caller is not a manufacturer"`

**Cause:** A participant with Recycler or Collector role tried to call a manufacturer-only function (e.g. `create_incentive`, `distribute_rewards`).

**Fix:**
1. Use an account registered with `ParticipantRole::Manufacturer` (role = 2), OR
2. Call `update_role(address, Manufacturer)` on the current account (requires self-signature).

---

### `"Invalid transfer: role combination not allowed"`

**Cause:** The transfer violates the allowed supply-chain path.

**Allowed paths:**
```
Recycler   → Collector    ✓
Recycler   → Manufacturer ✓
Collector  → Manufacturer ✓

Collector  → Recycler     ✗
Manufacturer → Anyone     ✗
Same role  → Same role    ✗
```

**Diagnosis:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network $NETWORK \
  -- is_valid_transfer \
  --from <FROM_ADDRESS> \
  --to <TO_ADDRESS>
```

**Fix:** Ensure both participants are registered and the sender's role can transfer to the recipient's role.

---

### `"Self-transfer is not allowed"`

**Cause:** `from` and `to` addresses are the same in `transfer_waste_v2`.

**Fix:** Use two different Stellar accounts for sender and recipient.

---

### `"Waste weight must be greater than zero"`

**Cause:** Weight parameter was 0.

**Fix:** Provide a positive weight in grams (e.g. `1000` = 1 kg).

---

### `"Waste weight exceeds maximum allowed"`

**Cause:** Weight exceeds 1,000,000,000 grams (1,000 metric tonnes).

**Fix:** Split the submission into multiple calls.

---

### `"Token address not set"`

**Cause:** `reward_tokens` or `distribute_rewards` was called before the admin set the token contract address.

**Fix:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source admin \
  --network $NETWORK \
  -- set_token_address \
  --admin $(soroban keys address admin) \
  --token_address <SEP41_TOKEN_CONTRACT_ID>
```

---

### `"Incentive not found"` / `"Incentive is not active"`

**Cause:** Invalid incentive ID or the incentive was deactivated.

**Diagnosis:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network $NETWORK \
  -- get_incentive_by_id \
  --incentive_id <ID>
# Check 'active' field in the result
```

**Fix:**
- Use `get_active_incentives()` to list valid IDs.
- If budget is exhausted, create a new incentive.

---

### `"Insufficient balance"` (in `donate_to_charity`)

**Cause:** Donation amount exceeds `total_tokens_earned` for the donor.

**Diagnosis:**
```bash
soroban contract invoke \
  --id $CONTRACT_ID \
  --source deployer \
  --network $NETWORK \
  -- get_participant \
  --address <DONOR_ADDRESS>
# Check total_tokens_earned
```

**Fix:** Reduce donation amount to ≤ `total_tokens_earned`.

---

### `"Contract is paused"`

**Cause:** Admin called `pause_contract`. All state-changing operations are blocked.

**Fix:** Contact the contract admin to call `unpause_contract`. Read-only queries still work.

---

### `"Reentrant call detected"`

**Cause:** A guarded function (`reward_tokens`, `donate_to_charity`, `distribute_rewards`) was called recursively — usually a bug in a calling contract.

**Fix:** Review the integration code. Do not call guarded functions from within a Soroban callback that is itself triggered by the same contract.

---

### `"Total percentages cannot exceed 100"`

**Cause:** `collector_percentage + owner_percentage > 100`.

**Fix:**
```bash
# Default safe values: collector=5, owner=50 → sum=55 ✓
soroban contract invoke \
  --id $CONTRACT_ID \
  --source admin \
  --network $NETWORK \
  -- set_percentages \
  --admin <ADMIN_ADDRESS> \
  --collector_percentage 5 \
  --owner_percentage 50
```

---

## Frontend Debugging Tips

### Enable Debug Mode

```bash
# .env.local
VITE_DEBUG=true
```

```typescript
// src/utils/debug.ts
export const debug = import.meta.env.VITE_DEBUG === 'true'
  ? console.log.bind(console, '[scavngr]')
  : () => {};
```

### Check Environment Variables at Runtime

Open the browser console (F12 → Console):
```javascript
console.log(import.meta.env)
// Verify VITE_CONTRACT_ID, VITE_NETWORK, VITE_RPC_URL are set correctly
```

### Contract Invocation Debugging

```typescript
import { SorobanRpc } from '@stellar/stellar-sdk';

const server = new SorobanRpc.Server(import.meta.env.VITE_RPC_URL);

// Simulate before submitting
const simResult = await server.simulateTransaction(tx);
if (SorobanRpc.Api.isSimulationError(simResult)) {
  console.error('Simulation error:', simResult.error);
  // Parse simResult.error.message for the panic string
}
```

### Wallet Connection Debugging

```javascript
// Check wallet availability
console.log('Freighter available:', typeof window.freighter !== 'undefined');
console.log('Freighter connected:', await window.freighter.isConnected());

// Check network
const network = await window.freighter.getNetwork();
console.log('Wallet network:', network); // Should match VITE_NETWORK
```

### Common Frontend Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `"Contract ID invalid"` | Wrong or malformed `VITE_CONTRACT_ID` | Verify 56-char contract ID in `.env` |
| `"Wallet not detected"` | Extension not installed | Install Freighter |
| `"User declined"` | User rejected wallet popup | Re-initiate transaction |
| `"Network mismatch"` | Wallet on testnet but app on mainnet | Switch wallet network |
| `"Transaction simulation failed"` | Contract will panic | See contract error in sim result |
| `"Insufficient XLM for fees"` | Account balance too low | Fund account via Friendbot (testnet) |
| White screen on load | Missing env variable | Run `npm run build` and check console |

### Inspecting Failed Transactions

```javascript
// After a failed transaction, inspect Horizon
const txId = '<transaction_hash>';
const response = await fetch(
  `https://horizon-testnet.stellar.org/transactions/${txId}`
);
const tx = await response.json();
console.log('Result XDR:', tx.result_xdr);
// Decode with @stellar/stellar-sdk:
// const result = xdr.TransactionResult.fromXDR(tx.result_xdr, 'base64');
```

### Running Frontend Tests

```bash
cd frontend

# Unit tests
npm run test

# Visual regression
npm run test:visual

# Accessibility audit
npm run test:a11y

# E2E (requires running app)
npm run test:e2e

# Type check only
npx tsc --noEmit
```

---

## Backend Service Troubleshooting

### Service Won't Start

**Diagnosis:**
```bash
# Check Docker container status
docker-compose ps

# Read logs
docker-compose logs backend --tail=100

# Inspect for port conflicts
ss -tlnp | grep 8080
```

**Common causes:**
- Missing environment variable → check `docker-compose.yml` and `.env`
- Port 8080 already in use → stop conflicting process or change port
- Database unreachable → see [Database section](#database-issues) below

---

### `Connection refused` to Backend API

```bash
# Verify backend is listening
curl -v http://localhost:8080/health

# Check internal Docker networking
docker network inspect scavenger_default
docker exec scavngr-backend curl http://localhost:8080/health
```

---

### Database Issues

```bash
# Check database container
docker-compose logs db --tail=50

# Connect manually
docker exec -it scavngr-db psql -U scavngr -d scavngr -c "SELECT version();"

# Run pending migrations
docker exec scavngr-backend cargo run --bin migrate
# or
docker-compose run --rm backend npm run db:migrate

# Check for locked tables
docker exec scavngr-db psql -U scavngr -d scavngr \
  -c "SELECT pid, state, query FROM pg_stat_activity WHERE state != 'idle';"

# Reset database (⚠️ DEVELOPMENT ONLY)
docker-compose down -v
docker-compose up -d db
```

---

### Rate Limiting Issues (429 Too Many Requests)

The backend enforces 100 req/min per IP.

```bash
# Check current rate limit headers
curl -I http://localhost:8080/api/participants/...
# Look for: X-RateLimit-Remaining, X-RateLimit-Reset

# Increase limit in development (docker-compose.yml)
# RATE_LIMIT_PER_MIN=1000
```

---

### Backend Memory / CPU Spikes

```bash
# Monitor resource usage
docker stats scavngr-backend

# Check for slow queries
docker exec scavngr-db psql -U scavngr -d scavngr \
  -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Restart with increased memory (docker-compose.yml)
# mem_limit: 512m
```

---

## Indexer Sync Troubleshooting

### Indexer Lagging Behind Latest Ledger

**Symptoms:** Indexer dashboard shows stale data; `last_synced_ledger` is far behind current ledger.

**Diagnosis:**
```bash
# Check indexer logs
docker-compose logs indexer --tail=100

# Check current ledger vs synced ledger
curl http://localhost:3001/health | jq '{last_synced: .last_synced_ledger, network_ledger: .network_ledger}'

# Check job queue depth
docker-compose logs indexer | grep "queue depth"
```

**Fix:**
```bash
# Restart indexer (clears in-memory state, re-syncs from last checkpointed ledger)
docker-compose restart indexer

# If severely behind, clear the event cursor and re-sync from scratch
# (will re-process all events — use with caution)
docker exec scavngr-db psql -U scavngr -d scavngr \
  -c "DELETE FROM indexer_state WHERE key = 'last_cursor';"
docker-compose restart indexer
```

---

### Indexer Failing to Connect to Soroban RPC

```bash
# Test RPC connectivity from inside the container
docker exec scavngr-indexer \
  curl -s https://soroban-testnet.stellar.org/ | jq .

# Update RPC URL in .env if needed
docker-compose down indexer
# Edit STELLAR_RPC_URL in indexer/.env
docker-compose up -d indexer
```

---

### Missing Events / Gaps in Data

**Cause:** Indexer missed events during a restart or RPC outage.

**Fix:**
```bash
# Replay events from a specific ledger number
# Edit indexer/.env:
# REPLAY_FROM_LEDGER=<ledger_number>

docker-compose restart indexer

# Monitor until caught up
docker-compose logs -f indexer | grep "synced ledger"
```

---

### Job Queue Backing Up

```bash
# Check queue depth
docker-compose logs indexer | grep -i "queue\|job\|pending"

# Redis queue inspection
docker exec scavngr-redis redis-cli LLEN job_queue

# If queue is deadlocked, purge and restart
docker exec scavngr-redis redis-cli DEL job_queue
docker-compose restart indexer
```

---

### Analytics Data Not Updating

```bash
# Trigger manual analytics refresh
curl -X POST http://localhost:3001/admin/refresh-analytics \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Check analytics service logs
docker-compose logs indexer | grep analytics
```

---

### Duplicate Events in Database

**Cause:** Indexer was restarted without advancing the cursor.

**Fix:**
```bash
# Remove duplicates (idempotent upsert should prevent this, but if it occurs):
docker exec scavngr-db psql -U scavngr -d scavngr << 'SQL'
DELETE FROM contract_events a
USING contract_events b
WHERE a.id > b.id
  AND a.event_id = b.event_id;
SQL
```

---

## Performance Tuning Guide

### Contract Performance

**1. Use batch operations where available**
```bash
# Instead of submitting one waste at a time:
soroban contract invoke -- submit_materials_batch --materials '[...]'

# Batch size limit: 100 items per call
```

**2. Prefer v2 APIs**
v2 APIs (e.g. `recycle_waste`, `transfer_waste_v2`) use optimized storage layouts.

**3. Simulate before submit**
Always simulate transactions before submitting to avoid wasted fees on failing calls:
```typescript
const simResult = await server.simulateTransaction(tx);
if (SorobanRpc.Api.isSimulationError(simResult)) {
  throw new Error(`Simulation failed: ${simResult.error}`);
}
const preparedTx = SorobanRpc.assembleTransaction(tx, simResult).build();
```

**4. Batch reads off-chain**
Use the indexer/backend API for paginated reads rather than calling the contract directly for every query:
```
GET /api/participants?offset=0&limit=50
GET /api/wastes?participant=<address>&page=1
```

---

### Frontend Performance

**1. Enable production builds for benchmarking**
```bash
npm run build && npm run preview
# Dev server is significantly slower than production build
```

**2. Use React Query / SWR for data caching**
```typescript
// Cache participant data for 5 minutes
const { data } = useQuery({
  queryKey: ['participant', address],
  queryFn: () => fetchParticipant(address),
  staleTime: 5 * 60 * 1000,
});
```

**3. Lazy-load heavy components**
```typescript
const WasteMap = React.lazy(() => import('./components/WasteMap'));
```

**4. Bundle analysis**
```bash
npm run build -- --report
# Open dist/report.html to identify large dependencies
```

**5. Check Lighthouse scores**
```bash
npm run lighthouse
# Target: Performance > 80, Accessibility > 90
```

---

### Backend Performance

**1. Enable Redis caching for hot queries**

Frequently read endpoints (e.g. global metrics, participant lists) should cache results:
```
Cache TTL recommendations:
  GET /metrics          → 30 seconds
  GET /participants     → 60 seconds
  GET /incentives       → 120 seconds
  GET /participant/:id  → 10 seconds
```

**2. Add database indexes for common query patterns**
```sql
-- Speed up participant lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wastes_owner
  ON wastes(current_owner);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wastes_type
  ON wastes(waste_type);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_incentives_waste_type_active
  ON incentives(waste_type, active) WHERE active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transfer_history_waste
  ON transfer_history(waste_id);
```

**3. Use connection pooling**
```
# docker-compose.yml or .env
DATABASE_MAX_CONNECTIONS=20
DATABASE_MIN_CONNECTIONS=2
```

**4. Enable Gzip compression on API responses**
```rust
// actix-web
use actix_web::middleware::Compress;
App::new().wrap(Compress::default())
```

---

### Indexer Performance

**1. Tune polling interval**

The indexer polls the Soroban RPC for new events. Set the interval based on network conditions:
```
# indexer/.env
POLL_INTERVAL_MS=5000    # 5 s is a good default (matches ~Stellar ledger time)
# Reduce to 1000 for near-real-time; increase to 30000 if RPC is slow
```

**2. Job queue concurrency**
```
# indexer/.env
JOB_CONCURRENCY=4        # Process 4 jobs simultaneously
JOB_RETRY_ATTEMPTS=3
JOB_RETRY_DELAY_MS=1000
```

**3. Redis cache TTLs for indexer queries**
```
# indexer/.env
CACHE_TTL_SEARCH_RESULTS=60    # seconds
CACHE_TTL_ANALYTICS=300        # 5 minutes
CACHE_TTL_PARTICIPANT=30
```

**4. Batch database writes**

Indexer should accumulate multiple events and write them in a single transaction:
```typescript
// Flush every 100 events or every 2 seconds, whichever comes first
const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 2000;
```

---

### Database Performance

```sql
-- Check slow queries
SELECT query, calls, total_exec_time / calls AS avg_ms
FROM pg_stat_statements
ORDER BY avg_ms DESC
LIMIT 20;

-- Check table bloat
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Run VACUUM ANALYZE to update statistics
VACUUM ANALYZE participants;
VACUUM ANALYZE wastes;
VACUUM ANALYZE transfer_history;
```

---

## Wallet & Transaction Issues

### Wallet Not Detected

```javascript
// In browser console
console.log('Freighter:', window.freighter);
```

**Solutions:**
1. Install [Freighter](https://www.freighter.app/) browser extension
2. Reload page after installation
3. Check extension is enabled for the current site (extension icon → gear → Allow on this site)

---

### Transaction Timeout (> 30 s)

**Check:**
```bash
# Query Horizon for tx status
curl "https://horizon-testnet.stellar.org/transactions/<TX_HASH>" | jq '.status'
```

**Solutions:**
- If not found: transaction dropped — resubmit
- If `failed`: see `result_xdr` for error details
- Increase fee: standard 100 stroops may be insufficient during network congestion

---

### "Sequence number too old"

**Cause:** You built a transaction and didn't submit it quickly enough. The account's sequence number changed.

**Fix:** Rebuild the transaction (fetch fresh sequence number) and resubmit immediately.

---

### Account Not Found on Horizon

```bash
# Fund testnet account via Friendbot
curl "https://friendbot.stellar.org?addr=<YOUR_ADDRESS>"
```

---

## Network & Connectivity Issues

```bash
# Test Soroban RPC
curl -s https://soroban-testnet.stellar.org/ | jq '.status'

# Test Horizon
curl -s https://horizon-testnet.stellar.org/ | jq '._links'

# Check Stellar network status
# https://status.stellar.org/

# DNS check
nslookup soroban-testnet.stellar.org

# Port check
nc -zv soroban-testnet.stellar.org 443
```

---

## FAQ

**Q: Can I recover a private key?**
A: No. If you have a seed phrase, import it into Freighter. Otherwise, the key is unrecoverable.

**Q: Can I cancel a submitted transaction?**
A: No. Transactions are final once included in a ledger. Reverse effects with a new transaction if needed.

**Q: Why is my waste not showing in the UI?**
A: The indexer syncs on a ~5 s interval. Wait 10–15 seconds and refresh. If still missing, check indexer logs.

**Q: Can a participant have multiple roles?**
A: No. Each address has exactly one role. Use separate accounts for different roles, or call `update_role` to change.

**Q: Why did my reward distribution fail?**
A: Common causes: incentive budget exhausted, token address not set, waste doesn't exist. Check each with the get functions and contract error message.

**Q: The contract is paused — what can I do?**
A: Read-only queries still work. Contact the admin team. State-changing calls are blocked until `unpause_contract` is called.

---

## Escalation & Support

### Self-Service Resources

- [API Reference Guide](./API_REFERENCE_GUIDE.md)
- [Deployment Runbook](./DEPLOYMENT_RUNBOOK.md)
- [Architecture Diagram](./architecture-diagram.svg)
- [Stellar Documentation](https://developers.stellar.org/)
- [Soroban Documentation](https://developers.stellar.org/docs/learn/soroban)
- [GitHub Issues](https://github.com/Xoulomon/Scavenger/issues)

### Diagnostic Commands Summary

```bash
# Contract state snapshot
soroban contract invoke --id $CONTRACT_ID --source deployer --network $NETWORK -- get_metrics
soroban contract invoke --id $CONTRACT_ID --source deployer --network $NETWORK -- get_admins
soroban contract invoke --id $CONTRACT_ID --source deployer --network $NETWORK -- get_token_address

# Service health
curl http://localhost:8080/health      # backend
curl http://localhost:3001/health      # indexer
docker-compose ps                       # all containers

# Logs
docker-compose logs backend --tail=50
docker-compose logs indexer --tail=50
docker-compose logs db --tail=50
```

### Reporting Bugs

When filing a GitHub issue, include:
1. Exact error message / panic string
2. Function name and parameters called
3. Network (testnet / mainnet)
4. Steps to reproduce
5. Expected vs actual behaviour
6. Relevant logs (sanitize any private keys)

### Contact

- **Email:** support@scavenger.app
- **GitHub:** [Issues](https://github.com/Xoulomon/Scavenger/issues)
- **Discord:** [Stellar Community](https://discord.gg/stellar)
