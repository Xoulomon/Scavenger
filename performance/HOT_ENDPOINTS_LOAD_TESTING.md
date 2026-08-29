# Hot Endpoints Load Testing Guide

This document describes the load testing strategy for the high-traffic ("hot") endpoints in the Scavenger platform, as specified in issue #950.

## Overview

Hot endpoints are those identified as experiencing the highest traffic in production or expected to experience high traffic. Load testing these endpoints ensures the system can handle peak loads without degradation.

## Hot Endpoints Identified

The following endpoints have been identified as "hot" and require load testing:

### Read-Heavy Endpoints (High Priority)

1. **List Wastes**
   - **Endpoint**: `GET /api/v1/contracts/wastes`
   - **Description**: List all wastes with pagination
   - **Expected Load**: Frequently accessed from dashboards and reports
   - **Baseline p95**: 300ms
   - **Threshold p95**: 500ms

2. **List Participants**
   - **Endpoint**: `GET /api/v1/contracts/participants`
   - **Description**: List all participants with pagination
   - **Expected Load**: Frequently accessed from dashboards and participant management
   - **Baseline p95**: 300ms
   - **Threshold p95**: 500ms

3. **Get Contract Stats**
   - **Endpoint**: `GET /api/v1/contracts/stats`
   - **Description**: Get aggregated contract statistics and metrics
   - **Expected Load**: Dashboard queries, analytics requests
   - **Baseline p95**: 400ms
   - **Threshold p95**: 600ms

4. **Search**
   - **Endpoint**: `GET /api/v1/search`
   - **Description**: Full-text search across wastes and participants
   - **Expected Load**: User searches, filtering operations
   - **Baseline p95**: 500ms
   - **Threshold p95**: 800ms

5. **Audit Logs**
   - **Endpoint**: `GET /api/v1/audit/logs`
   - **Description**: List audit logs with pagination (compliance-heavy)
   - **Expected Load**: Compliance monitoring, audit reviews
   - **Baseline p95**: 400ms
   - **Threshold p95**: 700ms

### Write Operations

6. **Sign Transaction**
   - **Endpoint**: `POST /api/v1/signing/sign`
   - **Description**: Sign a transaction
   - **Expected Load**: Moderate, limited by idempotency and sequential signing
   - **Baseline p95**: 600ms
   - **Threshold p95**: 900ms

## Load Test Scenarios

The hot endpoints load test (`k6-hot-endpoints-load-test.js`) includes three comprehensive scenarios:

### Scenario 1: Steady State (Normal Operations)
- **Duration**: 9 minutes
- **Concurrent Users**: 100
- **Ramp-up**: 2 minutes
- **Sustain**: 5 minutes
- **Ramp-down**: 2 minutes
- **Expected RPS**: ~150 requests/second
- **Thresholds**:
  - p95 latency: < 500ms
  - p99 latency: < 1500ms
  - Error rate: < 5%

**Purpose**: Verify system performance under normal, sustained load

### Scenario 2: Spike Test
- **Duration**: 5 minutes
- **Initial Users**: 100 → **Peak Users**: 1000 (sudden spike)
- **Spike attack**: 30 seconds at 1000 users
- **Recovery**: 30 seconds back to 100 users
- **Expected RPS**: ~1500 requests/second during spike
- **Thresholds**:
  - p95 latency: < 1000ms
  - Error rate: < 10%

**Purpose**: Test system resilience to sudden traffic spikes

### Scenario 3: Stress Test
- **Duration**: 13 minutes
- **Peak Concurrent Users**: 10000
- **Gradual ramp-up**: 6 minutes (100 → 1000 → 5000 → 10000)
- **Sustain**: 5 minutes at 10000 users
- **Expected RPS**: ~15000 requests/second
- **Thresholds**:
  - p95 latency: < 2000ms
  - Error rate: < 20%

**Purpose**: Identify system breaking points and performance limits

## Running the Tests

### Prerequisites

1. k6 installed: https://k6.io/docs/getting-started/installation/
2. Backend API running on default port (8080)
3. Database populated with test data (optional, but recommended)

### Installation

```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Windows
choco install k6
```

### Running All Tests

```bash
# Run all hot endpoints load tests
./performance/run-hot-endpoints-tests.sh

# Run with custom base URL
BASE_URL=http://api.example.com ./performance/run-hot-endpoints-tests.sh

# Generate baselines after test completion
GENERATE_BASELINE=true ./performance/run-hot-endpoints-tests.sh
```

### Running Individual Scenarios

