#!/usr/bin/env bash
# Blue-green deployment monitoring script.
# Tracks pod health, error rates, and latency during a deployment.
#
# Usage: ./scripts/monitor-deployment.sh [slot] [--help]

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") [slot] [--help]

Monitor pod health, error rates, and latency for a blue-green deployment slot.

Arguments:
  slot   Deployment slot to monitor (default: green)

Environment:
  NAMESPACE          Kubernetes namespace  (default: scavenger-prod)
  DURATION           Monitoring duration in seconds (default: 120)
  ERROR_THRESHOLD    Max errors in tail-100 logs before alerting (default: 10)
  PROMETHEUS_URL     Prometheus base URL  (default: http://localhost:9090)
EOF
  exit 0
fi

NAMESPACE="${NAMESPACE:-scavenger-prod}"
SLOT="${1:-green}"
DURATION="${DURATION:-120}"
ERROR_THRESHOLD="${ERROR_THRESHOLD:-10}"
PROMETHEUS_URL="${PROMETHEUS_URL:-http://localhost:9090}"
CHECK_INTERVAL=10

echo "=== Deployment Monitor ==="
echo "Namespace : $NAMESPACE"
echo "Slot      : $SLOT"
echo "Duration  : ${DURATION}s"
echo "Threshold : $ERROR_THRESHOLD errors in tail-100 logs"
echo ""

START_TIME=$(date +%s)
FAILED=0

query_prometheus() {
  local query="$1"
  curl -sf "${PROMETHEUS_URL}/api/v1/query" \
    --data-urlencode "query=${query}" \
    2>/dev/null | grep -o '"value":\[[^]]*\]' | grep -o '[0-9.]*$' || echo "N/A"
}

check_pods() {
  local ready total
  ready=$(kubectl get deployment "scavenger-${SLOT}" -n "$NAMESPACE" \
    -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
  total=$(kubectl get deployment "scavenger-${SLOT}" -n "$NAMESPACE" \
    -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")
  echo "${ready:-0}/${total:-0}"
}

check_errors() {
  kubectl logs -l "app=scavenger,slot=${SLOT}" \
    -n "$NAMESPACE" \
    --tail=100 \
    2>/dev/null | grep -ic "error\|exception\|panic" || echo "0"
}

check_restarts() {
  kubectl get pods -l "app=scavenger,slot=${SLOT}" \
    -n "$NAMESPACE" \
    -o jsonpath='{range .items[*]}{.status.containerStatuses[0].restartCount}{"\n"}{end}' \
    2>/dev/null | awk '{s+=$1} END {print s+0}'
}

print_header() {
  printf "%-20s %-12s %-10s %-10s %-10s %-10s\n" \
    "TIME" "PODS" "ERRORS" "RESTARTS" "CPU(avg)" "MEM(avg)"
  printf "%-20s %-12s %-10s %-10s %-10s %-10s\n" \
    "--------------------" "------------" "----------" "----------" "----------" "----------"
}

print_header

while true; do
  NOW=$(date +%s)
  ELAPSED=$(( NOW - START_TIME ))

  if [ "$ELAPSED" -ge "$DURATION" ]; then
    echo ""
    echo "Monitoring window complete (${DURATION}s elapsed)."
    break
  fi

  TIMESTAMP=$(date '+%H:%M:%S')
  PODS=$(check_pods)
  ERRORS=$(check_errors)
  RESTARTS=$(check_restarts)
  CPU=$(query_prometheus "avg(rate(container_cpu_usage_seconds_total{pod=~\"scavenger-${SLOT}-.*\",namespace=\"${NAMESPACE}\"}[2m]))")
  MEM=$(query_prometheus "avg(container_memory_working_set_bytes{pod=~\"scavenger-${SLOT}-.*\",namespace=\"${NAMESPACE}\"})")

  printf "%-20s %-12s %-10s %-10s %-10s %-10s\n" \
    "$TIMESTAMP" "$PODS" "$ERRORS" "$RESTARTS" "$CPU" "$MEM"

  if [ "$ERRORS" -gt "$ERROR_THRESHOLD" ]; then
    echo ""
    echo "ERROR: Error count ($ERRORS) exceeds threshold ($ERROR_THRESHOLD)."
    FAILED=1
    break
  fi

  sleep "$CHECK_INTERVAL"
done

echo ""
if [ "$FAILED" -eq 1 ]; then
  echo "RESULT: DEPLOYMENT UNHEALTHY - consider rollback:"
  echo "  kubectl patch service scavenger -n ${NAMESPACE} -p '{\"spec\":{\"selector\":{\"slot\":\"blue\"}}}'"
  exit 1
else
  echo "RESULT: DEPLOYMENT HEALTHY"
  echo "Pods    : $(check_pods)"
  echo "Errors  : $(check_errors)"
  echo "Restarts: $(check_restarts)"
fi
