# Contract Upgrade Runbook

This document describes the procedure for safely upgrading the Scavngr Soroban smart contract with zero downtime.

## Overview

Upgrades follow a 5-stage pipeline:

```
Pending → Validating → MigrationReady → Deploying → Completed
                              ↓
                          RolledBack (on failure)
```

The `ContractUpgradeService` (backend/src/services/contract_upgrades.rs) automates every stage.

---

## Pre-upgrade Checklist

- [ ] Identify the current contract version (`get_metrics()` or `get_contract_version()`)
- [ ] Build and hash the new WASM: `soroban contract optimize --wasm <file>`
- [ ] Run full test suite: `cargo test`
- [ ] Draft a `MigrationPlan` for every changed storage key
- [ ] Snapshot current state using `create_snapshot(plan_id, from_version, wasm_hash, state)`
- [ ] Notify users of scheduled maintenance window (use notification delivery service)

---

## Step-by-step Upgrade Procedure

### 1. Create upgrade plan

```rust
let plan = svc.create_plan(
    "v2.0.0 – Add waste_grade field",
    "Adds waste_grade storage key",
    1,        // from_version
    2,        // to_version
    "abc123…", // WASM hash
    Some(migration_plan),
);
```

### 2. Validate

```rust
let report = svc.validate(&plan.id).await?;
// All checks must pass: version_increment, wasm_hash_present, migration_version_match
```

**What is checked:**

| Check                     | Description                   |
| ------------------------- | ----------------------------- |
| `version_increment`       | `to_version > from_version`   |
| `wasm_hash_present`       | WASM hash is non-empty        |
| `migration_version_match` | Migration plan versions align |

### 3. Take rollback snapshot

```rust
svc.create_snapshot(&plan.id, current_version, &current_wasm_hash, current_state);
```

Always do this **before** migration.

### 4. Run migration

```rust
let result = svc.run_migration(&plan.id, &mut contract_state).await?;
// result.steps_failed must be 0
```

Supported transforms: `Copy`, `Rename(new_key)`, `Delete`, `Custom(handler_id)`.

### 5. Deploy WASM on-chain

```bash
soroban contract upgrade \
  --wasm target/wasm32-unknown-unknown/release/<new>.optimized.wasm \
  --source <admin_key> \
  --network testnet \
  --id <contract_id>
```

### 6. Mark complete

```rust
svc.complete_upgrade(&plan.id)?;
```

---

## Rollback Procedure

If any step fails after a snapshot was captured:

```rust
// Restores state and marks plan as RolledBack
let snap = svc.rollback(&plan.id, &mut contract_state)?;
```

Then redeploy the previous WASM:

```bash
soroban contract upgrade \
  --wasm <previous>.optimized.wasm \
  --source <admin_key> \
  --network testnet \
  --id <contract_id>
```

Verify the rollback succeeded:

```bash
soroban contract invoke --id <contract_id> --fn get_contract_version
# Should return the from_version value from the snapshot
```

---

## Testing Upgrades

1. **Unit tests** – `cargo test -p scavenger-backend` exercises all service paths including failure and rollback scenarios.
2. **Integration test** – Deploy to `standalone` network, execute upgrade, verify state.
3. **Property check** – Validate migration is bijective (no data loss) for Rename/Copy transforms.

---

## Monitoring

After a completed upgrade:

- Watch Prometheus alert `contract_upgrade_failed` (config/prometheus-rules.yml)
- Check backend logs for `[contract_upgrades]` tracing spans
- Query `svc.get_plan(plan_id)` to inspect the full event log

---

## Common Errors

| Error                                        | Cause                       | Fix                                              |
| -------------------------------------------- | --------------------------- | ------------------------------------------------ |
| `ValidationFailed`                           | `to_version ≤ from_version` | Increment `to_version`                           |
| `MigrationError: must be in migration_ready` | Skipped validation step     | Run `validate()` first                           |
| `RollbackError: No snapshot found`           | Snapshot not created        | Always call `create_snapshot()` before migration |
| `InvalidTransition`                          | Plan is already terminal    | Create a new plan                                |
