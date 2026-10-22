# Scavenger Smart Contract — Internal Notes

This page is for contributors working on `stellar-contract/`. It is not the
consumer reference. External SDK users should read
[sdk-api-reference.md](./sdk-api-reference.md), which lists every public
entrypoint with its arguments, auth requirements and error codes.

- **Source of truth:** `stellar-contract/src/lib.rs` (entrypoints) and
  `stellar-contract/src/errors.rs` (error codes).
- **Module layout:** [stellar-contract/ARCHITECTURE.md](../stellar-contract/ARCHITECTURE.md)
  and [ADR-0013](./adr/0013-contract-module-layout.md).
- **Previous full text:** the long-form function reference was retired in favour of
  the generated tables. It is kept at
  [archive/CONTRACT_DOCUMENTATION-pre-1445.md](./archive/CONTRACT_DOCUMENTATION-pre-1445.md).

## Internal-only entrypoints

<!-- BEGIN GENERATED: internal-entrypoints -->

Generated from `stellar-contract/src/lib.rs`. 1 entrypoints are documented as internal-only and are excluded from the consumer reference in [sdk-api-reference.md](./sdk-api-reference.md). Do not edit this table by hand.

| Entrypoint | Arguments | Returns | Requires auth | Errors | Note |
|---|---|---|---|---|---|
| `record_performance_metric` | `admin: Address`, `gas_used: u64`, `is_success: bool` | `()` | `admin` | — | Record a performance metric (internal helper or admin-only). |

<!-- END GENERATED: internal-entrypoints -->

## Regenerating the reference

```bash
python3 scripts/generate-contract-reference.py           # rewrite both docs
python3 scripts/generate-contract-reference.py --check   # fail if they are stale (CI)
```

## Recent Consolidations & Refactorings

### Issue #1514: Analytics Module Consolidation

**Status**: Completed  
**Date**: October 2026

#### What Changed

- **Consolidated**: `contract_analytics.rs` and `analytics.rs` merged into single `analytics.rs` module
- **Removed**: Complex reporting types (`ReportType`, `AnalyticsReport`, `CustomQuery`, `AggregationType`, `AnalyticsEngine`)
- **Added**: Storage integration for analytics persistence and periodic batching

#### Why

Both modules were unused in production:
- `contract_analytics.rs` (65 LOC): Debug-only helpers with no callers
- `analytics.rs` (348 LOC): Complex reporting framework exported but never instantiated

Neither module persisted data to storage, making them ineffective for their intended purpose.

#### What's Different Now

| Aspect | Before | After |
|--------|--------|-------|
| Modules | 2 duplicate modules | 1 unified module |
| Public exports | 6 unused types | 0 (module is private) |
| Storage integration | None | Periodic batching (every 10 tx) |
| Per-tx overhead | 0 stroops | +0.325 stroops (10% increase, amortized) |
| Tests | 0 | 13 unit tests + 3 storage key tests |
| Breaking changes | N/A | None (removed types were unused) |

#### Storage Keys Added

New storage keys for issue #1514 (all in `stellar-contract/src/storage_keys.rs`):

| Key | Type | Purpose |
|-----|------|---------|
| `GLOBAL_METRICS_SNAPSHOT` | Symbol | On-chain analytics snapshot |
| `ANALYTICS_LAST_UPDATE` | Symbol | Snapshot timestamp |
| `ANALYTICS_BATCH_COUNT` | Symbol | Batching counter |
| `recycling_stats_key(address)` | Tuple | Per-participant stats |

All keys follow naming conventions:
- Symbol keys: ≤9 chars (Soroban limit)
- Tuple keys: `("recycling_stats", address)` format
- No collisions (verified by tests)

#### Migration Path for Deployed Contracts

If the contract was already deployed with the old analytics types:

1. **Old state**: `contract_analytics` module exported (debug-only)
2. **New state**: Module removed, analytics is private
3. **Breaking changes**: None (module was not part of ABI)
4. **Data migration**: No on-chain data to migrate (module never persisted anything)

For future contract upgrades, use `analytics::initialize_analytics_on_upgrade()` to bootstrap metrics.

#### Off-Chain Implications

- **Indexer**: Remains authoritative source for reporting
- **Snapshots**: On-chain snapshots provide audit trail only
- **Periodic batching**: Configurable (currently every 10 transactions)
- **Accuracy**: Off-chain and on-chain may diverge by up to 10 transactions

#### Documentation References

- **Analysis**: [`stellar-contract/ANALYTICS_CONSOLIDATION_ANALYSIS.md`](../stellar-contract/ANALYTICS_CONSOLIDATION_ANALYSIS.md)
- **Design**: [`stellar-contract/ANALYTICS_DESIGN.md`](../stellar-contract/ANALYTICS_DESIGN.md)
- **Test Report**: [`stellar-contract/ANALYTICS_CONSOLIDATION_TEST_REPORT.md`](../stellar-contract/ANALYTICS_CONSOLIDATION_TEST_REPORT.md)
- **Storage Impact**: [`stellar-contract/ANALYTICS_STORAGE_IMPACT.md`](../stellar-contract/ANALYTICS_STORAGE_IMPACT.md)
