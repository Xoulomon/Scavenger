# Contract Performance Benchmarks

> **See also:** [`docs/BENCHMARK_REGRESSION.md`](../docs/BENCHMARK_REGRESSION.md) for the full
> regression runbook — local run process, accepted thresholds, pre-merge checklist, and
> baseline update procedures (Issue #1108).

## Running Benchmarks

### Criterion benchmarks (recommended)
```bash
cargo bench --package stellar-scavngr-contract
```

HTML reports are generated in `target/criterion/`. Open `target/criterion/report/index.html` to view results.

### Quick performance test
```bash
cargo run --example performance_benchmarks --package stellar-scavngr-contract
```

## Benchmark Groups

| Group | Benchmarks | What it measures |
|-------|-----------|-----------------|
| `registration` | register_recycler, register_collector, register_manufacturer | Participant registration with different roles |
| `waste_submission` | submit_paper, submit_metal, submit_electronic, submit_10_sequential | Single and batch waste submission across material types |
| `waste_transfer` | transfer_waste | End-to-end transfer between recycler and collector |
| `queries` | get_participant_wastes (empty/10), get_metrics, is_participant_registered | Read-only query performance |
| `incentives` | create_incentive | Incentive creation by manufacturers |

## Comparing Results Over Time

Criterion automatically compares against the last run. To save a baseline:

```bash
cargo bench --package stellar-scavngr-contract -- --save-baseline v1
```

Compare against a saved baseline:

```bash
cargo bench --package stellar-scavngr-contract -- --baseline v1
```

## Notes

These benchmarks measure wall-clock execution time in the Soroban test environment, not actual on-chain gas costs. They are useful for detecting performance regressions in contract logic, not for estimating deployment costs.
