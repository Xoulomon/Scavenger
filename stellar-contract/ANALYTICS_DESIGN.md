# Unified Analytics Module Design (#1514)

## Design Goals

1. **Single source of truth** for analytics logic
2. **Minimal on-chain storage** for performance
3. **Clear separation** between on-chain counters and off-chain aggregation
4. **Backward compatibility** with existing GlobalMetrics and RecyclingStats types
5. **Zero breaking changes** to contract ABI (since module is currently unused)

## Module Structure

### New `analytics.rs` Organization

```
analytics.rs (consolidated)
├── Type Definitions (unchanged from current)
│   ├── GlobalMetrics
│   ├── RecyclingStats
│   ├── WasteGrade
│   └── Other supporting types
├── On-Chain Mutation Helpers (from contract_analytics.rs)
│   ├── GlobalMetrics impl methods
│   └── RecyclingStats impl methods
├── Storage Integration (NEW)
│   ├── Storage key constructors
│   ├── Persistence functions
│   └── Migration helpers
└── Tests (expanded)
    ├── Mutation tests
    ├── Storage tests
    └── Migration tests
```

### What Gets Removed

From the current `analytics.rs`, **remove**:
- `ReportType` enum (6 variants)
- `AnalyticsDataPoint` struct
- `AnalyticsReport` struct
- `CustomQuery` struct
- `AggregationType` enum
- `AnalyticsEngine` struct and impl

**Rationale**: These are complex reporting constructs that belong in off-chain indexer, not on-chain smart contract. They add bloat without usage.

### What Gets Added

To the consolidated `analytics.rs`, **add**:
- Storage key constructors for persisting GlobalMetrics and RecyclingStats
- Mutation methods that also persist state
- Migration helpers for contract upgrades
- Comprehensive tests

## Storage Key Design

### New Analytics Storage Keys

Add to `storage_keys.rs`:

```rust
/// Global metrics snapshot (issue #1514)
pub const GLOBAL_METRICS_SNAPSHOT: Symbol = Symbol::from_static_str("GMTR_SNAP");

/// Per-participant recycling stats (issue #1514)
pub fn recycling_stats_key(address: &Address) -> (String, Address) {
    ("recycling_stats", address.clone())
}

/// Last analytics update timestamp (issue #1514)
pub const ANALYTICS_LAST_UPDATE: Symbol = Symbol::from_static_str("ANAL_UPD");

/// Analytics batch counter for periodic updates (issue #1514)
pub const ANALYTICS_BATCH_COUNT: Symbol = Symbol::from_static_str("ANAL_BAT");
```

### Storage Layout

**Instance Storage** (small, frequently accessed):
- `ANALYTICS_LAST_UPDATE` (u64): Ledger timestamp of last snapshot
- `ANALYTICS_BATCH_COUNT` (u64): Counter for batching updates

**Persistent Storage** (per-participant):
- `("recycling_stats", address)` → `RecyclingStats`
- `GLOBAL_METRICS_SNAPSHOT` → `GlobalMetrics` (one global record)

### Rationale

- **Instance storage** for metadata: Keeps these small values in the fast path
- **Persistent storage** for actual data: Allows historical tracking and migration
- **Snapshots instead of per-tx writes**: Only write analytics periodically (e.g., every 10 transactions) to control costs
- **Per-participant stats**: Enables leaderboards and individual reputation tracking

## API Design

### Public Functions

```rust
impl GlobalMetrics {
    /// Increments the counter for the given grade.
    pub fn record_grade(&mut self, grade: WasteGrade);

    /// Records a new active waste item.
    pub fn record_waste_registered(&mut self);

    /// Records a waste item being deactivated.
    pub fn record_waste_deactivated(&mut self);

    /// Records a waste item as expired.
    pub fn record_waste_expired(&mut self);

    /// Accumulates token rewards into global totals.
    pub fn record_tokens_earned(&mut self, tokens: u128);

    /// Accumulates carbon credits into global totals.
    pub fn record_carbon_credits(&mut self, credits: u128);

    /// Persists the current state to contract storage (NEW).
    pub fn persist(&self, env: &Env) -> Result<(), String>;

    /// Loads the latest snapshot from storage (NEW).
    pub fn load_snapshot(env: &Env) -> Option<Self>;
}

impl RecyclingStats {
    // Existing functions...
    
    /// Persists this participant's stats to storage (NEW).
    pub fn persist(&self, env: &Env) -> Result<(), String>;

    /// Loads stats for a participant from storage (NEW).
    pub fn load(env: &Env, address: &Address) -> Option<Self>;
}

// Module-level helpers (NEW)
pub mod persistence {
    /// Saves current global metrics to snapshot storage.
    pub fn save_global_metrics(env: &Env, metrics: &GlobalMetrics) -> Result<(), String>;

    /// Retrieves latest global metrics snapshot.
    pub fn get_global_metrics(env: &Env) -> Option<GlobalMetrics>;

    /// Saves participant recycling stats.
    pub fn save_recycling_stats(env: &Env, stats: &RecyclingStats) -> Result<(), String>;

    /// Retrieves participant recycling stats.
    pub fn get_recycling_stats(env: &Env, address: &Address) -> Option<RecyclingStats>;

    /// Triggers periodic analytics update if threshold met (NEW).
    pub fn try_periodic_update(env: &Env, metrics: &GlobalMetrics) -> Result<(), String>;
}

// Migration helpers (NEW)
pub mod migration {
    /// Initializes analytics storage from existing on-chain state (for contract upgrades).
    pub fn initialize_from_onchain(env: &Env) -> Result<(), String>;

    /// Records migration completion for audit trail.
    pub fn record_migration_snapshot(env: &Env, timestamp: u64) -> Result<(), String>;
}
```

