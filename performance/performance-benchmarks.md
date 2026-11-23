# Performance Benchmarks

## Performance Targets

### API Response Times

- **Target**: p(95) < 500ms, p(99) < 1000ms
- **Test**: k6-api-response-times.js
- **Ramp-up**: 20 → 100 users over 2 minutes

### Concurrent Users

- **Target**: p(95) < 1000ms, p(99) < 2000ms
- **Test**: k6-concurrent-users.js
- **Ramp-up**: 50 → 200 users over 2.5 minutes

### Waste Submission

- **Target**: p(95) < 800ms, p(99) < 1500ms
- **Test**: k6-waste-submission.js
- **Load**: 100 concurrent users for 3 minutes

### Database Query Performance

- **Target**: p(95) < 600ms, p(99) < 1200ms
- **Test**: k6-database-queries.js
- **Load**: 30 → 100 users over 2.5 minutes

### Contract Gas Usage

- **Target**: p(95) < 2000ms, p(99) < 3000ms
- **Test**: k6-contract-gas-usage.js
- **Load**: 50 concurrent users for 3 minutes

### Spike Test

- **Target**: Handle 10x load spike without failure
- **Test**: k6-spike-test.js
- **Spike**: 100 → 1000 users instantly

### Stress Test

- **Target**: Graceful degradation under extreme load
- **Test**: k6-stress-test.js
- **Load**: Ramp to 500 users over 22 minutes

## Running Performance Tests

```bash
# Run individual test
k6 run performance/k6-api-response-times.js

# Run with custom base URL
k6 run -e BASE_URL=http://api.example.com performance/k6-api-response-times.js

# Run all tests
for test in performance/k6-*.js; do
  k6 run "$test"
done

# Generate HTML report
k6 run --out json=results.json performance/k6-api-response-times.js
```

## Performance Budgets

| Metric                  | Budget   | Threshold |
| ----------------------- | -------- | --------- |
| API Response Time (p95) | 500ms    | 600ms     |
| API Response Time (p99) | 1000ms   | 1200ms    |
| Error Rate              | < 5%     | < 10%     |
| Concurrent Users        | 500+     | 300+      |
| Database Query Time     | < 600ms  | < 800ms   |
| Contract Invocation     | < 2000ms | < 3000ms  |

## CI/CD Integration

Performance tests run automatically on:

- Pull requests (smoke test)
- Merges to main (full suite)
- Scheduled nightly runs (stress test)

Failures trigger alerts and block deployment if thresholds exceeded.
