#!/usr/bin/env bash
# Load balancer health check and monitoring.
#
# Usage: ./scripts/check-load-balancer.sh [--help]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--help]

Check the health of the ALB and its target groups, then report CloudWatch metrics.

Environment:
  ALB_NAME     Name of the Application Load Balancer (default: scavenger-alb)
  AWS_REGION   AWS region                             (default: us-east-1)
EOF
  exit 0
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
fi

ALB_NAME="${ALB_NAME:-scavenger-alb}"
REGION="${AWS_REGION:-us-east-1}"

echo "=== Load Balancer Health Check ==="

# Get ALB details
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names "$ALB_NAME" \
  --region "$REGION" \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

if [ -z "$ALB_ARN" ] || [ "$ALB_ARN" = "None" ]; then
  echo "✗ Load balancer not found"
  exit 1
fi

echo "✓ Load Balancer: $ALB_ARN"

# Get target groups
TARGET_GROUPS=$(aws elbv2 describe-target-groups \
  --load-balancer-arn "$ALB_ARN" \
  --region "$REGION" \
  --query 'TargetGroups[*].TargetGroupArn' \
  --output text)

for TG_ARN in $TARGET_GROUPS; do
  echo ""
  echo "Target Group: $TG_ARN"

  # Get target health
  TARGETS=$(aws elbv2 describe-target-health \
    --target-group-arn "$TG_ARN" \
    --region "$REGION" \
    --query 'TargetHealthDescriptions[*].[Target.Id,TargetHealth.State,TargetHealth.Reason]' \
    --output text)

  HEALTHY=0
  UNHEALTHY=0

  while IFS=$'\t' read -r target_id state reason; do
    if [ "$state" = "healthy" ]; then
      echo "  ✓ $target_id: $state"
      ((HEALTHY++))
    else
      echo "  ✗ $target_id: $state ($reason)"
      ((UNHEALTHY++))
    fi
  done <<< "$TARGETS"

  echo "  Summary: $HEALTHY healthy, $UNHEALTHY unhealthy"

  if [ "$UNHEALTHY" -gt 0 ]; then
    echo "  ⚠ Warning: Unhealthy targets detected"
  fi
done

# Get ALB metrics
echo ""
echo "=== ALB Metrics (Last 5 minutes) ==="

# Extract the suffix portion of the ARN for the LoadBalancer dimension value.
# The ARN format is: arn:aws:elasticloadbalancing:<region>:<account>:loadbalancer/<dimension>
ALB_DIMENSION=$(echo "$ALB_ARN" | cut -d: -f6)

aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions "Name=LoadBalancer,Value=${ALB_DIMENSION}" \
  --start-time "$(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
  --period 300 \
  --statistics Average \
  --region "$REGION" \
  --query 'Datapoints[0].Average' \
  --output text | xargs -I {} echo "Average Response Time: {} seconds"

echo ""
echo "✓ Health check completed"
