#!/bin/bash
set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-prod}"
REPORT_DIR="${REPORT_DIR:-/tmp/capacity-reports}"
REPORT_DATE=$(date +%Y-%m-%d)

mkdir -p "$REPORT_DIR"

echo "=== Scavenger Capacity Report ==="
echo "Date: $REPORT_DATE"
echo "Environment: $ENVIRONMENT"
echo ""

generate_section() {
  local title=$1
  local metric=$2
  local namespace=$3
  local dimension_name=$4
  local dimension_value=$5
  local stat=$6

  echo "--- $title ---"

  local end_time
  end_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local start_time
  start_time=$(date -u -d "-7 days" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v"-7d" +"%Y-%m-%dT%H:%M:%SZ")

  local result
  result=$(aws cloudwatch get-metric-statistics \
    --namespace "$namespace" \
    --metric-name "$metric" \
    --dimensions Name="$dimension_name",Value="$dimension_value" \
    --start-time "$start_time" \
    --end-time "$end_time" \
    --period 3600 \
    --statistics "$stat" \
    --query "Datapoints[*].[Timestamp,$stat]" \
    --output json 2>/dev/null || echo "[]")

  local count
  count=$(echo "$result" | jq 'length' 2>/dev/null || echo "0")
  echo "Datapoints: $count"

  if [ "$count" -gt 0 ]; then
    local avg
    avg=$(echo "$result" | jq '[.[] | .[1]] | add/length' 2>/dev/null || echo "0")
    local max_val
    max_val=$(echo "$result" | jq '[.[] | .[1]] | max' 2>/dev/null || echo "0")
    local min_val
    min_val=$(echo "$result" | jq '[.[] | .[1]] | min' 2>/dev/null || echo "0")
    local p95
    p95=$(echo "$result" | jq '[.[] | .[1]] | sort | .[length * 95 / 100]' 2>/dev/null || echo "0")

    echo "Average: $avg"
    echo "Max: $max_val"
    echo "Min: $min_val"
    echo "P95: $p95"
    echo ""
  fi
}

generate_section "ECS CPU Utilization" "CPUUtilization" "AWS/ECS" "ClusterName" "scavenger-${ENVIRONMENT}" "Average"
generate_section "ECS Memory Utilization" "MemoryUtilization" "AWS/ECS" "ClusterName" "scavenger-${ENVIRONMENT}" "Average"
generate_section "ALB Request Count" "RequestCount" "AWS/ApplicationELB" "LoadBalancer" "app/scavenger-${ENVIRONMENT}" "Sum"
generate_section "ALB Target Response Time" "TargetResponseTime" "AWS/ApplicationELB" "LoadBalancer" "app/scavenger-${ENVIRONMENT}" "Average"
generate_section "RDS Connections" "DatabaseConnections" "AWS/RDS" "DBInstanceIdentifier" "scavenger-${ENVIRONMENT}" "Average"
generate_section "RDS Free Storage" "FreeStorageSpace" "AWS/RDS" "DBInstanceIdentifier" "scavenger-${ENVIRONMENT}" "Average"

cat > "${REPORT_DIR}/capacity-report-${REPORT_DATE}.md" << REPORTEOF
# Capacity Report - $REPORT_DATE

## Environment
$ENVIRONMENT

## Summary

### Compute
| Metric | Avg | Max | P95 | Status |
|--------|-----|-----|-----|--------|
REPORTEOF

echo ""
echo "Report saved to ${REPORT_DIR}/capacity-report-${REPORT_DATE}.md"
echo "=== Report Complete ==="
