#!/usr/bin/env bash
# Scavenger Performance Testing Suite Runner.
#
# Usage: ./performance/run-perf-tests.sh [--help]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--help]

Run the full k6 performance test suite (load, stress, endurance, spike).
Set GENERATE_BASELINE=true to update baseline metrics after the run.

Environment:
  BASE_URL           Target API base URL   (default: http://localhost:3000/api)
  GENERATE_BASELINE  Set to "true" to regenerate baseline metrics
EOF
  exit 0
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
fi

BASE_URL="${BASE_URL:-http://localhost:3000/api}"
SCENARIOS_DIR="./performance/scenarios"
REPORTS_DIR="./performance/reports"

mkdir -p "$REPORTS_DIR"

echo "==========================================="
echo "  Scavenger Performance Testing Suite      "
echo "==========================================="
echo "Target URL: $BASE_URL"
echo "Time: $(date)"
echo "-------------------------------------------"

# Function to run a k6 test
run_test() {
    local test_name="$1"
    local test_file="$2"
    echo "[+] Running $test_name..."
    k6 run -e "BASE_URL=${BASE_URL}" "$SCENARIOS_DIR/$test_file"
}

# 1. Run Load Test
run_test "Load Test" "load.js"

# 2. Run Stress Test
run_test "Stress Test" "stress.js"

# 3. Run Endurance Test
run_test "Endurance Test" "endurance.js"

# 4. Run Spike Test
run_test "Spike Test" "spike.js"

# 5. Generate/Update Baseline if requested
if [ "${GENERATE_BASELINE:-false}" = "true" ]; then
  echo "-------------------------------------------"
  echo "[+] Generating performance baseline..."
  node performance/generate-baseline.js
fi

# 6. Analyze Results and Generate Report
echo "-------------------------------------------"
echo "[+] Analyzing results and generating report..."
if command -v node &> /dev/null; then
    node performance/analyze-results.js
else
    echo "Warning: Node.js not found, skipping analysis script."
fi

echo "-------------------------------------------"
echo "Full results available in $REPORTS_DIR"
echo "Summary report: $REPORTS_DIR/performance-summary.md"
echo "==========================================="
