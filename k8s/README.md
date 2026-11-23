# k8s — Kubernetes Manifests

This directory contains Kubernetes manifests that are **actively applied** by CI/CD.

## Manifests in use

| File             | Purpose                                            | Applied by                                                             |
| ---------------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| `deployment.yml` | Backend + frontend Deployments, Services, HPA, PDB | `deployment.yml` CI workflow via `kubectl apply -f k8s/deployment.yml` |
| `ingress.yml`    | Ingress rules, ConfigMap, Secrets template         | Applied manually per environment                                       |
| `rbac.yml`       | Namespace, ServiceAccount, Role, ClusterRole       | Applied manually on cluster bootstrap                                  |

## Guard: do not add new manifests without CI coverage

If you add a new manifest to this directory, you must wire it into the CI
deployment workflow (`.github/workflows/deployment.yml`) or document it in
this table. Orphaned manifests that are not applied by any pipeline will be
removed on the next cleanup pass.

## Previously removed files

The following were deleted in issues #1782 as unreferenced dead config (not
applied in any CI workflow and not part of any active operational runbook):

- `blue-green-deployment.yaml` — speculative blue/green setup, never promoted to CI
- `environment-promotion.yaml` — manual promotion scripts, superseded by GitHub Actions deployment workflow
- `environment-scaling.yaml` — per-namespace HPAs, superseded by HPA in `deployment.yml`
- `postgres-replication.yml` — Postgres StatefulSet, not deployed (RDS via Terraform instead)
- `persistent-volumes.yml` — hostPath PVs, never applied to any real cluster
- `pvc-storage.yml` — EBS PVCs, duplicate of Terraform RDS + ECS volume config
- `vault-agent-injector.yaml` — Vault sidecar config, not wired to any active Vault instance
- `Chart.yaml` — malformed Helm chart stub (invalid `helm.sh/v1` apiVersion), never packaged
- `backup-cronjob.yml` — DB and contract backup CronJobs, not applied in any cluster
- `multi-region/` — region health-check and traffic routing configs, multi-region not yet implemented
- `capacity-planning/` — speculative HPA/VPA configs, not applied to any real workload
