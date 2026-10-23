#!/usr/bin/env bash
# Cost monitoring test suite.
#
# Usage: ./scripts/test-cost-monitoring.sh [--help]

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") [--help]

Run cost monitoring tests — verifies that cost tracking, alerting thresholds,
and budget configurations are correctly in place.  Exits 1 if any test fails.
EOF
  exit 0
fi

echo "=== Cost Monitoring Tests ==="
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

echo "1. Cost Tracking Tests"
echo "----------------------"
run_test "Cost report script exists" "[ -f scripts/cost-report.sh ]"
run_test "Cost report is executable" "[ -x scripts/cost-report.sh ]"
run_test "Cost allocation script exists" "[ -f scripts/cost-allocation.sh ]"
run_test "Cost allocation is executable" "[ -x scripts/cost-allocation.sh ]"

echo ""
echo "2. Dashboard Tests"
echo "------------------"
run_test "Grafana cost dashboard exists" "[ -f config/grafana/provisioning/dashboards/cost-monitoring.json ]"
run_test "Dashboard has cost panels" "grep -q 'Monthly Spend' config/grafana/provisioning/dashboards/cost-monitoring.json"
run_test "Dashboard has budget gauge" "grep -q 'Budget Status' config/grafana/provisioning/dashboards/cost-monitoring.json"
run_test "Dashboard has cost by service" "grep -q 'Cost by Service' config/grafana/provisioning/dashboards/cost-monitoring.json"

echo ""
echo "3. Budget Alert Tests"
echo "---------------------"
run_test "Cost budget config exists" "[ -f config/cost-budget-alerts.yaml ]"
run_test "Budget config has notifications" "grep -q 'notifications' config/cost-budget-alerts.yaml"
run_test "Budget config has anomaly detection" "grep -q 'cost_anomaly' config/cost-budget-alerts.yaml"
run_test "Budget config has cost allocation" "grep -q 'cost_allocation' config/cost-budget-alerts.yaml"

echo ""
echo "4. Optimization Tests"
echo "---------------------"
run_test "Optimization recommendations script exists" "[ -f scripts/cost-optimization-recommendations.sh ]"
run_test "Optimization script is executable" "[ -x scripts/cost-optimization-recommendations.sh ]"
run_test "Optimization script has ECS analysis" "grep -q 'analyze_ecs' scripts/cost-optimization-recommendations.sh"
run_test "Optimization script has RDS analysis" "grep -q 'analyze_rds' scripts/cost-optimization-recommendations.sh"

echo ""
echo "=== Results ==="
echo "Total: $fail_count failures"
exit $fail_count
