#!/usr/bin/env bash
# Blue-green deployment script for Kubernetes.
#
# Usage: ./scripts/blue-green-deploy.sh [image] [--help]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [image] [--help]

Perform a blue-green deployment on Kubernetes.

Arguments:
  image   Docker image to deploy (default: scavenger:latest)

Environment:
  NAMESPACE         Kubernetes namespace           (default: scavenger-prod)
  SMOKE_TEST_URL    URL for smoke tests            (default: http://localhost/health)
  MONITOR_DURATION  Seconds to monitor after shift (default: 120)
  ERROR_THRESHOLD   Error count to trigger rollback (default: 10)
EOF
  exit 0
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
fi

NAMESPACE="${NAMESPACE:-scavenger-prod}"
BLUE_DEPLOYMENT="scavenger-blue"
GREEN_DEPLOYMENT="scavenger-green"
SERVICE="scavenger"
IMAGE="${1:-scavenger:latest}"
SMOKE_TEST_URL="${SMOKE_TEST_URL:-http://localhost/health}"
MONITOR_DURATION="${MONITOR_DURATION:-120}"
ERROR_THRESHOLD="${ERROR_THRESHOLD:-10}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

rollback() {
  echo ""
  echo "=== ROLLING BACK to blue ==="
  kubectl patch service "$SERVICE" \
    -n "$NAMESPACE" \
    -p '{"spec":{"selector":{"slot":"blue"}}}'
  kubectl scale deployment "$GREEN_DEPLOYMENT" --replicas=0 -n "$NAMESPACE" || true
  echo "Rollback complete. Blue is active."
  exit 1
}

trap rollback ERR

echo "Starting blue-green deployment..."
echo "Image    : $IMAGE"
echo "Namespace: $NAMESPACE"
echo ""

# Step 1: Update green deployment with new image
echo "Step 1: Updating green deployment with new image..."
kubectl set image "deployment/${GREEN_DEPLOYMENT}" \
  "scavenger=${IMAGE}" \
  -n "$NAMESPACE"

# Step 2: Scale up green deployment to match blue
BLUE_REPLICAS=$(kubectl get deployment "$BLUE_DEPLOYMENT" -n "$NAMESPACE" \
  -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "3")
echo "Step 2: Scaling green to $BLUE_REPLICAS replicas..."
kubectl scale deployment "$GREEN_DEPLOYMENT" \
  --replicas="$BLUE_REPLICAS" \
  -n "$NAMESPACE"

# Step 3: Wait for green deployment to be ready
echo "Step 3: Waiting for green deployment to be ready..."
kubectl rollout status "deployment/${GREEN_DEPLOYMENT}" \
  -n "$NAMESPACE" \
  --timeout=5m

# Step 4: Run smoke tests against green
echo "Step 4: Running smoke tests against green deployment..."
SMOKE_PASSED=0
for i in $(seq 1 30); do
  if kubectl run "smoke-test-${i}-$$" \
    --image=curlimages/curl:latest \
    --rm -i --restart=Never \
    -n "$NAMESPACE" \
    -- curl -sf "$SMOKE_TEST_URL" > /dev/null 2>&1; then
    echo "Smoke test passed!"
    SMOKE_PASSED=1
    break
  fi
  echo "Smoke test attempt $i/30 failed, retrying in 10s..."
  sleep 10
done

if [ "$SMOKE_PASSED" -eq 0 ]; then
  echo "Smoke tests failed after 30 attempts"
  rollback
fi

# Step 5: Switch traffic to green
echo "Step 5: Switching traffic to green deployment..."
kubectl patch service "$SERVICE" \
  -n "$NAMESPACE" \
  -p '{"spec":{"selector":{"slot":"green"}}}'

echo "Traffic switched to green. Waiting 15s for connections to stabilize..."
sleep 15

# Step 6: Monitor green for errors and health
echo "Step 6: Monitoring green deployment (${MONITOR_DURATION}s)..."
if ! NAMESPACE="$NAMESPACE" DURATION="$MONITOR_DURATION" ERROR_THRESHOLD="$ERROR_THRESHOLD" \
    bash "${SCRIPT_DIR}/monitor-deployment.sh" green; then
  echo "Monitoring detected unhealthy deployment."
  rollback
fi

# Step 7: Scale down blue deployment
echo "Step 7: Scaling down blue deployment (keeping 0 replicas for quick rollback)..."
kubectl scale deployment "$BLUE_DEPLOYMENT" \
  --replicas=0 \
  -n "$NAMESPACE"

echo ""
echo "Blue-green deployment completed successfully!"
echo "Green is now active. Blue is on standby (0 replicas) for quick rollback."
echo ""
echo "Manual rollback command:"
echo "  kubectl patch service $SERVICE -n $NAMESPACE -p '{\"spec\":{\"selector\":{\"slot\":\"blue\"}}}'"
echo "  kubectl scale deployment $BLUE_DEPLOYMENT --replicas=$BLUE_REPLICAS -n $NAMESPACE"
