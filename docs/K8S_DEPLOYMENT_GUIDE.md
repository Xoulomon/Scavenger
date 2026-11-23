# Kubernetes Deployment Guide

## Overview

This guide covers deploying Scavenger on a Kubernetes cluster with complete manifests for production-grade setup.

## Prerequisites

- Kubernetes 1.24+ cluster
- `kubectl` configured to access your cluster
- ECR or Docker registry with images pushed
- AWS EBS (for persistent volumes)

## Deployment Structure

### Manifests Included

1. **complete-deployment.yml**: Main deployment with:
   - Namespace creation
   - Backend deployment (3 replicas)
   - Service definition
   - Horizontal Pod Autoscaler
   - Pod Disruption Budget
   - ConfigMaps and Secrets

2. **ingress-complete.yml**: Ingress and frontend:
   - Ingress configuration with TLS
   - Frontend deployment
   - Service routing

3. **pvc-storage.yml**: Storage configuration:
   - StorageClass definition
   - PersistentVolumes
   - PersistentVolumeClaims

4. **rbac-complete.yml**: Access control:
   - ServiceAccount
   - ClusterRoles and Roles
   - RoleBindings

## Quick Start

### 1. Prepare Images

```bash
# Build and push Docker images
docker build -t YOUR_ECR_URI/scavenger-backend:latest backend/
docker push YOUR_ECR_URI/scavenger-backend:latest
```

### 2. Update Manifests

Replace `YOUR_ECR_URI` in all YAML files with your actual ECR URI.

### 3. Deploy to Cluster

```bash
# Create namespace and deploy
kubectl apply -f k8s/complete-deployment.yml
kubectl apply -f k8s/pvc-storage.yml
kubectl apply -f k8s/rbac-complete.yml
kubectl apply -f k8s/ingress-complete.yml
```

### 4. Verify Deployment

```bash
# Run deployment tests
bash k8s/test-k8s-deployment.sh

# Check pod status
kubectl get pods -n scavenger

# Check service endpoints
kubectl get svc -n scavenger

# View logs
kubectl logs -n scavenger deployment/scavenger-backend
```

## Configuration

### Environment Variables

Set in complete-deployment.yml:

- `RUST_LOG`: Logging level (default: info)
- `DATABASE_URL`: PostgreSQL connection string
- `STELLAR_NETWORK`: Network (testnet/mainnet)

### Resource Limits

Backend:

- CPU: 250m request / 500m limit
- Memory: 512Mi request / 1Gi limit

### Health Checks

- Liveness probe: /health (30s delay, 10s period)
- Readiness probe: /ready (10s delay, 5s period)

## Rollout Strategy

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

## Scaling

### Manual Scaling

```bash
kubectl scale deployment scavenger-backend --replicas=5 -n scavenger
```

### Autoscaling

HPA automatically scales between 3-10 replicas based on:

- CPU utilization: 70%
- Memory utilization: 80%

## Monitoring & Logs

### View logs

```bash
kubectl logs -f deployment/scavenger-backend -n scavenger
```

### Port forwarding

```bash
kubectl port-forward svc/scavenger-backend 8080:80 -n scavenger
```

### Pod disruption budget

Ensures minimum 2 replicas are always available during maintenance.

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod POD_NAME -n scavenger
kubectl logs POD_NAME -n scavenger
```

### Service not accessible

```bash
kubectl get endpoints scavenger-backend -n scavenger
kubectl get svc scavenger-backend -n scavenger
```

### Storage issues

```bash
kubectl get pvc -n scavenger
kubectl get pv
```

## Best Practices

1. **Always use namespaces** for isolation
2. **Set resource limits** to prevent resource exhaustion
3. **Use health checks** for reliability
4. **Enable HPA** for automatic scaling
5. **Use PodDisruptionBudgets** for high availability
6. **Implement RBAC** for security
7. **Regular backups** of persistent data

## Cleanup

```bash
# Delete all resources in namespace
kubectl delete namespace scavenger
```
