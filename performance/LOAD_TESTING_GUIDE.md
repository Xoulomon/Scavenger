# Load Testing Guide

Comprehensive load testing suite for the Scavenger platform using k6.

## Overview

Consolidated testing framework with **5 load profiles**, each optimized for specific testing purposes:

1. **Smoke** - Quick sanity check (1 user, 50 seconds)
2. **Load** - Steady state baseline (100 users, 6 minutes)
3. **Stress** - Breaking point detection (1000-10000 users, 15 minutes)
4. **Spike** - Traffic burst response (100→1000 users, 6 minutes)
5. **Soak** - Endurance & degradation (500 users, 40 minutes)

## Prerequisites

- k6 installed: https://k6.io/docs/getting-started/installation/
- Node.js 18+
- Running Scavenger API

## Installation

```bash
# Install k6
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Windows
choco install k6
```

## Quick Start

### Run Default Smoke Test

```bash
./scripts/run-perf-tests.sh
```

### Run Specific Profile

```bash
# Load test
./scripts/run-perf-tests.sh --profile load

# Stress test (WARNING: resource intensive)
./scripts/run-perf-tests.sh --profile stress

# Soak test (40+ minute test)
./scripts/run-perf-tests.sh --profile soak
```

### Run All Profiles Sequentially

```bash
./scripts/run-perf-tests.sh --all
```

### With Custom Configuration

```bash
# Custom API URL
BASE_URL=https://api.example.com ./scripts/run-perf-tests.sh --profile load

# Custom contract ID
CONTRACT_ID=CABC... ./scripts/run-perf-tests.sh --profile load

# Output JSON results
./scripts/run-perf-tests.sh --profile load --json --output reports/
```

## Manual k6 Commands

### Run Individual Scripts

```bash
# Smoke test
k6 run performance/k6-smoke.js

# Load test
BASE_URL=http://api.example.com k6 run performance/k6-load.js

# Stress test (resource intensive)
BASE_URL=http://api.example.com k6 run performance/k6-stress.js

# Spike test
BASE_URL=http://api.example.com k6 run performance/k6-spike.js

# Soak test (long running)
BASE_URL=http://api.example.com k6 run performance/k6-soak.js
```

### With Output Options

```bash
# JSON output
k6 run --out json=results.json performance/k6-load.js

# Summary output
k6 run --summary-export=summary.json performance/k6-load.js

# Multiple outputs
k6 run --out json=results.json --out csv=metrics.csv performance/k6-load.js
```

## Test Profiles

### 1. Smoke Test
- **File**: `performance/k6-smoke.js`
- **Duration**: ~50 seconds
- **Concurrent Users**: 1
- **Purpose**: Quick verification that system is operational
- **Thresholds**: p95 < 500ms, error rate < 1%
- **Use When**: Before running larger tests, CI/CD validation
- **Operations**: Register participant, submit waste, basic queries

### 2. Load Test
- **File**: `performance/k6-load.js`
- **Duration**: ~6 minutes
- **Concurrent Users**: 100 (ramp: 10→100→50)
- **Purpose**: Baseline performance under sustained normal load
- **Thresholds**: p95 < 1000ms, error rate < 5%
- **Use When**: Regular CI/CD checks, baseline establishment
- **Operations**: 30% participant ops, 30% waste ops, 40% queries

### 3. Stress Test
- **File**: `performance/k6-stress.js`
- **Duration**: ~15 minutes
- **Concurrent Users**: 1000-10000 (gradual increase)
- **Purpose**: Find system breaking point and resource limits
- **Thresholds**: p95 < 2000ms, error rate < 10%
- **Use When**: Release validation, capacity planning
- **⚠️ WARNING**: Resource intensive; use staging environment only

### 4. Spike Test
- **File**: `performance/k6-spike.js`
- **Duration**: ~6 minutes
- **Concurrent Users**: 100 → 1000 (spike) → 100
- **Purpose**: Verify system handles sudden traffic bursts
- **Thresholds**: p95 < 2000ms, error rate < 15%
- **Use When**: High traffic events, DDoS resilience
- **Operations**: Lighter before spike, aggressive during spike

### 5. Soak Test
- **File**: `performance/k6-soak.js`
- **Duration**: ~40 minutes (extended test)
- **Concurrent Users**: 500 (sustained)
- **Purpose**: Detect memory leaks, connection issues, degradation
- **Thresholds**: p95 < 500ms, error rate < 5%
- **Use When**: Overnight runs, weekly checks, before major releases
- **⚠️ WARNING**: Long-running test; schedule for off-peak hours

## Shared Components

### Common Configuration (`k6-common.js`)

Provides standardized utilities for all tests:

- **Custom Metrics**: error_rate, api_duration_ms, contract_call_duration_ms
- **Threshold Definitions**: Per profile baseline thresholds
- **Stage Definitions**: Pre-configured load patterns
- **Helper Functions**: `makeRequest()`, `checkResponse()`, `scenarios.*`

### Reusable Scenarios

```javascript
// Example usage in test scripts
import { scenarios, getConfig } from './k6-common.js';

const config = getConfig();

// Register participant
scenarios.registerParticipant(config, address, role, name);

// Submit waste
scenarios.submitWaste(config, submitter, wasteType, weight);

// Query operations
scenarios.queryParticipant(config, address);
scenarios.queryWaste(config, wasteId);
scenarios.getGlobalMetrics(config);
```

