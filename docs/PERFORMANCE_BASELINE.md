# Performance Baseline

## Overview

Performance baselines define acceptable limits for key contract operations, API response times, and database queries. Thresholds are enforced in CI via the [performance workflow](../.github/workflows/performance.yml). Baseline values are stored in [`performance/baselines.json`](../performance/baselines.json).

## Baseline Metrics

### Contract Instruction Counts (Soroban)

| Operation                | Baseline  | Threshold | Unit         |
| ------------------------ | --------- | --------- | ------------ |
| Participant registration | 500,000   | 750,000   | instructions |
| Waste registration       | 800,000   | 1,200,000 | instructions |
| Waste transfer           | 1,000,000 | 1,500,000 | instructions |
| Incentive creation       | 600,000   | 900,000   | instructions |
| Reward distribution      | 1,200,000 | 1,800,000 | instructions |

### API Response Times

| Metric      | Baseline | Threshold | Unit |
| ----------- | -------- | --------- | ---- |
| p95 latency | 300      | 500       | ms   |
| p99 latency | 700      | 1,000     | ms   |
| Error rate  | 1        | 5         | %    |

### Database Query Times

| Metric    | Baseline | Threshold | Unit |
| --------- | -------- | --------- | ---- |
| Query p95 | 400      | 600       | ms   |
| Query p99 | 800      | 1,200     | ms   |

**Baseline** = expected normal performance. **Threshold** = maximum acceptable value before the check fails.

## Continuous Monitoring

The [performance.yml](../.github/workflows/performance.yml) workflow runs on:

- Every push to `main` or `develop`
- Pull requests targeting `main`
- Weekly on Sundays at 03:00 UTC
- Manual dispatch via GitHub Actions UI

Jobs:

1. **contract-benchmarks** — runs `cargo test --test performance_test` in `stellar-contract/`, uploads results as artifact
2. **api-performance** — runs a 30s k6 smoke test against `k6-api-response-times.js`, compares results against `baselines.json` thresholds (skipped gracefully if k6 unavailable)
3. **performance-report** — downloads artifacts and writes a pass/fail table to the GitHub Actions step summary

## Alerting Policy

| Severity | Condition                | Action                      |
| -------- | ------------------------ | --------------------------- |
| Warning  | Metric exceeds baseline  | Note in PR review           |
| Failure  | Metric exceeds threshold | CI check fails, block merge |

The `api-performance` job uses `continue-on-error: true` so a missing test environment does not block unrelated work, but threshold violations in a live environment will still fail the step.

## Trend Tracking

Artifacts from each run are retained by GitHub Actions (default 90 days). To track trends over time:

1. Download artifacts from the Actions UI or via `gh run download`
2. Compare `performance-results.txt` across runs for contract instruction counts
3. Compare `k6-results.json` across runs for API metrics

## Updating Baselines

When deliberate optimizations or contract changes alter expected performance:

1. Run the full benchmark suite locally and collect new measurements
2. Edit `performance/baselines.json` — update `baseline` to the new measured value and set `threshold` to 150% of baseline (or as appropriate)
3. Update the `updated` field to today's date
4. Open a PR with the changes and include benchmark output as evidence

```bash
# Run contract benchmarks locally
cd stellar-contract
cargo test --test performance_test -- --nocapture

# Run k6 smoke test locally (requires k6)
k6 run --vus 1 --duration 30s performance/k6-api-response-times.js
```

## Performance Improvement Plan

When a threshold breach is detected:

1. Identify the regressing commit via `git bisect`
2. Profile the operation: for contract code, check instruction count growth in test output; for API, use k6 detailed output
3. Fix or revert the regression, or update the baseline if the change is intentional and justified
4. Re-run CI to confirm the breach is resolved before merging
