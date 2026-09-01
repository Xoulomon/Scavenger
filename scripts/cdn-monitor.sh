#!/bin/bash
set -euo pipefail

usage() {
  cat <<EOF
Usage: $0 <distribution-id> [window]

Examples:
  $0 E1234567890ABC
  $0 E1234567890ABC 30m

Environment variables:
  REGION   AWS region for CloudFront CLI requests (default: us-east-1)
  PERIOD   CloudWatch aggregation period in seconds (default: 300)
EOF
  exit 1
}

if [[ "${1:-}" == "-h" ]] || [[ "${1:-}" == "--help" ]]; then
  usage
fi

if [[ -z "${1:-}" ]]; then
  usage
fi

DISTRIBUTION_ID="$1"
WINDOW="${2:-15m}"
REGION="${REGION:-us-east-1}"
PERIOD="${PERIOD:-300}"

if ! [[ "$WINDOW" =~ ^[0-9]+m$ ]]; then
  echo "Error: window must be specified in minutes, e.g. 15m or 30m." >&2
  exit 1
fi

MINUTES="${WINDOW%m}"
START_TIME="$(date -u -d "${MINUTES} minutes ago" +%Y-%m-%dT%H:%M:%SZ)"
END_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

command -v aws >/dev/null 2>&1 || {
  echo "Error: AWS CLI is required to run this script." >&2
  exit 1
}

echo "CloudFront monitoring for $DISTRIBUTION_ID"
echo "Window: $WINDOW ($START_TIME to $END_TIME)"
echo "Region: $REGION"
echo "Period: $PERIOD seconds"
echo ""

metrics=(Requests BytesDownloaded 4xxErrorRate 5xxErrorRate CacheHitRate)

printf "%-18s %-12s %-10s\n" "METRIC" "STATISTIC" "VALUE"
printf "%-18s %-12s %-10s\n" "----------------" "------------" "----------"

for metric in "${metrics[@]}"; do
  if [[ "$metric" == "Requests" || "$metric" == "BytesDownloaded" ]]; then
    stat=Sum
  else
    stat=Average
  fi

  value=$(aws cloudwatch get-metric-statistics \
    --region "$REGION" \
    --namespace AWS/CloudFront \
    --metric-name "$metric" \
    --start-time "$START_TIME" \
    --end-time "$END_TIME" \
    --period "$PERIOD" \
    --statistics "$stat" \
    --dimensions Name=DistributionId,Value="$DISTRIBUTION_ID" \
    --query "sort_by(Datapoints,&Timestamp)[-1].$stat" \
    --output text 2>/dev/null || echo "N/A")

  if [[ "$value" == "None" || -z "$value" ]]; then
    value="N/A"
  fi

  printf "%-18s %-12s %-10s\n" "$metric" "$stat" "$value"
done

echo ""
echo "Tip: run '$0 $DISTRIBUTION_ID ${WINDOW:-15m}' again after deployment to compare metrics."