## Performance Baselines

Expected performance under normal conditions:

| Profile | P95 (ms) | P99 (ms) | Error Rate | Status |
|---------|----------|----------|------------|--------|
| Smoke   | < 500    | < 1000   | < 1%       | ✓ Pass |
| Load    | < 1000   | < 2000   | < 5%       | ✓ Pass |
| Stress  | < 2000   | < 5000   | < 10%      | ✓ Pass |
| Spike   | < 2000   | < 5000   | < 15%      | ✓ Pass |
| Soak    | < 500    | < 1000   | < 5%       | ✓ Pass |

Update these baselines when system capacity changes.

## Script Organization

```
performance/
├── k6-common.js              # Shared utilities and configurations
├── k6-smoke.js               # Quick verification test
├── k6-load.js                # Steady state load test
├── k6-stress.js              # Breaking point test
├── k6-spike.js               # Traffic burst test
├── k6-soak.js                # Endurance test
├── LOAD_TESTING_GUIDE.md     # This file
├── README.md                 # Quick reference
└── performance-benchmarks.md # Historical results
```

## Deprecated Scripts

The following scripts are deprecated and should no longer be used:
- `k6-load-test-comprehensive.js`
- `k6-load-test.js`
- `k6-concurrent-users.js`
- `k6-api-response-times.js`
- `k6-database-queries.js`
- `k6-waste-submission.js`
- `load-test-scenarios.js`

Use the consolidated scripts (k6-smoke.js, k6-load.js, etc.) instead
- **Purpose**: Multiple load waves to test recovery
- **Thresholds**: p95 < 1000ms, error rate < 10%

### 7. Peak Hour Simulation
- **Duration**: 45 minutes
- **Peak Users**: 2000 concurrent
- **Purpose**: Simulate realistic peak hour traffic
- **Thresholds**: p95 < 1000ms, error rate < 10%

### 8. Bottleneck Detection
- **Duration**: 15 minutes
- **Peak Users**: 10000 concurrent
- **Purpose**: Identify system bottlenecks
- **Thresholds**: p95 < 2000ms, error rate < 20%

## Metrics Collected

### Response Time Metrics
- `http_req_duration`: Total request duration
- `http_req_duration{staticAsset:yes}`: Static asset duration
- `http_req_duration{staticAsset:no}`: Dynamic content duration

### Error Metrics
- `http_req_failed`: Failed requests
- `errors`: Custom error rate
- `http_req_duration{expected_response:true}`: Expected responses

### Throughput Metrics
- `http_reqs`: Total requests
- `http_reqs_rate`: Requests per second
- `success_count`: Successful requests

### Connection Metrics
- `active_connections`: Active concurrent connections
- `http_conn_reused`: Reused connections

## Analyzing Results

### JSON Report

```bash
k6 run --out json=reports/results.json performance/k6-load-test-comprehensive.js
```

### HTML Report

```bash
# Install reporter
npm install -g @grafana/k6-reporter

# Generate report
k6 run --out json=reports/results.json performance/k6-load-test-comprehensive.js
k6-reporter reports/results.json
```

### Key Metrics to Review

1. **Response Time (p95, p99)**
   - Target: < 500ms for normal load
   - Target: < 1000ms for peak load

2. **Error Rate**
   - Target: < 5% for normal load
   - Target: < 10% for peak load

3. **Throughput**
   - Requests per second
   - Requests per user

4. **Resource Usage**
   - CPU utilization
   - Memory usage
   - Network bandwidth

## Bottleneck Identification

### Common Bottlenecks

1. **Database Queries**
   - Check query performance
   - Add indexes if needed
   - Consider caching

2. **API Endpoints**
   - Profile slow endpoints
   - Optimize business logic
   - Add rate limiting

3. **Network**
   - Check bandwidth usage
   - Optimize payload size
   - Use compression

4. **Server Resources**
   - Monitor CPU usage
   - Check memory leaks
   - Scale horizontally

## Performance Optimization

### Before Load Testing
- [ ] Profile application
- [ ] Identify slow queries
- [ ] Review code for inefficiencies
- [ ] Set up monitoring

### During Load Testing
- [ ] Monitor system resources
- [ ] Check error logs
- [ ] Track response times
- [ ] Identify bottlenecks

### After Load Testing
- [ ] Analyze results
- [ ] Identify issues
- [ ] Implement fixes
- [ ] Re-test improvements

## CI/CD Integration

### GitHub Actions

```yaml
name: Load Testing
on: [push, pull_request]

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: grafana/k6-action@v0.3.0
        with:
          filename: performance/k6-load-test-comprehensive.js
          cloud: true
```

## Troubleshooting

### High Error Rate
- Check API logs
- Verify database connectivity
- Check rate limiting
- Review error messages

### High Response Times
- Profile endpoints
- Check database queries
- Monitor server resources
- Review network latency

### Memory Issues
- Check for memory leaks
- Monitor garbage collection
- Review connection pooling
- Check cache size

## References

- [k6 Documentation](https://k6.io/docs/)
- [k6 Best Practices](https://k6.io/docs/testing-guides/load-testing/)
- [Performance Testing Guide](https://owasp.org/www-community/attacks/Performance_testing)
