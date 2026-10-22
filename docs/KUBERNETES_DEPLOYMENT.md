# Kubernetes Deployment

## Overview
Production-ready Kubernetes manifests for deploying Scavenger on Kubernetes 1.25+.

## Components

### Deployment
- 3 replicas for high availability
- Rolling update strategy (maxSurge: 1, maxUnavailable: 0)
- Resource requests and limits
- Security context (non-root, read-only filesystem)
- Liveness and readiness probes

### Service
- ClusterIP service for internal communication
- Exposes HTTP (8080) and metrics (9090) ports
- Service discovery via DNS

### Horizontal Pod Autoscaler (HPA)
- Scales based on CPU (70%) and memory (80%) utilization
- Min replicas: 3, Max replicas: 10
- Aggressive scale-up, conservative scale-down

### Ingress
- NGINX ingress controller
- TLS termination with cert-manager
- Rate limiting (100 req/s)
- SSL redirect enabled

### RBAC
- ServiceAccount for pod identity
- Role with minimal permissions
- RoleBinding for authorization
- PodDisruptionBudget for availability

### Resource Management
- ResourceQuota for namespace isolation
- CPU: 10-20 cores
- Memory: 20-40 GB
- Pod limit: 100

## Installation

### Prerequisites
```bash
# Kubernetes 1.25+
kubectl version --client

# NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install ingress-nginx ingress-nginx/ingress-nginx

# Cert-Manager for TLS
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager --set installCRDs=true
```

### Deploy with kubectl

The base manifests live directly under `k8s/` and there is exactly one authoritative
manifest per resource type:

| Resource | Manifest |
|----------|----------|
| Deployment (backend + frontend) | `k8s/deployment.yml` |
| Ingress | `k8s/ingress.yml` |
| RBAC (ServiceAccount, Role, RoleBinding, PDB) | `k8s/rbac.yml` |
| Persistent volumes | `k8s/persistent-volumes.yml` |

Environment-specific differences (replica counts, image tags, hostnames, TLS issuers,
resource sizing, log levels) are expressed as Kustomize overlays in
`k8s/overlays/{dev,staging,prod}`. Do not edit the base manifests for a single
environment — add or change a patch in the relevant overlay instead.

```bash
# Create namespace
kubectl create namespace scavenger

# Apply the overlay for the target environment
kubectl apply -k k8s/overlays/dev
# or
kubectl apply -k k8s/overlays/staging
# or
kubectl apply -k k8s/overlays/prod

# Verify deployment
kubectl get pods -n scavenger
kubectl get svc -n scavenger
kubectl get ingress -n scavenger
```

### Validate overlays before applying

```bash
# Render each overlay to confirm it builds
kubectl kustomize k8s/overlays/dev
kubectl kustomize k8s/overlays/staging
kubectl kustomize k8s/overlays/prod

# Client-side dry run against the cluster
kubectl apply -k k8s/overlays/dev --dry-run=client
kubectl apply -k k8s/overlays/staging --dry-run=client
kubectl apply -k k8s/overlays/prod --dry-run=client
```

### Deploy with Helm
```bash
helm install scavenger ./k8s \
  --namespace scavenger \
  --values k8s/values.yaml
```

## Configuration

### Environment Variables
```yaml
RUST_LOG: info
STELLAR_NETWORK: testnet
CONTRACT_ID: <from-secret>
ADMIN_KEY: <from-secret>
```

### Secrets
```bash
kubectl create secret generic scavenger-secrets \
  --from-literal=contract_id=<value> \
  --from-literal=admin_key=<value> \
  --from-literal=token_address=<value> \
  -n scavenger
```

## Health Checks

### Liveness Probe
- Endpoint: `/health`
- Initial delay: 30s
- Period: 10s
- Failure threshold: 3

### Readiness Probe
- Endpoint: `/ready`
- Initial delay: 10s
- Period: 5s
- Failure threshold: 2

## Scaling

### Manual Scaling
```bash
kubectl scale deployment scavenger-contract --replicas=5 -n scavenger
```

### Auto-scaling
- Enabled by default
- Scales based on CPU and memory metrics
- Requires metrics-server

## Monitoring

### Prometheus Integration
- Metrics exposed on port 9090
- ServiceMonitor for Prometheus Operator
- Dashboards in Grafana

### Logs
- Collected by ELK stack
- Correlation IDs for tracing
- Structured JSON logging

## Troubleshooting

### Check Pod Status
```bash
kubectl describe pod <pod-name> -n scavenger
kubectl logs <pod-name> -n scavenger
```

### Check Events
```bash
kubectl get events -n scavenger
```

### Port Forwarding
```bash
kubectl port-forward svc/scavenger-contract 8080:80 -n scavenger
```

## GitOps with ArgoCD

### Install ArgoCD
```bash
helm repo add argo https://argoproj.github.io/argo-helm
helm install argocd argo/argo-cd
```

### Create Application
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: scavenger
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/xoulomon/scavenger
    targetRevision: main
    path: k8s/overlays/prod
  destination:
    server: https://kubernetes.default.svc
    namespace: scavenger
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

### Persistent Volumes

`k8s/persistent-volumes.yml` provisions PVs and PVCs for stateful services:

| PVC | Size | Used By |
|-----|------|---------|
| `scavenger-postgres-pvc` | 50Gi | PostgreSQL primary/replica |
| `scavenger-prometheus-pvc` | 20Gi | Prometheus TSDB |
| `scavenger-grafana-pvc` | 5Gi | Grafana dashboards/data |
| `scavenger-elasticsearch-pvc` | 30Gi | Elasticsearch log indices |

```bash
kubectl apply -f k8s/persistent-volumes.yml
```

> **Note:** The manifests use `hostPath` for development. For production, replace with a cloud-provider `StorageClass` (e.g., `gp3` on EKS, `pd-ssd` on GKE).

### Frontend Service

`k8s/deployment.yml` includes a `scavenger-frontend` Deployment and ClusterIP Service. The frontend reads `NEXT_PUBLIC_API_URL` from the `scavenger-config` ConfigMap. The Ingress routes `scavenger.app` traffic to this service.

## Deployment Order

Kustomize renders the base resources in dependency order, so a single `apply -k`
is sufficient. If you need to apply the base manifests manually, use:

```bash
kubectl apply -f k8s/rbac.yml
kubectl apply -f k8s/persistent-volumes.yml
kubectl apply -f k8s/deployment.yml
kubectl apply -f k8s/ingress.yml
```

For any real environment, prefer the overlay:

```bash
kubectl apply -k k8s/overlays/<env>
```

## Production Checklist

- [ ] Replace hostPath PVs with cloud-provider StorageClass
- [ ] Configure resource quotas
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategy
- [ ] Set up log aggregation
- [ ] Configure network policies
- [ ] Enable pod security policies
- [ ] Set up RBAC properly
- [ ] Configure ingress TLS
- [ ] Test disaster recovery
- [ ] Document runbooks
