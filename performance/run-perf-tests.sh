#!/bin/bash

# Scavenger Performance Testing Suite Runner

set -e

BASE_URL=${BASE_URL:-"http://localhost:3000/api"}
SCENARIOS_DIR="./performance/scenarios"
REPORTS_DIR="./performance/reports"

mkdir -p $REPORTS_DIR

echo "==========================================="
echo "  Scavenger Performance Testing Suite      "
echo "==========================================="
echo "Target URL: $BASE_URL"
echo "Time: $(date)"
echo "-------------------------------------------"

# Function to run a k6 test
run_test() {
    local test_name=$1
    local test_file=$2
    echo "[+] Running $test_name..."
    k6 run -e BASE_URL=$BASE_URL "$SCENARIOS_DIR/$test_file"
}

# 1. Run Load Test
run_test "Load Test" "load.js"

# 2. Run Stress Test
run_test "Stress Test" "stress.js"

# 3. Run Endurance Test
run_test "Endurance Test" "endurance.js"

# 4. Run Spike Test
run_test "Spike Test" "spike.js"

# 5. Run Waste Submission Regression Test
run_test "Waste Submission Regression" "waste-submission-regression.js"

# 6. Generate/Update Baseline if requested
if [ "${GENERATE_BASELINE}" = "true" ]; then
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
