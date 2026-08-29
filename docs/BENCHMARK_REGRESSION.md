# Benchmark Regression Runbook

> **Issue #1108** — Add regression benchmark gating via `benchmark_regression.rs`

This document describes how contributors run the benchmark regression suite
locally, what the acceptance thresholds are, and how to update the committed
baseline when intentional changes shift performance.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Running the regression suite locally](#running-the-regression-suite-locally)
4. [Regression thresholds](#regression-thresholds)
5. [Pre-merge checklist](#pre-merge-checklist)
6. [Updating the baseline](#updating-the-baseline)
7. [Committed baseline values](#committed-baseline-values)
8. [Interpreting results](#interpreting-results)
9. [Relationship to Criterion benchmarks](#relationship-to-criterion-benchmarks)

---

## Overview

`stellar-contract/src/benchmark_regression.rs` contains:

- `PerformanceBaseline` — hard-coded baseline gas values for each core operation.
- `PerformanceThresholds` — maximum allowed percentage increase above baseline.
- `RegressionDetector` — compares a measured value against the baseline.
- `BenchmarkSuite` / `RegressionReport` — aggregates multiple results.

The unit tests in `stellar-contract/tests/benchmark_regression_test.rs` verify
the regression-detection logic itself (not live contract execution).  Actual
gas measurements come from `cargo bench` (Criterion).

---

## Prerequisites

```bash
# Rust toolchain — nightly required for some bench features
rustup toolchain install nightly
rustup target add wasm32-unknown-unknown

# Criterion (already in [dev-dependencies])
# No additional install needed.
```

---

## Running the regression suite locally

### 1. Unit tests for the regression-detection module

These tests run in milliseconds and exercise the logic in
`benchmark_regression.rs` (baseline relationships, threshold enforcement,
report generation):

```bash
cargo test --package stellar-scavngr-contract benchmark_regression
```

Expected: all tests pass with zero regressions reported.

### 2. Criterion wall-clock benchmarks

These benchmarks measure actual contract-execution time in the Soroban test
environment.  Run them before and after your change:

```bash
# Capture a named baseline before your change
cargo bench --package stellar-scavngr-contract -- --save-baseline before

# Make your change, then compare
cargo bench --package stellar-scavngr-contract -- --baseline before
```

HTML reports are written to `target/criterion/`.  Open
`target/criterion/report/index.html` in a browser to inspect regressions and
improvements.

### 3. Quick regression check (recommended pre-merge step)

```bash
cargo bench --package stellar-scavngr-contract 2>&1 | grep -E "regression|improved|change"
```

---

## Regression thresholds

The following thresholds are enforced by `PerformanceThresholds::default()` and
the unit tests in `benchmark_regression_test.rs`.  A result is classified as a
**regression** when the measured value exceeds the baseline by more than the
stated percentage.

| Operation                  | Threshold | Rationale                                  |
|----------------------------|-----------|--------------------------------------------|
| `register_participant`     | **+10 %** | Low-complexity write; tight bound          |
| `submit_waste`             | **+10 %** | Core hot path; tight bound                 |
| `transfer_waste`           | **+15 %** | More state changes; slightly looser bound  |
| `query_participant`        | **+5 %**  | Read-only; must stay cheap                 |
| `batch_update_10`          | **+10 %** | Default                                    |
| `batch_transfer_20`        | **+10 %** | Default                                    |

> **Policy**: No more than **5 % average increase** across all operations is
> acceptable per PR.  Individual operations may not exceed their per-operation
> threshold.  Both checks must pass.

---

## Pre-merge checklist

Before merging any PR that touches `stellar-contract/src/`:

- [ ] `cargo test --package stellar-scavngr-contract` passes with zero failures.
- [ ] `cargo bench --package stellar-scavngr-contract -- --baseline before` shows
      no regressions beyond the thresholds in the table above.
- [ ] If a regression is intentional (new feature that inherently costs more),
      update the baseline values in `PerformanceBaseline::default()` and this
      document's [Committed baseline values](#committed-baseline-values) section,
      and include a justification in the PR description.
- [ ] The `benchmark_regression_test.rs` tests still pass after any baseline
      update.

---

## Updating the baseline

When a new feature legitimately increases gas costs (and the increase has been
reviewed and accepted):

1. Measure the new gas values using Criterion:

   ```bash
   cargo bench --package stellar-scavngr-contract
   ```

2. Update `PerformanceBaseline::default()` in
   `stellar-contract/src/benchmark_regression.rs`:

   ```rust
   impl Default for PerformanceBaseline {
       fn default() -> Self {
           Self {
               register_participant_gas: <new_value>,
               submit_waste_gas:         <new_value>,
               // …
           }
       }
   }
   ```

3. Update the [Committed baseline values](#committed-baseline-values) table in
   this file.

4. Commit with a message like:
   ```
   perf(contract): update benchmark baseline after <feature> (#XXXX)
   ```

---

## Committed baseline values

These values are the **accepted baseline** for the current codebase.  They are
set in `PerformanceBaseline::default()` and must match what is committed there.

| Operation                  | Baseline gas | Last updated |
|----------------------------|:------------:|:------------:|
| `register_participant`     | 2 500        | Issue #937   |
| `submit_waste`             | 3 000        | Issue #937   |
| `transfer_waste`           | 4 500        | Issue #937   |
| `query_participant`        | 1 500        | Issue #937   |
| `batch_update_10`          | 15 000       | Issue #937   |
| `batch_transfer_20`        | 35 000       | Issue #937   |

> ℹ️  "Gas" here refers to the Soroban simulator's resource-unit count, not
> network fees.  It is a proxy for on-chain CPU/memory consumption.

---

## Interpreting results

| Criterion output phrase          | Meaning                                     |
|----------------------------------|---------------------------------------------|
| `No change in performance`       | Within noise; not a regression              |
| `Performance has improved`       | Positive; no action needed                  |
| `Performance has regressed`      | **Investigate before merging**              |
| `Change within noise threshold`  | Statistically insignificant; acceptable     |

When `RegressionReport::has_regressions()` returns `true` in the unit tests,
check `worst_regression()` for the largest offender and compare it against the
per-operation thresholds above.

---

## Relationship to Criterion benchmarks

`benchmark_regression.rs` is a **logic module** — it defines baseline/threshold
data structures and comparison arithmetic.  It does not execute contracts.

The Criterion benchmarks in `stellar-contract/benches/contract_benchmarks.rs`
execute actual contract calls and produce wall-clock timings.  The two are
complementary:

- Use **Criterion** to get real timings and detect regressions in CI or locally.
- Use **`benchmark_regression.rs`** to record accepted baselines, enforce
  thresholds programmatically, and generate human-readable regression reports.
