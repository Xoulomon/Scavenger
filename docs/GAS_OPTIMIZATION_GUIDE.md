# Gas Optimization Guide

## Summary of Optimizations

### 1. Audit Log — Events Instead of Persistent Vec

**Before:** `AuditLogService::log_action` appended to a `Vec<AuditLog>` stored under a single persistent key. Every call loaded the entire Vec from storage, pushed one entry, and wrote the entire Vec back. Cost grows linearly with log size.

**After:** Each audit entry is emitted as a contract event via `env.events().publish()`. Only a u64 counter is stored in instance storage. Cost is O(1) regardless of log history.

**Savings:** ~90% reduction in gas for audited operations once the log accumulates thousands of entries.

### 2. RewardConfig — Single Storage Read

`collector_percentage` and `owner_percentage` are stored as a single `RewardConfig` struct under the `RWD_CFG` key. One `storage.get` instead of two per reward distribution call.

### 3. Instance Storage Consolidation

Frequently accessed state (admins, reward config, pause flag) is stored in **instance storage** which has lower access cost than persistent storage for small values.

## Benchmarking

Run the existing benchmark suite to compare before/after:

```bash
cd stellar-contract
cargo test --test performance_test -- --nocapture
```

Key metrics from `docs/archive/stellar-contract/BENCHMARK_RESULTS.md`:
- Waste registration: measure `cpu_instructions` in gas snapshots
- Reward distribution: check `test_gas_incentive_workflow.1.json`

## Guidelines for Future Development

1. **Prefer events over persistent storage** for append-only logs.
2. **Batch storage reads** — read all needed keys upfront, avoid multiple round trips.
3. **Use instance storage** for small, frequently accessed state (< 1KB).
4. **Use persistent storage** for large data that is rarely read.
5. **Avoid Vec growth in hot paths** — growing Vecs require full re-serialization on write.
