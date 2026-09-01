#!/bin/bash
set -euo pipefail

check_region() {
  local region=$1
  local endpoint=$2

  echo "=== Region Health Check: $region ==="

  local http_status
  http_status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "https://$endpoint/health" 2>/dev/null || echo "000")

  if [ "$http_status" != "200" ]; then
    echo "STATUS: UNHEALTHY (HTTP $http_status)"
    return 1
  fi

  local response_time
  response_time=$(curl -s -o /dev/null -w "%{time_total}" --connect-timeout 10 "https://$endpoint/health" 2>/dev/null || echo "999")

  local db_status
  db_status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://$endpoint/health/db" 2>/dev/null || echo "000")

  local redis_status
  redis_status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "https://$endpoint/health/redis" 2>/dev/null || echo "000")

  echo "STATUS: HEALTHY"
  echo "HTTP: $http_status | Response: ${response_time}s | DB: $db_status | Redis: $redis_status"
  return 0
}

PRIMARY_REGION="${PRIMARY_REGION:-us-east-1}"
SECONDARY_REGION="${SECONDARY_REGION:-us-east-2}"
DOMAIN="${DOMAIN:-scavenger.app}"
PRIMARY_ENDPOINT="${PRIMARY_ENDPOINT:-$PRIMARY_REGION-scavenger.$DOMAIN}"
SECONDARY_ENDPOINT="${SECONDARY_ENDPOINT:-$SECONDARY_REGION-scavenger.$DOMAIN}"

primary_healthy=false
secondary_healthy=false

if check_region "$PRIMARY_REGION" "$PRIMARY_ENDPOINT"; then
  primary_healthy=true
fi

echo ""

if check_region "$SECONDARY_REGION" "$SECONDARY_ENDPOINT"; then
  secondary_healthy=true
fi

echo ""
echo "=== Summary ==="
echo "Primary ($PRIMARY_REGION): $([ "$primary_healthy" == true ] && echo 'HEALTHY' || echo 'UNHEALTHY')"
echo "Secondary ($SECONDARY_REGION): $([ "$secondary_healthy" == true ] && echo 'HEALTHY' || echo 'UNHEALTHY')"

if [ "$primary_healthy" == false ] && [ "$secondary_healthy" == false ]; then
  echo "CRITICAL: Both regions are unhealthy!"
  exit 2
elif [ "$primary_healthy" == false ]; then
  echo "WARNING: Primary region is unhealthy - failover recommended"
  exit 1
fi

exit 0