## Mutation Strategy

### Scenario 1: On Every Operation (Current)

```rust
// When waste is registered
let mut metrics = env.storage().instance().get(&GLOBAL_METRICS_SNAPSHOT)
    .unwrap_or_default();
metrics.record_waste_registered();
metrics.persist(env)?;  // Write to storage
```

**Cost**: +1 storage write per operation  
**Benefit**: Always-current metrics

### Scenario 2: Periodic Batching (Recommended)

```rust
// When waste is registered
let mut metrics = env.storage().instance().get(&GLOBAL_METRICS_SNAPSHOT)
    .unwrap_or_default();
metrics.record_waste_registered();

// Only persist if we've crossed a batch threshold
persistence::try_periodic_update(env, &metrics)?;
```

**Cost**: +1 storage write per ~N operations (configurable)  
**Benefit**: Reduced storage fees, still maintains audit trail

### Decision: Use Periodic Batching

**Rationale**:
- Soroban storage fees are per-ledger-entry
- Writing every transaction increases contract costs
- Periodic snapshots provide sufficient audit trail
- Off-chain indexer has complete event history anyway

## Data Flow

### Recording Operations

```
Contract Function (e.g., register_waste)
    ↓
Modify GlobalMetrics in memory
    ↓
Modify RecyclingStats in memory
    ↓
Check if periodic update threshold met
    ↓ (yes) → Persist to storage + increment batch counter
    ↓ (no)  → Return (data lost if contract fails)
    ↓
Emit event (indexer captures this)
    ↓
Return to caller
```

### Reading Metrics

```
analytics::get_global_metrics(env)
    ↓
Load from GLOBAL_METRICS_SNAPSHOT
    ↓
Return Option<GlobalMetrics>
```

## Backward Compatibility

### What Stays the Same

- `GlobalMetrics` struct (unchanged)
- `RecyclingStats` struct (unchanged)
- All public type exports from `lib.rs`
- Contract ABI (no breaking changes)

### What Changes (Internal)

- `contract_analytics.rs` deleted
- Complex reporting types removed from `analytics.rs`
- New storage integration added

### No Migration Needed For

- Any deployed contract (module is currently unused)
- External consumers (types are still exported)
- Any code depending on the removed reporting types (nothing uses them)

## Testing Strategy

### Unit Tests

1. **Mutation tests** (existing, no changes):
   - `test_record_grade`
   - `test_record_waste_registered`
   - `test_record_tokens_earned`
   - etc.

2. **Storage tests** (NEW):
   - `test_persist_global_metrics`
   - `test_load_global_metrics`
   - `test_persist_recycling_stats`
   - `test_periodic_update_threshold`
   - `test_storage_roundtrip`

3. **Migration tests** (NEW):
   - `test_initialize_from_onchain`
   - `test_migration_snapshot`

### Integration Tests

1. **Storage write counting**:
   - Measure storage writes before consolidation
   - Measure storage writes after consolidation
   - Compare per-transaction cost

2. **Overflow protection**:
   - Test saturating_add behavior
   - Verify no panics on u128/u64 overflow

3. **Consistency**:
   - Run full contract workflow
   - Verify analytics snapshot stays consistent

## Configuration

### Periodic Update Threshold

```rust
/// Analytics snapshot frequency: every N transactions (configurable)
const ANALYTICS_BATCH_SIZE: u64 = 10;
```

This can be adjusted based on deployment feedback to balance:
- **Too frequent** (e.g., every tx): High storage costs
- **Too infrequent** (e.g., every 1000 tx): Risk of data loss in contract failure

**Recommended initial value**: 10 transactions

## Implementation Order

1. **Add storage keys** to `storage_keys.rs`
2. **Merge helper functions** from `contract_analytics.rs` into `analytics.rs`
3. **Remove complex reporting types** from `analytics.rs`
4. **Add storage integration** functions
5. **Add migration helpers** for upgrade path
6. **Add comprehensive tests**
7. **Update lib.rs imports**
8. **Delete contract_analytics.rs**
9. **Update documentation**

## Risk Mitigation

### Risk: Data Loss on Contract Failure

**Mitigation**: Periodic batching ensures snapshot is written, but not after every mutation.  
**Severity**: Low (off-chain indexer has complete event history)

### Risk: Off-Chain/On-Chain Drift

**Mitigation**: Use off-chain indexer as authoritative source for reporting.  
**Severity**: Low (snapshots are only for on-chain queries)

### Risk: Storage Bloat

**Mitigation**: Periodic batching + configurable batch size prevents per-tx overhead.  
**Severity**: Low (can be tuned)

### Risk: Breaking Existing Code

**Mitigation**: Types remain unchanged; only internal module structure changes.  
**Severity**: None (module is unused)

## Success Criteria

1. ✓ Single consolidated `analytics.rs` module
2. ✓ No duplicate helper functions
3. ✓ Storage integration for GlobalMetrics and RecyclingStats
4. ✓ Periodic batching prevents per-tx cost explosion
5. ✓ All existing tests pass
6. ✓ New tests for storage operations
7. ✓ Storage write count measured and documented
8. ✓ Zero breaking changes to contract ABI
9. ✓ Documentation updated

## Future Enhancements

(Out of scope for this PR):

1. **Off-chain reporting**: Extend TypeScript indexer to compute reports from events
2. **Analytics queries**: Add on-chain query entrypoints if needed
3. **Dashboard integration**: Connect UI to on-chain metrics via storage queries
4. **Reputation decay**: Integrate analytics with participant reputation system
