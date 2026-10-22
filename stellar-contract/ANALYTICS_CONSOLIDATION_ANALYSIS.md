# Analytics Modules Consolidation Analysis (#1514)

## Executive Summary

The Scavenger contract has two analytics modules that serve different purposes but create confusion and duplicate functionality. This document presents the detailed analysis for consolidating them.

### Current Status
- **Both modules exist but are not actively used** in production contract logic
- **contract_analytics.rs**: Debug-only module (gated behind `#[cfg(feature = "debug")]`), contains helper methods for mutating GlobalMetrics and RecyclingStats records
- **analytics.rs**: Contains complex reporting framework types (AnalyticsReport, CustomQuery, AnalyticsEngine) exported in the public API but with no actual callers

## Module Comparison

### 1. contract_analytics.rs (45 LOC)

**Purpose**: Lightweight in-memory aggregation helpers for state mutations  
**Feature Gate**: `#[cfg(feature = "debug")]` — excluded from WASM release builds  
**Exports**: None (internal helpers only)

**Functions**:
- `GlobalMetrics::record_grade(grade)` - Increments grade counters (A/B/C/D)
- `GlobalMetrics::record_waste_registered()` - Tracks active waste count
- `GlobalMetrics::record_waste_deactivated()` - Decrements active waste
- `GlobalMetrics::record_waste_expired()` - Tracks expiration
- `GlobalMetrics::record_tokens_earned(amount)` - Accumulates token rewards
- `GlobalMetrics::record_carbon_credits(amount)` - Accumulates carbon credits
- `record_waste_type_submission(stats, waste_type, weight_grams)` - Tallies submissions by waste type
- `record_earnings(stats, tokens, carbon_credits)` - Updates participant points and carbon credits
- `refresh_recycling_rate(stats)` - Recalculates recycling rate in basis points

**Storage Operations**: None (in-memory mutations only)

**Data Structures Used**:
- `GlobalMetrics` - struct with counters for grades, waste, tokens, carbon
- `RecyclingStats` - per-participant statistics

### 2. analytics.rs (348 LOC)

**Purpose**: Complex multi-dimensional analytics reports and query framework  
**Feature Gate**: None (production code)  
**Exports**: Yes (pub use in lib.rs): `AnalyticsReport`, `ReportType`, `CustomQuery`, `AggregationType`, `AnalyticsDataPoint`, `AnalyticsEngine`

**Data Structures**:
- `ReportType` enum (6 types: ParticipantActivity, WasteProcessing, IncentivePerformance, SupplyChain, Financial, EnvironmentalImpact)
- `AnalyticsDataPoint` - Timestamped metric with value and label
- `AnalyticsReport` - Full report with type, creator, period, data point count, summary
- `CustomQuery` - Parameterized query with filters, aggregation type, execution tracking
- `AggregationType` enum (6 types: Sum, Average, Count, Min, Max, Percentile)
- `AnalyticsEngine` - Static utility methods for calculations

**Storage Operations**: None currently

**Functions**:
- `AnalyticsEngine::calculate_average(values)` - Calculates mean
- `AnalyticsEngine::find_min(values)` - Finds minimum
- `AnalyticsEngine::find_max(values)` - Finds maximum
- `AnalyticsEngine::calculate_sum(values)` - Calculates sum
- `AnalyticsEngine::count_values(values)` - Counts values
- `AnalyticsEngine::calculate_percentile(values, percentile)` - Calculates percentile

## Storage Key Analysis

### GlobalMetrics Storage Keys (Current)
From `storage_keys.rs` and `lib.rs`, the following instance storage keys exist for metrics:
- `TOTAL_TOKENS` (`TOT_TKN`) - u128
- `TOTAL_CARBON` (`TOT_CARB`) - u128
- `TOTAL_WEIGHT` (`TOT_WGT`) - u128

However, these are **not accessed by contract_analytics.rs or analytics.rs**. They exist in storage_keys.rs as declarations but are not used.

### RecyclingStats Storage Keys (Current)
From `storage_keys.rs`, the per-participant stats key:
- `stats_key(address)` → `("stats", address.clone())`

This is accessible via the helper but not actively used in the contract logic.

## Usage Analysis

### Where These Modules Are Actually Used

**contract_analytics.rs**:
- Declared in `lib.rs` line 40 with feature gate `#[cfg(feature = "debug")]`
- No grep results for invocations in the codebase
- Zero callers

**analytics.rs**:
- Declared in `lib.rs` line 15 (production module)
- Public exports in `lib.rs` line 128: `AnalyticsReport`, `ReportType`, `CustomQuery`, `AggregationType`, `AnalyticsDataPoint`, `AnalyticsEngine`
- No grep results for function calls from these types
- Zero callers

