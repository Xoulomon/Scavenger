# Scavngr Migration Guide

## Overview

This guide provides step-by-step instructions for upgrading Scavngr between contract versions
while preserving data integrity and minimising downtime. It covers state migration procedures,
data transformation scripts, rollback procedures, testing requirements, and a verification
checklist for each upgrade path.

> **Before you begin**: Always test migrations on a Stellar testnet environment first.
> Never migrate directly to mainnet without a verified staging run.

---

## Version Compatibility Matrix

| From Version | To Version | Breaking Changes | Data Migration | Downtime | Effort |
|---|---|---|---|---|---|
| v1.0.x | v1.1.x | No  | Optional | None    | Low  |
| v1.1.x | v1.2.x | No  | Optional | None    | Low  |
| v1.0.x | v2.0.0 | Yes | Required | ~1 hour | High |
| v2.0.x | v2.1.x | No  | Optional | None    | Low  |
| v2.1.x | v2.2.x | No  | Optional | None    | Low  |

**Legend:**
- **Breaking Changes**: API or data-structure incompatibilities that require client updates
- **Data Migration**: Whether on-chain state must be transformed
- **Downtime**: Expected period of reduced availability
- **Effort**: Implementation and coordination complexity

---

## Breaking Changes by Version

### v2.0.0 (Major Release)

**Participant Storage Format**
- Old: Flat structure with inline stats
- New: Separated `Participant` and `RecyclingStats` storage
- Impact: All participant records require transformation

**Incentive Budget Tracking**
- Old: Single `budget` field
- New: `total_budget` + `remaining_budget` dual-field tracking
- Impact: Budget recalculation required for all existing incentives

**Transfer History**
- Old: Transfer history stored inside each waste record
- New: Separate `("transfer_history", waste_id)` storage key
- Impact: History must be extracted and re-inserted

**Waste struct (v1 → v2)**
- Old: `Material` struct with flat fields
- New: `Waste` struct with extended fields (grade, tags, tracking_code, expires_at, etc.)
- Impact: All materials must be migrated to the new `Waste` format

### v1.1.0 (Minor Release)

**Waste Type Enum**
- Added: `Organic` waste type (discriminant 5) and `Electronic` (discriminant 6)
- Impact: No breaking changes; backward compatible

**Reward Distribution**
- Added: Configurable collector/owner split percentages
- Impact: No breaking changes; defaults to 50/50 split

### v2.1.0 (Minor Release)

**Waste Expiration System**
- Added: `expires_at` field on `Waste`, `set_waste_ttl`, `cleanup_expired_wastes`
- Impact: New wastes automatically receive an expiry; existing wastes default to `expires_at = 0`
  (no expiry) and require no migration

**Waste Grading System**
- Added: `WasteGrade` enum, `grade` field on `Waste`, `set_waste_grade`, `get_grade_history`
- Impact: Existing wastes default to `WasteGrade::C`; no migration required

---

## State Migration Procedures

State migration is required when the storage format changes between versions (major releases).
The procedure follows these phases:

```
Phase 1: Snapshot  →  Phase 2: Deploy new contract  →  Phase 3: Transform state
     ↓                                                        ↓
Phase 4: Verify    ←  Phase 5: Cutover              ←  Phase 4: Seed new contract
```

### Phase 1: Snapshot current state

Export all contract state before making any changes.

```bash
# Export participant list
soroban contract invoke \
  --id $OLD_CONTRACT \
  --source $ADMIN_KEY \
  --network $NETWORK \
  -- get_all_participants > snapshot/participants.json

# Export waste items (v2 storage)
soroban contract invoke \
  --id $OLD_CONTRACT \
  --source $ADMIN_KEY \
  --network $NETWORK \
  -- get_supply_chain_stats > snapshot/stats.json

# Export global metrics
soroban contract invoke \
  --id $OLD_CONTRACT \
  --source $ADMIN_KEY \
  --network $NETWORK \
  -- get_metrics > snapshot/metrics.json

# Export incentives
soroban contract invoke \
  --id $OLD_CONTRACT \
  --source $ADMIN_KEY \
  --network $NETWORK \
  -- get_all_incentives > snapshot/incentives.json

echo "Snapshot complete. Files saved to ./snapshot/"
```

