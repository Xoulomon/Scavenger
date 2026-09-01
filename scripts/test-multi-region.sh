#!/bin/bash
set -euo pipefail

echo "=== Multi-Region Deployment Tests ==="
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

echo "1. Architecture Tests"
echo "---------------------"

run_test "Region failover script exists" "[ -f scripts/multi-region-failover.sh ]"
run_test "Region health check script exists" "[ -f scripts/region-health-check.sh ]"
run_test "Route53 config exists" "[ -f config/route53-multi-region.yaml ]"
run_test "Terraform multi-region module exists" "[ -d terraform/modules/multi_region ]"
run_test "Terraform main.tf exists in module" "[ -f terraform/modules/multi_region/main.tf ]"
run_test "Terraform variables.tf exists in module" "[ -f terraform/modules/multi_region/variables.tf ]"
run_test "Multi-region health check K8s exists" "[ -f k8s/multi-region/region-health-check.yaml ]"
run_test "Traffic routing config exists" "[ -f k8s/multi-region/traffic-routing.yaml ]"

echo ""
echo "2. Health Check Tests"
echo "---------------------"

run_test "Health check script is executable" "[ -x scripts/region-health-check.sh ]"
run_test "Failover script is executable" "[ -x scripts/multi-region-failover.sh ]"

echo ""
echo "3. Configuration Validation"
echo "---------------------------"

run_test "Route53 config has primary health check" "grep -q 'PrimaryHealthCheck' config/route53-multi-region.yaml"
run_test "Route53 config has secondary health check" "grep -q 'SecondaryHealthCheck' config/route53-multi-region.yaml"
run_test "Route53 config has failover routing" "grep -q 'Failover' config/route53-multi-region.yaml"
run_test "Traffic routing has failover strategy" "grep -q 'failover' k8s/multi-region/traffic-routing.yaml"

echo ""
echo "4. Data Replication Tests"
echo "--------------------------"

run_test "Terraform has S3 replication config" "grep -q 'aws_s3_bucket_replication_configuration' terraform/modules/multi_region/main.tf"
run_test "Terraform has VPC peering config" "grep -q 'aws_vpc_peering_connection' terraform/modules/multi_region/main.tf"
run_test "Terraform has Route53 failover records" "grep -q 'failover_routing_policy' terraform/modules/multi_region/main.tf"

echo ""
echo "=== Results ==="
echo "Total: $fail_count failures"
exit $fail_count