### Conclusion
Both modules are **abandoned code** that provides infrastructure without integration. Neither is actively used in the contract's business logic.

## Architectural Overlap

### On-Chain vs Off-Chain Analytics Strategy

The codebase has the following analytics infrastructure:
1. **On-chain lightweight counters** (storage_keys.rs): `TOTAL_TOKENS`, `TOTAL_CARBON`, `TOTAL_WEIGHT`
2. **Per-participant stats** (types.rs: `RecyclingStats`): Aggregations per address
3. **Complex reporting framework** (analytics.rs): Multi-dimensional reports, custom queries
4. **Off-chain indexer**: TypeScript backend service that ingests contract events

**Current Problem**: The complex reporting framework in `analytics.rs` has no integration path. It's a design that was never completed.

### Recommended Architecture

- **On-chain**: Minimal counters only (global metrics, per-participant stats)
- **Off-chain**: All aggregation, reporting, custom queries
- **Consolidation**: Merge helper functions into a single `analytics.rs` focused on on-chain state mutations

## Data Consistency Risks

### Potential Issues with Current Approach
1. **Duplicate counters**: Both `GlobalMetrics` (in contract_analytics.rs logic) and individual storage keys (TOTAL_TOKENS, TOTAL_CARBON) could drift if one is updated without the other
2. **Unused data structures**: RecyclingStats and GlobalMetrics are not persisted, making replay or auditing difficult
3. **Complex reporting has no persistence**: CustomQuery, AnalyticsReport have no storage integration, making them unusable

## Consolidation Strategy

### Phase 1: Keep Single On-Chain Module (Recommended)

**New unified `analytics.rs`**:
1. Move all helper functions from `contract_analytics.rs` into `analytics.rs`
2. Remove the `ReportType`, `CustomQuery`, `AnalyticsEngine` complex reporting classes
3. Focus on `GlobalMetrics` and `RecyclingStats` mutations
4. Add storage integration for persisting analytics snapshots
5. Define clear migration path for old storage

### Phase 2: Off-Chain Aggregation

Defer complex reporting to the TypeScript indexer, which already ingests events and maintains its own analytics database.

### Phase 3: Documentation & Migration

Update CONTRACT_DOCUMENTATION.md with:
- Removed entrypoints/exports (none in this case, since nothing uses it)
- New on-chain analytics storage keys
- Migration notes for any deployed contracts (none, since it's unused)

## Storage Write Impact

### Before Consolidation
- No actual storage writes for analytics (module is unused)
- Storage keys defined but unreferenced

### After Consolidation
- **Potential increase**: If we start persisting analytics snapshots on every transaction
- **Mitigation**: Design a batching strategy that writes snapshots periodically (e.g., every N transactions) rather than on every operation

## Implementation Checklist

- [ ] Consolidate `contract_analytics.rs` helpers into single `analytics.rs`
- [ ] Remove unused complex reporting types (ReportType, CustomQuery, AggregationType, AnalyticsEngine)
- [ ] Define storage keys for persisting GlobalMetrics and RecyclingStats snapshots
- [ ] Implement migration helpers for contracts that may have old data
- [ ] Update `lib.rs` imports (remove contract_analytics feature gate export)
- [ ] Add unit tests for consolidated functions
- [ ] Add integration tests measuring storage writes
- [ ] Update CONTRACT_DOCUMENTATION.md
- [ ] Verify no regressions in existing tests
- [ ] Code review and approval

## Estimated Impact

- **On-chain storage**: +50-100 bytes per periodic analytics update (1-2 additional storage keys)
- **Transaction cost**: No impact per-transaction (no analytics written to every tx); only periodic updates will incur cost
- **Code size**: -300 LOC (removing unused complex reporting framework)
- **Maintainability**: +Improved clarity by having single module instead of two competing designs

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Breaking change for deployed contracts | No impact—both modules unused in production |
| Storage bloat from analytics snapshots | Implement periodic batching, not per-transaction writes |
| Data loss if analytics not persisted | Design migration script to capture current state at upgrade time |
| Off-chain indexer out of sync | Keep event emissions as source of truth; off-chain reads events |

## Recommendations

1. **Consolidate immediately**: Both modules are unused, so this is low-risk
2. **Keep minimal on-chain**: Only persist periodic snapshots, not every operation
3. **Use off-chain indexer**: All complex queries, reporting, and custom queries should go to the TypeScript backend
4. **Clear audit trail**: Document this consolidation in a MIGRATION.md file for future developers
