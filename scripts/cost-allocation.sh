#!/usr/bin/env bash
# Tag-based cost allocation report.
#
# Usage: ./scripts/cost-allocation.sh [--help]

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") [--help]

Generate a cost allocation breakdown by AWS tag for the Scavenger project.

Environment:
  ENVIRONMENT  Environment label  (default: prod)
  AWS_PROFILE  AWS CLI profile    (default: default)
EOF
  exit 0
fi
echo ""

apply_tags() {
  local resource_arn=$1
  shift
  local tags=("$@")

  if [ ${#tags[@]} -eq 0 ]; then
    return
  fi

  aws resourcegroupstaggingapi tag-resources \
    --resource-arn-list "$resource_arn" \
    --tags "$(printf '%s' "${tags[@]}")" \
    --profile "$PROFILE" 2>/dev/null || echo "WARNING: Failed to tag $resource_arn"
}

echo "1. Tagging ECS clusters..."
ECS_CLUSTERS=$(aws ecs list-clusters --query "clusterArns[]" --output text --profile "$PROFILE" --region us-east-1 2>/dev/null || echo "")
for cluster in $ECS_CLUSTERS; do
  if echo "$cluster" | grep -q "scavenger"; then
    echo "Tagging ECS cluster: $cluster"
    apply_tags "$cluster" \
      'Key=Project,Value=scavenger' \
      'Key=Environment,Value='"$ENVIRONMENT" \
      'Key=CostCenter,Value=Platform' \
      'Key=ManagedBy,Value=Terraform'
  fi
done

echo ""
echo "2. Tagging RDS instances..."
RDS_INSTANCES=$(aws rds describe-db-instances --query "DBInstances[?contains(DBInstanceIdentifier, 'scavenger')].DBInstanceArn" --output text --profile "$PROFILE" --region us-east-1 2>/dev/null || echo "")
for instance in $RDS_INSTANCES; do
  echo "Tagging RDS: $instance"
  apply_tags "$instance" \
    'Key=Project,Value=scavenger' \
    'Key=Environment,Value='"$ENVIRONMENT" \
    'Key=CostCenter,Value=Platform' \
    'Key=BackupPolicy,Value=Daily'
done

echo ""
echo "3. Tagging ALBs..."
ALB_ARNS=$(aws elbv2 describe-load-balancers --query "LoadBalancers[?contains(LoadBalancerName, 'scavenger')].LoadBalancerArn" --output text --profile "$PROFILE" --region us-east-1 2>/dev/null || echo "")
for alb in $ALB_ARNS; do
  echo "Tagging ALB: $alb"
  apply_tags "$alb" \
    'Key=Project,Value=scavenger' \
    'Key=Environment,Value='"$ENVIRONMENT" \
    'Key=CostCenter,Value=Platform'
done

echo ""
echo "4. Tagging S3 buckets..."
S3_BUCKETS=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'scavenger')].Name" --output text --profile "$PROFILE" 2>/dev/null || echo "")
for bucket in $S3_BUCKETS; do
  echo "Tagging S3: $bucket"
  BUCKET_ARN="arn:aws:s3:::$bucket"
  apply_tags "$BUCKET_ARN" \
    'Key=Project,Value=scavenger' \
    'Key=Environment,Value='"$ENVIRONMENT" \
    'Key=CostCenter,Value=Platform'
done

echo ""
echo "5. Verifying tag compliance..."
NON_COMPLIANT=$(aws resourcegroupstaggingapi get-resources \
  --tag-filters 'Key=Project,Values=scavenger' \
  --query "ResourceTagMappingList[].ResourceARN" \
  --output text --profile "$PROFILE" 2>/dev/null | wc -w)

echo "Tagged resources with Project=scavenger: $NON_COMPLIANT"

echo ""
echo "=== Cost Allocation Complete ==="
