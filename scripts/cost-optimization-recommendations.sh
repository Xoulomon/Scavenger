#!/bin/bash
set -euo pipefail

ENVIRONMENT="${ENVIRONMENT:-prod}"
PROFILE="${AWS_PROFILE:-default}"
OUTPUT_DIR="${OUTPUT_DIR:-/tmp/cost-recommendations}"

mkdir -p "$OUTPUT_DIR"

echo "=== Cost Optimization Recommendations ==="
echo ""

analyze_ecs() {
  echo "--- ECS Right-sizing ---"
  local clusters
  clusters=$(aws ecs list-clusters --query "clusterArns[]" --output text --profile "$PROFILE" --region us-east-1 2>/dev/null || echo "")

  for cluster in $clusters; do
    if echo "$cluster" | grep -q "scavenger"; then
      local services
      services=$(aws ecs list-services --cluster "$cluster" --query "serviceArns[]" --output text --profile "$PROFILE" --region us-east-1 2>/dev/null || echo "")

      for service in $services; do
        local cpu_util
        cpu_util=$(aws cloudwatch get-metric-statistics \
          --namespace AWS/ECS \
          --metric-name CPUUtilization \
          --dimensions Name=ClusterName,Value=$(basename "$cluster") Name=ServiceName,Value=$(basename "$service") \
          --start-time "$(date -u -d '-7 days' +'%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -v'-7d' +'%Y-%m-%dT%H:%M:%SZ')" \
          --end-time "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
          --period 86400 \
          --statistics Average \
          --query "Datapoints[0].Average" \
          --output text --profile "$PROFILE" --region us-east-1 2>/dev/null || echo "0")

        if [ -n "$cpu_util" ] && [ "$cpu_util" != "0" ] && [ "$(echo "$cpu_util < 20" | bc -l 2>/dev/null || echo 1)" -eq 1 ]; then
          echo "RECOMMENDATION: Service $(basename $service) has ${cpu_util}% CPU utilization - consider downscaling"
        elif [ -n "$cpu_util" ] && [ "$cpu_util" != "0" ] && [ "$(echo "$cpu_util > 80" | bc -l 2>/dev/null || echo 0)" -eq 1 ]; then
          echo "RECOMMENDATION: Service $(basename $service) has ${cpu_util}% CPU utilization - consider upscaling"
        fi
      done
    fi
  done
}

analyze_rds() {
  echo ""
  echo "--- RDS Optimization ---"
  local instances
  instances=$(aws rds describe-db-instances --query "DBInstances[?contains(DBInstanceIdentifier, 'scavenger')].[DBInstanceIdentifier,DBInstanceClass,AllocatedStorage]" --output text --profile "$PROFILE" --region us-east-1 2>/dev/null || echo "")

  while IFS=$'\t' read -r id instance_class storage; do
    if [ -z "$id" ]; then continue; fi

    local storage_util
    storage_util=$(aws cloudwatch get-metric-statistics \
      --namespace AWS/RDS \
      --metric-name FreeStorageSpace \
      --dimensions Name=DBInstanceIdentifier,Value="$id" \
      --start-time "$(date -u -d '-7 days' +'%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -v'-7d' +'%Y-%m-%dT%H:%M:%SZ')" \
      --end-time "$(date -u +'%Y-%m-%dT%H:%M:%SZ')" \
      --period 86400 \
      --statistics Average \
      --query "Datapoints[0].Average" \
      --output text --profile "$PROFILE" --region us-east-1 2>/dev/null || echo "0")

    local free_storage_gb
    free_storage_gb=$(echo "$storage_util / 1073741824" | bc -l 2>/dev/null || echo "0")
    local storage_usage_pct
    storage_usage_pct=$(echo "($storage - $free_storage_gb) / $storage * 100" | bc -l 2>/dev/null || echo "0")

    if [ "$(echo "$storage_usage_pct < 20" | bc -l 2>/dev/null || echo 0)" -eq 1 ]; then
      echo "RECOMMENDATION: RDS $id is ${storage_usage_pct}% utilized - consider downsizing storage"
    fi
  done <<< "$instances"
}

analyze_s3() {
  echo ""
  echo "--- S3 Storage Optimization ---"
  local buckets
  buckets=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'scavenger')].Name" --output text --profile "$PROFILE" 2>/dev/null || echo "")

  for bucket in $buckets; do
    local lifecycle_exists
    lifecycle_exists=$(aws s3api get-bucket-lifecycle-configuration --bucket "$bucket" --profile "$PROFILE" 2>/dev/null || echo "NOT_CONFIGURED")

    if [ "$lifecycle_exists" = "NOT_CONFIGURED" ]; then
      echo "RECOMMENDATION: S3 bucket $bucket has no lifecycle policy - consider adding one"
    fi
  done
}

generate_report() {
  local report_file="${OUTPUT_DIR}/cost-recommendations-$(date +%Y-%m-%d).md"

  cat > "$report_file" << EOF
# Cost Optimization Recommendations
Generated: $(date)

## Summary

### Compute
- Review ECS task sizing for under/over-utilized services
- Increase spot instance usage for non-critical workloads
- Implement scheduled scaling for predictable patterns

### Storage
- Add lifecycle policies to S3 buckets for data tiering
- Review RDS storage allocation and downsize over-provisioned instances
- Enable backup compression for EBS snapshots

### Network
- Review NAT Gateway usage and consider VPC endpoints
- Optimize cross-region data transfer costs
- Use CloudFront for static content delivery

## Recommendations

EOF

  echo "Report saved to $report_file"
}

analyze_ecs
analyze_rds
analyze_s3
generate_report

echo ""
echo "=== Optimization Analysis Complete ==="