```bash
# Run just the hot endpoints test (includes all 3 scenarios)
k6 run performance/k6-hot-endpoints-load-test.js

# Run with custom configuration
BASE_URL=http://localhost:8080 k6 run performance/k6-hot-endpoints-load-test.js

# Run with output to file
k6 run --out json=performance/reports/hot-endpoints-results.json \
  performance/k6-hot-endpoints-load-test.js
```

## Interpreting Results

### Key Metrics

1. **Response Time Metrics**
   - `http_req_duration` (p95, p99, avg): Overall request latency
   - Endpoint-specific trends: `list_wastes_duration`, `search_duration`, etc.

2. **Error Metrics**
   - `http_req_failed`: Percentage of failed requests
   - `errors`: Custom error rate tracking

3. **Throughput Metrics**
   - `http_reqs`: Total number of requests
   - Requests per second (RPS)
   - Success count

4. **Connection Metrics**
   - `active_connections`: Current concurrent connections

### Evaluation Criteria

Test results are evaluated against three levels:

| Level | p95 Latency | Error Rate | Action |
|-------|-------------|-----------|--------|
| **Baseline** | < 300-600ms | < 1-2% | ✓ Expected performance |
| **Warning** | 300-800ms | 2-5% | ⚠ Monitor and optimize |
| **Critical** | > 800-900ms | > 5-10% | ✗ Requires investigation |

## Performance Baseline Recording

Baselines capture the system's expected performance under different load scenarios. They enable regression detection on future test runs.

### Recording Baselines

```bash
# Generate new baselines from test results
GENERATE_BASELINE=true ./performance/run-hot-endpoints-tests.sh
```

This creates baseline files in the `performance/baselines/` directory.

### Baseline Comparison

After recording baselines, future tests can be compared:

```bash
# Run tests and compare against baseline
k6 run performance/k6-hot-endpoints-load-test.js
```

The results will show regression or improvement vs. baseline.

## Threshold Configuration

Thresholds are defined in `hot-endpoints-thresholds.json` and include:

- **Baseline**: Expected performance under normal conditions
- **Warning**: Degraded performance but still acceptable
- **Critical**: Performance that requires investigation and optimization

These can be adjusted based on:
- Infrastructure capacity
- Business requirements
- Historical performance data
- SLA commitments

## Analysis and Optimization

After running load tests, use the results to identify bottlenecks:

### High Response Times

If p95/p99 latencies are high:

1. Check database query performance
   - Review slow query logs
   - Analyze index usage
   - Consider query optimization

2. Check API endpoint logic
   - Profile hot endpoints
   - Identify expensive operations
   - Add caching where appropriate

3. Check network latency
   - Monitor bandwidth usage
   - Check for network saturation
   - Consider CDN for static assets

### High Error Rates

If error rates exceed thresholds:

1. Check application logs for errors
2. Verify database connectivity
3. Check rate limiting settings
4. Review authentication/authorization

### Connection Issues

If connections are dropping or timing out:

1. Check connection pool settings
2. Verify database connection limits
3. Check for resource exhaustion
4. Monitor memory usage

## CI/CD Integration

The hot endpoints load tests can be integrated into CI/CD pipelines:

```yaml
name: Performance Testing

on: [push, pull_request]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: grafana/k6-action@v0.3.0
        with:
          filename: performance/k6-hot-endpoints-load-test.js
          cloud: true
```

## Troubleshooting

### k6 Installation Issues

```bash
# Verify k6 installation
k6 version

# Update k6 to latest
brew upgrade k6
```

### Connection Refused Errors

1. Verify backend is running: `curl http://localhost:8080/health`
2. Check BASE_URL is correct
3. Verify firewall/network connectivity

### High Error Rates During Test

1. Check backend logs for errors
2. Verify database is accessible
3. Check resource availability (CPU, memory)
4. Try with fewer concurrent users

### Out of Memory Errors

k6 stores some metrics in memory. For very long tests:

1. Reduce VU count
2. Increase system memory
3. Reduce metric collection scope

## Related Issues and Documents

- Issue: #950 - Add load/perf tests for hot endpoints
- Issue: #45 - Related performance work
- [LOAD_TESTING_GUIDE.md](./LOAD_TESTING_GUIDE.md) - Comprehensive load testing guide
- [README.md](./README.md) - Performance testing infrastructure overview

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Load Testing Guide](https://k6.io/docs/testing-guides/load-testing/)
- [k6 Scripting API](https://k6.io/docs/javascript-api/)
- [Performance Testing Best Practices](https://owasp.org/www-community/attacks/Performance_testing)