### Phase 2: Build and deploy new contract

```bash
# Build the new version
cd stellar-contract
cargo build --target wasm32-unknown-unknown --release

# Optimise WASM binary
soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm

# Deploy to testnet first
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source testnet-deployer \
  --network testnet \
  > new_contract_id.txt

export NEW_CONTRACT=$(cat new_contract_id.txt)

# Initialise admin on new contract
soroban contract invoke \
  --id $NEW_CONTRACT \
  --source $ADMIN_KEY \
  --network testnet \
  -- initialize_admin \
  --admin $ADMIN_ADDRESS
```

### Phase 3: Run data transformation

See [Data Transformation Steps](#data-transformation-steps) for details.

### Phase 4: Seed the new contract

```bash
# Run the migration script
./scripts/migrate.sh \
  --old-contract $OLD_CONTRACT \
  --new-contract $NEW_CONTRACT \
  --network $NETWORK \
  --admin-key $ADMIN_KEY \
  --snapshot-dir ./snapshot
```

### Phase 5: Verify and cutover

See [Verification Checklist](#verification-checklist).

---

## Data Transformation Steps

### Participants (v1 → v2)

The v2 participant struct separates stats into a distinct storage entry. The transformation
reads the old flat record and writes two new entries per participant.

```rust
/// Migrate participants from v1 flat format to v2 split format.
/// Run inside a migration script that invokes old and new contracts.
pub fn migrate_participants(
    env: &Env,
    old_contract: &Address,
    new_contract: &Address,
) -> Result<u32, &'static str> {
    let mut count = 0u32;

    // Fetch all participants from the old contract.
    let participants = old_contract.get_all_participants()?;

    for p in participants {
        // Re-register on the new contract using the same address and role.
        new_contract.register_participant(
            p.address.clone(),
            p.role,
            p.name.clone(),
            p.latitude,
            p.longitude,
        )?;

        // Restore earned token balance — call reward_tokens or a migration endpoint.
        if p.total_tokens_earned > 0 {
            new_contract.restore_earned_tokens(p.address.clone(), p.total_tokens_earned)?;
        }

        count += 1;
    }

    Ok(count)
}
```

Shell equivalent:

```bash
jq -c '.[]' snapshot/participants.json | while read p; do
  ADDR=$(echo $p | jq -r '.address')
  ROLE=$(echo $p | jq -r '.role')
  NAME=$(echo $p | jq -r '.name')
  LAT=$(echo $p  | jq -r '.latitude')
  LON=$(echo $p  | jq -r '.longitude')

  soroban contract invoke \
    --id $NEW_CONTRACT \
    --source $ADMIN_KEY \
    --network $NETWORK \
    -- register_participant \
    --address "$ADDR" \
    --role "$ROLE" \
    --name "$NAME" \
    --latitude "$LAT" \
    --longitude "$LON"
done
```

### Waste items (v1 Material → v2 Waste)

```rust
/// Transform a v1 Material record to the v2 Waste format.
pub fn transform_material_to_waste(material: &Material, env: &Env) -> Waste {
    Waste::new(
        env,
        material.id as u128,
        material.waste_type,
        material.weight as u128,
        material.submitter.clone(),
        0, // latitude unknown from v1 data
        0, // longitude unknown from v1 data
        material.submitted_at,
        true,           // is_active
        material.verified, // is_confirmed
        material.submitter.clone(), // confirmer (self if unknown)
        0,              // expires_at = 0 (no expiry by default)
    )
}
```

Shell equivalent:

```bash
jq -c '.[]' snapshot/materials.json | while read m; do
  soroban contract invoke \
    --id $NEW_CONTRACT \
    --source $ADMIN_KEY \
    --network $NETWORK \
    -- recycle_waste \
    --waste_type "$(echo $m | jq -r '.waste_type')" \
    --weight "$(echo $m | jq -r '.weight')" \
    --recycler "$(echo $m | jq -r '.submitter')" \
    --latitude 0 \
    --longitude 0
done
```

### Incentives

```rust
/// Migrate incentives, preserving remaining budget.
pub fn migrate_incentives(
    old_contract: &Address,
    new_contract: &Address,
) -> Result<u32, &'static str> {
    let mut count = 0u32;
    let incentives = old_contract.get_all_incentives()?;

    for inc in incentives {
        new_contract.create_incentive(
            inc.rewarder.clone(),
            inc.waste_type,
            inc.reward_points,
            inc.remaining_budget, // use remaining, not total
        )?;
        count += 1;
    }

    Ok(count)
}
```

### Transfer history reconstruction

```bash
# Extract transfer history from old contract and replay on new contract
jq -c '.[]' snapshot/transfer_history.json | while read t; do
  WASTE_ID=$(echo $t | jq -r '.waste_id')
  FROM=$(echo $t    | jq -r '.from')
  TO=$(echo $t      | jq -r '.to')
  LAT=$(echo $t     | jq -r '.latitude')
  LON=$(echo $t     | jq -r '.longitude')

  soroban contract invoke \
    --id $NEW_CONTRACT \
    --source $ADMIN_KEY \
    --network $NETWORK \
    -- transfer_waste_v2 \
    --waste_id "$WASTE_ID" \
    --from "$FROM" \
    --to "$TO" \
    --latitude "$LAT" \
    --longitude "$LON"
done
```

---

## Pre-Migration Checklist

- [ ] Read the Breaking Changes section for your target version
- [ ] Create a full state snapshot (`Phase 1: Snapshot current state`)
- [ ] Build and test the new WASM binary locally
- [ ] Deploy the new contract on **testnet** and run a full migration
- [ ] Pass all items in the [Testing Requirements](#testing-requirements) section on testnet
- [ ] Notify users of planned maintenance window
- [ ] Prepare and rehearse the rollback plan
- [ ] Schedule migration during low-traffic period (< 5 % of daily active users)
- [ ] Confirm admin key availability
- [ ] Back up snapshot files to off-chain storage (S3, IPFS, etc.)

---

## Migration Steps

### Step 1: Backup current state

```bash
mkdir -p snapshot
./scripts/snapshot.sh \
  --contract $OLD_CONTRACT \
  --admin-key $ADMIN_KEY \
  --network $NETWORK \
  --output-dir ./snapshot
```

### Step 2: Deploy new contract version

```bash
cd stellar-contract
cargo build --target wasm32-unknown-unknown --release

soroban contract optimize \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.wasm

soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/stellar_scavngr_contract.optimized.wasm \
  --source $ADMIN_KEY \
  --network $NETWORK
```

### Step 3: Run data migration scripts

```bash
# For v1.x → v2.0.0
./scripts/migrate-v1-to-v2.sh \
  --old-contract $OLD_CONTRACT \
  --new-contract $NEW_CONTRACT \
  --network $NETWORK \
  --admin-key $ADMIN_KEY \
  --snapshot-dir ./snapshot

# For v2.0.x → v2.1.x (additive only — no transformation needed)
echo "No data migration required for v2.0.x → v2.1.x"
```

**Full migration script** (`scripts/migrate-v1-to-v2.sh`):

```bash
#!/bin/bash
set -euo pipefail

OLD_CONTRACT=$1
NEW_CONTRACT=$2
NETWORK=$3
ADMIN_KEY=$4
SNAPSHOT_DIR=${5:-./snapshot}

echo "=== Starting Scavngr v1 → v2 Migration ==="
echo "Old contract : $OLD_CONTRACT"
echo "New contract : $NEW_CONTRACT"
echo "Network      : $NETWORK"

# Step A: Migrate participants
echo "[1/4] Migrating participants..."
jq -c '.[]' "$SNAPSHOT_DIR/participants.json" | while read p; do
  soroban contract invoke \
    --id "$NEW_CONTRACT" --source "$ADMIN_KEY" --network "$NETWORK" \
    -- register_participant \
    --address "$(echo $p | jq -r '.address')" \
    --role    "$(echo $p | jq -r '.role')" \
    --name    "$(echo $p | jq -r '.name')" \
    --latitude  "$(echo $p | jq -r '.latitude')" \
    --longitude "$(echo $p | jq -r '.longitude')"
done

# Step B: Migrate waste items
echo "[2/4] Migrating waste items..."
jq -c '.[]' "$SNAPSHOT_DIR/materials.json" | while read m; do
  soroban contract invoke \
    --id "$NEW_CONTRACT" --source "$ADMIN_KEY" --network "$NETWORK" \
    -- recycle_waste \
    --waste_type "$(echo $m | jq -r '.waste_type')" \
    --weight     "$(echo $m | jq -r '.weight')" \
    --recycler   "$(echo $m | jq -r '.submitter')" \
    --latitude 0 --longitude 0
done

# Step C: Migrate incentives
echo "[3/4] Migrating incentives..."
jq -c '.[]' "$SNAPSHOT_DIR/incentives.json" | while read inc; do
  soroban contract invoke \
    --id "$NEW_CONTRACT" --source "$ADMIN_KEY" --network "$NETWORK" \
    -- create_incentive \
    --rewarder      "$(echo $inc | jq -r '.rewarder')" \
    --waste_type    "$(echo $inc | jq -r '.waste_type')" \
    --reward_points "$(echo $inc | jq -r '.reward_points')" \
    --budget        "$(echo $inc | jq -r '.remaining_budget')"
done

# Step D: Verify counts match
echo "[4/4] Verifying migration..."
OLD_METRICS=$(soroban contract invoke --id "$OLD_CONTRACT" --source "$ADMIN_KEY" --network "$NETWORK" -- get_metrics)
NEW_METRICS=$(soroban contract invoke --id "$NEW_CONTRACT" --source "$ADMIN_KEY" --network "$NETWORK" -- get_metrics)

echo "Old metrics: $OLD_METRICS"
echo "New metrics: $NEW_METRICS"

echo "=== Migration complete ==="
```

### Step 4: Verify data integrity

```bash
# Compare participant counts
OLD_COUNT=$(soroban contract invoke --id $OLD_CONTRACT --network $NETWORK -- get_all_participants | jq 'length')
NEW_COUNT=$(soroban contract invoke --id $NEW_CONTRACT --network $NETWORK -- get_all_participants | jq 'length')

if [ "$OLD_COUNT" != "$NEW_COUNT" ]; then
  echo "ERROR: Participant count mismatch (old=$OLD_COUNT, new=$NEW_COUNT)"
  exit 1
fi

echo "Participant count verified: $NEW_COUNT"

# Compare global metrics
soroban contract invoke --id $OLD_CONTRACT --network $NETWORK -- get_metrics
soroban contract invoke --id $NEW_CONTRACT --network $NETWORK -- get_metrics
```

### Step 5: Update configuration

```bash
# Update frontend environment
export VITE_CONTRACT_ID=$NEW_CONTRACT
export VITE_NETWORK=$NETWORK

# Rebuild and redeploy frontend
cd frontend
npm run build
npm run preview

# Update indexer
cat > indexer/.env <<EOF
CONTRACT_ID=$NEW_CONTRACT
NETWORK=$NETWORK
EOF
npm run restart
```

### Step 6: Monitor and validate

```bash
# Watch live events
soroban contract events \
  --id $NEW_CONTRACT \
  --network $NETWORK \
  --start-ledger <current_ledger>

# Health check
soroban contract invoke --id $NEW_CONTRACT --network $NETWORK -- get_metrics
soroban contract invoke --id $NEW_CONTRACT --network $NETWORK -- get_supply_chain_stats
```

---

## Rollback Procedures

### Immediate Rollback (< 1 hour since cutover)

If critical issues appear immediately after switching traffic to the new contract:

```bash
# 1. Revert frontend to old contract ID
export VITE_CONTRACT_ID=$OLD_CONTRACT
cd frontend && npm run build && npm run preview

# 2. Revert indexer
sed -i "s/$NEW_CONTRACT/$OLD_CONTRACT/g" indexer/.env
cd indexer && npm run restart

# 3. Notify users
echo "Service temporarily reverted to previous version. Investigating issues."

# 4. Investigate new contract logs
soroban contract events \
  --id $NEW_CONTRACT \
  --network $NETWORK \
  --start-ledger <cutover_ledger>
```

No on-chain state rollback is required as the old contract is still intact.

### Partial Data Rollback (1–24 hours)

If data inconsistency is detected but some transactions occurred on the new contract:

1. **Stop all write operations** on the new contract (pause it if pausing is supported)

   ```bash
   soroban contract invoke \
     --id $NEW_CONTRACT \
     --source $ADMIN_KEY \
     --network $NETWORK \
     -- pause_contract
   ```

2. **Identify affected transactions** by querying the event log

   ```bash
   soroban contract events \
     --id $NEW_CONTRACT \
     --network $NETWORK \
     --start-ledger <cutover_ledger> \
     --count 1000 > affected_events.json
   ```

3. **Apply compensating transactions** on the old contract to reflect new-contract actions
   that must be preserved, OR accept data loss for the rollback window.

4. **Switch traffic back** to the old contract (see Immediate Rollback above).

5. **Post-mortem** the root cause before re-attempting migration.

### Full Data Rollback (> 24 hours)

For major data corruption requiring a full revert:

1. **Pause the new contract**

   ```bash
   soroban contract invoke \
     --id $NEW_CONTRACT \
     --source $ADMIN_KEY \
     --network $NETWORK \
     -- pause_contract
   ```

2. **Re-deploy the old WASM binary** to a new contract address

   ```bash
   soroban contract deploy \
     --wasm old_versions/stellar_scavngr_contract.v1.optimized.wasm \
     --source $ADMIN_KEY \
     --network $NETWORK
   ```

3. **Replay state from pre-migration snapshot** using the migration scripts in reverse

4. **Verify restoration** against the original snapshot metrics

5. **Update all configuration** to point to the restored contract

---

## Testing Requirements

All of the following must pass before cutover to production.

### Functional Tests

| Test Case | Expected Result |
|-----------|----------------|
| Register participant (all 3 roles) | Participant stored and retrievable |
| Submit waste (all 7 types) | Waste stored with correct `expires_at` |
| Transfer Recycler → Collector | Ownership transferred; transfer history updated |
| Transfer Collector → Manufacturer | Ownership transferred |
| Confirm waste | `is_confirmed = true` |
| Create incentive | Incentive active; budget tracked |
| Claim incentive reward | Budget decremented; tokens queued |
| Set waste TTL | TTL stored per type |
| Expired waste blocked on transfer | Transfer returns `WasteExpired` error |
| Cleanup expired wastes | Expired items deactivated; count returned |
| Grade waste (Collector) | `grade` updated; history appended |
| Grade waste (Recycler) | Panics with auth error |
| Get wastes by grade | Correct filter applied |
| Admin operations | Admin-only functions reject non-admins |

### Data Integrity Tests

| Check | Command |
|-------|---------|
| Participant count matches old contract | `get_all_participants \| jq 'length'` |
| Total waste count matches | `get_metrics \| jq '.total_wastes_count'` |
| Incentive count matches | `get_all_incentives \| jq 'length'` |
| Transfer history preserved | `get_transfer_history <waste_id>` |
| Stats accurate | `get_stats <participant_address>` |

### Performance Tests

```bash
# Measure average invocation latency
for i in {1..50}; do
  time soroban contract invoke \
    --id $NEW_CONTRACT \
    --network $NETWORK \
    -- get_metrics
done 2>&1 | grep real | awk '{print $2}'
```

Target: < 2 seconds average response time.

### Regression Tests

Run the full contract test suite against the new deployment:

```bash
cd stellar-contract
cargo test --release 2>&1 | tee test_results.log
grep -E "FAILED|PASSED|test result" test_results.log
```

All tests must pass with `0 failures`.

---

## Verification Checklist

### Pre-Migration

- [ ] Snapshot files exist and are non-empty in `./snapshot/`
- [ ] New WASM binary builds without warnings
- [ ] Optimised WASM size < 200 KB
- [ ] New contract deployed to testnet
- [ ] Admin initialised on new contract
- [ ] Full test suite passes on testnet migration

### Data Migration

- [ ] All participants migrated (count matches)
- [ ] All waste items accessible in new contract
- [ ] All incentives active and functional
- [ ] Transfer history entries match snapshot
- [ ] Carbon credit totals match within 0.1 %
- [ ] Participant stats match within 0.1 %
- [ ] No orphaned waste IDs (gaps in sequence)

### Post-Migration

- [ ] Waste submission workflow end-to-end
- [ ] Transfer workflow end-to-end (all three routes)
- [ ] Incentive creation and reward claim end-to-end
- [ ] Waste expiration triggers correctly
- [ ] Grading workflow (Collector and Manufacturer)
- [ ] Admin functions operational
- [ ] Frontend connects to new contract ID
- [ ] Indexer processing events from new contract
- [ ] Monitoring dashboards updated to new contract ID
- [ ] Alerts configured for new contract

### Production Go-Live

- [ ] Low-traffic window confirmed
- [ ] Rollback plan confirmed and rehearsed
- [ ] On-call engineer available for 2 hours post-cutover
- [ ] User communication sent
- [ ] Post-migration metrics captured 30 min after cutover

---

## FAQ

**Q: How long does migration take?**
A: Depends on data volume. 100 participants + 1,000 waste items typically takes 15–30 min.
Major releases with full data transformation may take 1–2 hours.

**Q: Will users experience downtime?**
A: Minor versions (no data migration): zero downtime. Major versions: plan for a 1-hour
maintenance window during which waste submission and transfers are paused.

**Q: Can I migrate without losing data?**
A: Yes, all migration scripts preserve data. Always take a full snapshot before migrating.

**Q: What if migration fails partway through?**
A: Stop immediately and switch traffic back to the old contract (Immediate Rollback). The old
contract is unaffected. Investigate logs and re-run the failed migration step in isolation.

**Q: How do I verify migration success?**
A: Run the full Verification Checklist and compare metrics between old and new contracts using
the provided verification commands.

**Q: Can I migrate in production?**
A: Yes, but always schedule during low-traffic periods and have the rollback plan ready and
tested. Prefer blue/green deployment: keep the old contract live until the new one is fully
verified. See: [Blue/Green Deployment](./BLUE_GREEN_DEPLOYMENT.md).

**Q: Do I need to migrate for a v2.1.x upgrade?**
A: No. v2.1.x adds the expiration and grading systems additively. Existing waste items default
to `expires_at = 0` (no expiry) and `grade = C`. No state transformation is needed.

---

## Version-Specific Notes

### v1.0.x → v1.1.x
- No data migration required
- New waste type (Organic) available for new submissions only
- Configurable reward percentages — run `set_percentages` once after upgrade
- Backward compatible with existing clients

### v1.1.x → v1.2.x
- No data migration required
- Performance improvements in storage layout
- New query functions (search, filtering)
- Backward compatible

### v1.x → v2.0.0
- **BREAKING**: Storage format changed for participants, wastes, and incentives
- **REQUIRED**: Run migration scripts in order (participants → wastes → incentives)
- **REQUIRED**: Update all frontend and indexer configuration
- **REQUIRED**: Verify all data with the Verification Checklist

### v2.0.x → v2.1.x
- Expiration system added: new `set_waste_ttl`, `get_waste_ttl`, `cleanup_expired_wastes`
- Grading system added: `WasteGrade`, `set_waste_grade`, `get_grade_history`, `get_wastes_by_grade`
- Existing waste items: `expires_at = 0` (no expiry), `grade = C` (default)
- No data migration required; configure expiry TTLs post-upgrade via `set_waste_ttl`

---

## Support

For migration issues:

1. Check this guide's FAQ section
2. Review contract event logs: `soroban contract events --id <CONTRACT_ID>`
3. Check contract logs: `soroban contract logs <CONTRACT_ID>`
4. Consult [Disaster Recovery Plan](./DISASTER_RECOVERY_PLAN.md)
5. Open an issue in the repository with: contract IDs, network, error message, and relevant
   snapshot excerpts

---

## Related Documentation

- [Disaster Recovery Plan](./DISASTER_RECOVERY_PLAN.md)
- [Blue/Green Deployment](./BLUE_GREEN_DEPLOYMENT.md)
- [Deployment Guide](./KUBERNETES_DEPLOYMENT.md)
- [API Documentation](./API_DOCUMENTATION.md)
- [Glossary](./GLOSSARY.md)
- [Architecture](./ARCHITECTURE.md)
