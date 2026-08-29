#!/bin/bash

##############################################################################
# Hot Endpoints Load Testing Script
#
# This script runs comprehensive load tests on hot endpoints identified in
# issue #950. It tests multiple scenarios:
# - Steady State (100 users)
# - Spike Test (sudden 1000 users)
# - Stress Test (gradual increase to 10000 users)
#
# Usage:
#   ./run-hot-endpoints-tests.sh                 # Run all tests
#   BASE_URL=http://api.example.com ./run-hot-endpoints-tests.sh  # Custom URL
#   GENERATE_BASELINE=true ./run-hot-endpoints-tests.sh  # Generate baselines
##############################################################################

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="${SCRIPT_DIR}"
REPORTS_DIR="${SCRIPT_DIR}/reports"
BASELINES_DIR="${SCRIPT_DIR}/baselines"
BASE_URL="${BASE_URL:-http://localhost:8080}"
GENERATE_BASELINE="${GENERATE_BASELINE:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure directories exist
mkdir -p "${REPORTS_DIR}"
mkdir -p "${BASELINES_DIR}"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Hot Endpoints Load Testing Suite${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  Base URL: ${BASE_URL}"
echo "  Reports Directory: ${REPORTS_DIR}"
echo "  Generate Baseline: ${GENERATE_BASELINE}"
echo ""

# Verify k6 is installed
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}Error: k6 is not installed${NC}"
    echo "Please install k6 from https://k6.io/docs/getting-started/installation/"
    exit 1
fi

echo -e "${GREEN}✓ k6 is installed${NC}"
k6 version

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Running Hot Endpoints Load Tests${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Run hot endpoints load test
echo -e "${YELLOW}Starting hot endpoints load test...${NC}"
echo "This test includes:"
echo "  1. Steady State (100 users for 9 minutes)"
echo "  2. Spike Test (sudden 1000 users for 5 minutes)"
echo "  3. Stress Test (gradual increase to 10000 for 13 minutes)"
echo "  Total duration: ~27 minutes"
echo ""

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RESULTS_FILE="${REPORTS_DIR}/hot-endpoints-load-test_${TIMESTAMP}.json"
SUMMARY_FILE="${REPORTS_DIR}/hot-endpoints-load-test_${TIMESTAMP}.summary"

if BASE_URL="${BASE_URL}" k6 run \
  --out "json=${RESULTS_FILE}" \
  "${TESTS_DIR}/k6-hot-endpoints-load-test.js"; then

  echo -e "${GREEN}✓ Hot endpoints load test completed${NC}"
  TESTS_PASSED=$((TESTS_PASSED + 1))

  # Extract key metrics
  echo ""
  echo -e "${BLUE}Test Results Summary:${NC}"
  if command -v jq &> /dev/null; then
    echo "  Report saved to: ${RESULTS_FILE}"

    # Extract and display key metrics
    if [ -f "${RESULTS_FILE}" ]; then
      echo ""
      echo -e "${BLUE}Key Metrics:${NC}"

      # HTTP request metrics
      HTTP_REQ_COUNT=$(jq '.metrics.iterations.values.count // 0' "${RESULTS_FILE}" 2>/dev/null || echo "N/A")
      HTTP_REQ_FAILED=$(jq '.metrics.http_req_failed.values.rate // 0' "${RESULTS_FILE}" 2>/dev/null || echo "N/A")

      echo "  Total Requests: ${HTTP_REQ_COUNT}"
      echo "  Failure Rate: ${HTTP_REQ_FAILED}"

      # Endpoint-specific metrics
      echo ""
      echo -e "${BLUE}Hot Endpoint Performance:${NC}"
      for ENDPOINT in "list_wastes_duration" "list_participants_duration" "get_stats_duration" "search_duration" "audit_logs_duration" "sign_transaction_duration"; do
        P95=$(jq ".metrics.${ENDPOINT}.values['p(95)'] // \"N/A\"" "${RESULTS_FILE}" 2>/dev/null)
        P99=$(jq ".metrics.${ENDPOINT}.values['p(99)'] // \"N/A\"" "${RESULTS_FILE}" 2>/dev/null)
        echo "  ${ENDPOINT}:"
        echo "    p95: ${P95}ms"
        echo "    p99: ${P99}ms"
      done

      # Save summary
      cat > "${SUMMARY_FILE}" << EOF
Hot Endpoints Load Test Summary
Generated: $(date)
Base URL: ${BASE_URL}
Duration: ~27 minutes

Test Scenarios:
- Steady State: 100 concurrent users for 9 minutes
- Spike Test: Sudden increase to 1000 users for 5 minutes
- Stress Test: Gradual increase to 10000 users for 13 minutes

Results: ${RESULTS_FILE}

Key Findings:
- Total Requests: ${HTTP_REQ_COUNT}
- Failure Rate: ${HTTP_REQ_FAILED}

All results saved to: ${RESULTS_FILE}
EOF

      echo ""
      echo -e "${YELLOW}Summary saved to: ${SUMMARY_FILE}${NC}"
    fi
  else
    echo "  (Install jq for detailed metrics extraction)"
  fi
else
  echo -e "${RED}✗ Hot endpoints load test failed${NC}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  FAILED_TESTS+=("hot-endpoints-load-test")
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Results${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Passed: ${TESTS_PASSED}${NC}"
echo -e "${RED}Failed: ${TESTS_FAILED}${NC}"

if [ ${TESTS_FAILED} -gt 0 ]; then
  echo ""
  echo -e "${RED}Failed Tests:${NC}"
  for test in "${FAILED_TESTS[@]}"; do
    echo "  - ${test}"
  done
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Baseline Recording${NC}"
echo -e "${BLUE}========================================${NC}"

if [ "${GENERATE_BASELINE}" = "true" ]; then
  echo -e "${YELLOW}Generating baseline from test results...${NC}"

  BASELINE_FILE="${BASELINES_DIR}/hot-endpoints-baseline_${TIMESTAMP}.json"

  if [ -f "${RESULTS_FILE}" ]; then
    # Create baseline from results
    node "${SCRIPT_DIR}/generate-baseline.js" "${RESULTS_FILE}" "${BASELINE_FILE}" || true

    if [ -f "${BASELINE_FILE}" ]; then
      echo -e "${GREEN}✓ Baseline generated: ${BASELINE_FILE}${NC}"
    fi
  fi
else
  echo "Baseline generation disabled."
  echo "To generate baselines, run with: GENERATE_BASELINE=true"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Suite Complete${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

if [ ${TESTS_FAILED} -eq 0 ]; then
  echo -e "${GREEN}All tests completed successfully!${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed. Please check the output above.${NC}"
  exit 1
fi
