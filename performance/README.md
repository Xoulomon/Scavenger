# Performance Testing Infrastructure

This directory contains the performance testing suite for Scavenger.

## Framework
We use [k6](https://k6.io/) for load, stress, and endurance testing.

## Directory Structure
- `scenarios/`: k6 test scripts for different testing types (load, stress, endurance).
- `lib/`: Shared functions and configurations.
- `baselines/`: Performance baseline data for regression detection.
- `reports/`: Generated test results and summary reports.
- `HOT_ENDPOINTS_LOAD_TESTING.md`: Comprehensive guide for hot endpoints load testing (issue #950).
- `hot-endpoints-thresholds.json`: Performance thresholds for identified hot endpoints.
- `k6-hot-endpoints-load-test.js`: Load test script for hot endpoints (3 scenarios).
- `run-hot-endpoints-tests.sh`: Runner script for hot endpoints load tests.

## Test Types
1. **Load Test** (`load.js`): Tests the system under expected normal load.
2. **Stress Test** (`stress.js`): Tests the system's limits by gradually increasing load until it breaks or reaches a high threshold.
3. **Endurance Test** (`endurance.js`): Tests system stability over an extended period.
4. **Hot Endpoints Load Test** (`k6-hot-endpoints-load-test.js`): Comprehensive load testing for high-traffic endpoints (issue #950).

## Running Tests

Requires a running environment (see the
[Developer Onboarding Guide](../docs/DEVELOPER_ONBOARDING.md#development-environment-setup))
plus [k6](https://k6.io) installed locally.

### General Test Suite
```bash
./performance/run-perf-tests.sh
```

### Hot Endpoints Load Tests
```bash
# Run all hot endpoints load tests
./performance/run-hot-endpoints-tests.sh

# Run with custom base URL
BASE_URL=http://api.example.com ./performance/run-hot-endpoints-tests.sh

# Generate baselines
GENERATE_BASELINE=true ./performance/run-hot-endpoints-tests.sh
```

### Specific Test
```bash
k6 run performance/scenarios/load.js
k6 run performance/k6-hot-endpoints-load-test.js
```

## Hot Endpoints Load Testing (Issue #950)

As of v1.0, the hot endpoints load testing suite includes comprehensive tests for high-traffic endpoints:

**Hot Endpoints Tested:**
- `GET /api/v1/contracts/wastes` - List wastes
- `GET /api/v1/contracts/participants` - List participants
- `GET /api/v1/contracts/stats` - Contract statistics
- `GET /api/v1/search` - Full-text search
- `GET /api/v1/audit/logs` - Audit logs
- `POST /api/v1/signing/sign` - Transaction signing

**Test Scenarios:**
1. Steady State: 100 concurrent users (9 minutes)
2. Spike Test: Sudden increase to 1000 users (5 minutes)
3. Stress Test: Gradual increase to 10000 users (13 minutes)

**Performance Thresholds:**
- Steady State: p95 < 500ms, error rate < 5%
- Spike: p95 < 1000ms, error rate < 10%
- Stress: p95 < 2000ms, error rate < 20%

See [HOT_ENDPOINTS_LOAD_TESTING.md](./HOT_ENDPOINTS_LOAD_TESTING.md) for complete details.

## Baselines and Alerts
The suite includes a baseline comparison tool.
- To generate a new baseline: `GENERATE_BASELINE=true ./performance/run-perf-tests.sh`
- The `analyze-results.js` script automatically compares current results with the baseline and reports regressions.
- Hot endpoints baselines are defined in `baselines.json` under the `hot_endpoints` section.

## Metrics Tracked
- `http_req_duration`: End-to-end request time (p95, avg).
- `errors`: Rate of non-200/409 responses.
- `api_duration`: Custom trend for API specific timing.
- Endpoint-specific trends: `list_wastes_duration`, `search_duration`, `audit_logs_duration`, etc.
