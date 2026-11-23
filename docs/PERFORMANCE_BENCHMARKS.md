# Performance Benchmarks

## Overview

Performance benchmarks track critical paths in the Scavenger contract to ensure optimal gas usage and execution times.

## Benchmark Scenarios

### 1. Participant Registration

- **Metric**: Time to register 100 participants
- **Target**: < 5s
- **Purpose**: Validate participant onboarding performance

### 2. Waste Submission

- **Metric**: Time to submit 100 waste items
- **Target**: < 3s
- **Purpose**: Ensure efficient waste registration

### 3. Query Performance

- **Metric**: Time to query participant wastes 100 times
- **Target**: < 2s
- **Purpose**: Validate read operation efficiency

### 4. Metrics Retrieval

- **Metric**: Time to retrieve global metrics 100 times
- **Target**: < 1s
- **Purpose**: Ensure fast metric aggregation

## Running Benchmarks

```bash
cd stellar-contract
cargo bench --bench performance_benchmarks
```

## CI/CD Integration

Benchmarks run on every push to track performance regressions:

```yaml
- name: Run Performance Benchmarks
  run: cargo bench --bench performance_benchmarks
```

## Tracking Performance

Results are stored in `target/criterion/` for historical comparison.

## Performance Targets

| Operation            | Target | Current |
| -------------------- | ------ | ------- |
| Register Participant | < 50ms | -       |
| Submit Waste         | < 30ms | -       |
| Query Wastes         | < 20ms | -       |
| Get Metrics          | < 10ms | -       |
