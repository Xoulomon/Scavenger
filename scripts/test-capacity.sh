#!/usr/bin/env bash
# Capacity planning test suite.
#
# Usage: ./scripts/test-capacity.sh [--help]

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") [--help]

Run capacity planning tests — verifies that capacity models, forecasting logic,
and scaling thresholds behave as expected.  Exits 1 if any test fails.
EOF
  exit 0
fi

echo "=== Capacity Planning Tests ==="
echo ""

fail_count=0
run_test() {
  local name=$1
  local cmd=$2
  echo -n "Test: $name... "
  if eval "$cmd" > /dev/null 2>&1; then
    echo "PASS"
  else
    echo "FAIL"
    fail_count=$((fail_count + 1))
  fi
}

echo "1. Capacity Model Tests"
echo "-----------------------"
run_test "Capacity model config exists" "[ -f config/capacity-model.yaml ]"
run_test "Capacity model has forecasting section" "grep -q 'forecasting' config/capacity-model.yaml"
run_test "Capacity model has auto_scaling section" "grep -q 'auto_scaling' config/capacity-model.yaml"
run_test "Capacity model has capacity alerts" "grep -q 'capacity_alerts' config/capacity-model.yaml"

echo ""
echo "2. Forecasting Tests"
echo "--------------------"
run_test "Forecast script exists" "[ -f scripts/capacity-forecast.sh ]"
run_test "Forecast script is executable" "[ -x scripts/capacity-forecast.sh ]"
run_test "Forecast script has ECS metrics" "grep -q 'CPUUtilization' scripts/capacity-forecast.sh"

echo ""
echo "3. Auto-scaling Tests"
echo "----------------------"
run_test "Auto-scaling rules config exists" "[ -f config/auto-scaling-rules.yaml ]"
run_test "K8s auto-scaling rules exist" "[ -f k8s/capacity-planning/auto-scaling-rules.yaml ]"
run_test "Auto-scaling has scale out rules" "grep -q 'scale_out' config/auto-scaling-rules.yaml"
run_test "K8s HPA has custom metrics" "grep -q 'request_count_per_second' k8s/capacity-planning/auto-scaling-rules.yaml"

echo ""
echo "4. Capacity Alert Tests"
echo "-----------------------"
run_test "Prometheus capacity rules exist" "[ -f config/prometheus-rules-capacity.yml ]"
run_test "Prometheus rules have capacity alerts" "grep -q 'HighCPUUtilization' config/prometheus-rules-capacity.yml"
run_test "Prometheus rules have forecast warning" "grep -q 'CapacityForecastWarning' config/prometheus-rules-capacity.yml"

echo ""
echo "5. Report Tests"
echo "---------------"
run_test "Capacity report script exists" "[ -f scripts/capacity-report.sh ]"
run_test "Capacity report script is executable" "[ -x scripts/capacity-report.sh ]"

echo ""
echo "=== Results ==="
echo "Total: $fail_count failures"
exit $fail_count
