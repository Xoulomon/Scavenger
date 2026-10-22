#!/usr/bin/env bash
# Forecast future capacity requirements.
#
# Usage: ./scripts/capacity-forecast.sh [--help]

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") [--help]

Analyse historical resource usage and project capacity requirements.

Environment:
  ENVIRONMENT    Environment label        (default: prod)
  DAYS_HISTORY   Days of history to use   (default: 90)
  DAYS_FORECAST  Days to forecast ahead   (default: 30)
  OUTPUT_DIR     Report output directory  (default: /tmp/capacity-reports)
EOF
  exit 0
fi

mkdir -p "$OUTPUT_DIR"

echo "=== Scavenger Capacity Forecast ==="
echo "Environment: $ENVIRONMENT"
echo "History: $DAYS_HISTORY days"
echo "Forecast: $DAYS_FORECAST days"
echo ""

forecast_metric() {
  local metric_name=$1
  local namespace=$2
  local dimension_name=$3
  local dimension_value=$4
  local stat=$5
  local output_file="${OUTPUT_DIR}/forecast-${metric_name//\//-}.json"

  echo "Forecasting $metric_name..."

  local end_time
  end_time=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  local start_time
  start_time=$(date -u -d "-${DAYS_HISTORY} days" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u -v"-${DAYS_HISTORY}d" +"%Y-%m-%dT%H:%M:%SZ")

  aws cloudwatch get-metric-statistics \
    --namespace "$namespace" \
    --metric-name "$metric_name" \
    --dimensions Name="$dimension_name",Value="$dimension_value" \
    --start-time "$start_time" \
    --end-time "$end_time" \
    --period 3600 \
    --statistics "$stat" \
    --query "Datapoints[*].[Timestamp,$stat]" \
    --output json > "$output_file" 2>/dev/null || echo "WARNING: Could not fetch $metric_name"

  local datapoints
  datapoints=$(cat "$output_file" | jq 'length' 2>/dev/null || echo "0")
  echo "  Collected $datapoints datapoints"

  local avg
  avg=$(cat "$output_file" | jq '[.[] | .[1]] | if length > 0 then add/length else 0 end' 2>/dev/null || echo "0")
  local max_val
  max_val=$(cat "$output_file" | jq '[.[] | .[1]] | max' 2>/dev/null || echo "0")

  local growth_rate=0.10
  local forecast_value
  forecast_value=$(echo "$avg * (1 + $growth_rate) ^ (${DAYS_FORECAST} / 30)" | bc -l 2>/dev/null || echo "$avg")

  echo "  Current average: $avg"
  echo "  Current max: $max_val"
  echo "  Forecast (${DAYS_FORECAST}d): $forecast_value"

  cat > "${output_file%.json}-report.json" << EOF
{
  "metric": "$metric_name",
  "namespace": "$namespace",
  "environment": "$ENVIRONMENT",
  "forecast_horizon_days": $DAYS_FORECAST,
  "current_avg": $avg,
  "current_max": $max_val,
  "forecast_value": $forecast_value,
  "growth_rate": $growth_rate,
  "generated_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
}

echo "Forecasting ECS metrics..."
forecast_metric "CPUUtilization" "AWS/ECS" "ClusterName" "scavenger-${ENVIRONMENT}" "Average"
forecast_metric "MemoryUtilization" "AWS/ECS" "ClusterName" "scavenger-${ENVIRONMENT}" "Average"

echo ""
echo "Forecasting ALB metrics..."
forecast_metric "RequestCount" "AWS/ApplicationELB" "LoadBalancer" "app/scavenger-${ENVIRONMENT}" "Sum"
forecast_metric "TargetResponseTime" "AWS/ApplicationELB" "LoadBalancer" "app/scavenger-${ENVIRONMENT}" "Average"

echo ""
echo "Forecasting RDS metrics..."
forecast_metric "DatabaseConnections" "AWS/RDS" "DBInstanceIdentifier" "scavenger-${ENVIRONMENT}" "Average"
forecast_metric "FreeStorageSpace" "AWS/RDS" "DBInstanceIdentifier" "scavenger-${ENVIRONMENT}" "Average"

echo ""
echo "Generating combined report..."
cat > "${OUTPUT_DIR}/capacity-forecast-summary.json" << EOF
{
  "environment": "$ENVIRONMENT",
  "forecast_date": "$(date -u +"%Y-%m-%d")",
  "forecast_horizon_days": $DAYS_FORECAST,
  "recommendations": []
}
EOF

echo "Forecast complete. Reports saved to $OUTPUT_DIR"
