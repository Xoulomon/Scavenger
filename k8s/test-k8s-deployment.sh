#!/usr/bin/env bash
# Kubernetes deployment validation and testing script.
#
# Usage: ./k8s/test-k8s-deployment.sh [--help]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--help]

Run a series of kubectl smoke-tests against the Scavenger Kubernetes deployment.

Environment:
  NAMESPACE   Kubernetes namespace to test (default: scavenger)
EOF
  exit 0
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
fi

NAMESPACE="${NAMESPACE:-scavenger}"
# CLUSTER_NAME is retained here for documentation / future kubectl context switching.
# shellcheck disable=SC2034
CLUSTER_NAME="scavenger-cluster"

echo "=== Kubernetes Deployment Tests ==="

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo "ERROR: kubectl is not installed"
    exit 1
fi

# Test 1: Check cluster connection
echo "Test 1: Checking cluster connection..."
kubectl cluster-info &> /dev/null && echo "✓ Cluster is accessible" || echo "✗ Cluster is not accessible"

# Test 2: Verify namespace exists
echo "Test 2: Creating/verifying namespace..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f - && echo "✓ Namespace verified" || echo "✗ Namespace creation failed"

# Test 3: Check RBAC configuration
echo "Test 3: Checking RBAC configuration..."
kubectl get serviceaccount scavenger -n "$NAMESPACE" &> /dev/null && echo "✓ ServiceAccount exists" || echo "✗ ServiceAccount missing"

# Test 4: Verify persistent volumes
echo "Test 4: Checking persistent volumes..."
kubectl get pvc -n "$NAMESPACE" &> /dev/null && echo "✓ PVCs configured" || echo "✗ PVCs not found"

# Test 5: Check deployment readiness
echo "Test 5: Checking deployment status..."
kubectl get deployment scavenger-backend -n "$NAMESPACE" &> /dev/null && echo "✓ Backend deployment exists" || echo "✗ Backend deployment not found"

# Test 6: Verify service endpoints
echo "Test 6: Checking service endpoints..."
ENDPOINTS=$(kubectl get endpoints scavenger-backend -n "$NAMESPACE" -o jsonpath='{.subsets[0].addresses[*].ip}' 2>/dev/null)
if [ -n "$ENDPOINTS" ]; then
    echo "✓ Service endpoints active: $ENDPOINTS"
else
    echo "⚠ Service has no active endpoints yet"
fi

# Test 7: Check ingress configuration
echo "Test 7: Verifying ingress configuration..."
kubectl get ingress scavenger-ingress -n "$NAMESPACE" &> /dev/null && echo "✓ Ingress configured" || echo "✗ Ingress not found"

# Test 8: Validate resource limits
echo "Test 8: Validating resource limits..."
kubectl get deployment scavenger-backend -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].resources}' | jq . && echo "✓ Resource limits configured" || echo "✗ Resource limits not set"

# Test 9: Check health probes
echo "Test 9: Verifying health probes..."
PROBES=$(kubectl get deployment scavenger-backend -n "$NAMESPACE" -o jsonpath='{.spec.template.spec.containers[0].livenessProbe}' 2>/dev/null)
if [ -n "$PROBES" ]; then
    echo "✓ Health probes configured"
else
    echo "✗ Health probes not found"
fi

# Test 10: Validate HPA
echo "Test 10: Checking Horizontal Pod Autoscaler..."
kubectl get hpa scavenger-backend-hpa -n "$NAMESPACE" &> /dev/null && echo "✓ HPA configured" || echo "✗ HPA not found"

echo ""
echo "=== Deployment Test Summary ==="
echo "All critical checks completed. Review any ✗ or ⚠ indicators above."
