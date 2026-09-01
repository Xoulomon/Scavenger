# Deployment Runbook

Version: 1.0
Last updated: 2026-06-28
Owner: @on-call-team

---

## Prerequisites

- `kubectl` with access to the `scavenger-backend` namespace
- `aws` CLI with ECS/ECR access
- Docker logged in to the ECR registry
- `stellar` CLI for contract deployments
- CI/CD pipeline green on the release commit

---

## 1. Standard Backend Deploy

**Trigger:** Merging a release PR to `main`; CI publishes a new Docker image.

### Steps

```bash
# 1. Confirm the new image exists in ECR
IMAGE_TAG="<commit-sha>"
aws ecr describe-images \
  --repository-name scavenger-backend \
  --image-ids imageTag="$IMAGE_TAG" \
  --region us-east-1

# 2. Update the deployment image
kubectl set image deployment/scavenger-backend \
  backend=<account-id>.dkr.ecr.us-east-1.amazonaws.com/scavenger-backend:"$IMAGE_TAG" \
  -n scavenger-backend

# 3. Watch rollout (Kubernetes performs rolling update by default)
kubectl rollout status deployment/scavenger-backend -n scavenger-backend

# 4. Verify health
kubectl get pods -n scavenger-backend -l app=scavenger-backend
```

### Verification

```bash
# Run smoke tests against the API
curl -f https://api.scavenger.io/api/contracts/stats

# Check error rate in Grafana for 5 minutes post-deploy
# grafana.internal/d/api-latency
```

### Rollback

```bash
kubectl rollout undo deployment/scavenger-backend -n scavenger-backend
kubectl rollout status deployment/scavenger-backend -n scavenger-backend
```

---

## 2. Frontend Deploy

**Trigger:** CI builds and publishes a new static bundle to S3 + CloudFront.

### Steps

```bash
# 1. Build the frontend
cd frontend
npm ci
VITE_API_BASE_URL=https://api.scavenger.io npm run build

# 2. Sync to S3
aws s3 sync dist/ s3://scavenger-frontend-prod/ \
  --delete \
  --cache-control "public, max-age=31536000, immutable" \
  --exclude "index.html"

# Upload index.html with no-cache so users always get the latest entrypoint
aws s3 cp dist/index.html s3://scavenger-frontend-prod/index.html \
  --cache-control "no-cache, no-store, must-revalidate"

# 3. Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/*"
```

### Verification

```bash
# Confirm new bundle version is live
curl -s https://scavenger.io | grep -o 'assets/index-[a-z0-9]*\.js'
# Should match the hash in the new build's dist/assets/ directory
```

### Rollback

CloudFront serves the S3 objects. To roll back, re-sync the previous build artifact:

```bash
aws s3 sync s3://scavenger-frontend-releases/<previous-tag>/ \
  s3://scavenger-frontend-prod/ \
  --delete

aws cloudfront create-invalidation \
  --distribution-id "$CF_DISTRIBUTION_ID" \
  --paths "/*"
```

---

## 3. Database Migration

**Trigger:** A PR that includes SQL migration files in `migrations/`.

### Pre-migration checklist

- [ ] Migration has been reviewed and approved by a second engineer
- [ ] Migration is backward-compatible with the current deployed code (no column drops without a multi-phase approach)
- [ ] A backup has been taken: see [common-procedures.md — Database Backup](./common-procedures.md#3-database-backup-and-restore)
- [ ] Migration has been run successfully against the staging database

### Steps

```bash
# 1. Connect to the migration runner pod (or run via CI)
kubectl exec -it \
  $(kubectl get pod -l app=scavenger-backend -n scavenger-backend -o name | head -1) \
  -n scavenger-backend \
  -- /bin/sh

# 2. Run pending migrations
diesel migration run --database-url "$DATABASE_URL"

# 3. Verify applied migrations
diesel migration list --database-url "$DATABASE_URL"
```

### Rollback

```bash
# Revert the last migration
diesel migration revert --database-url "$DATABASE_URL"
```

Only one migration can be reverted at a time. For multi-step rollbacks, run the command once per migration to revert.

---

## 4. Hot-Fix Deploy

**Trigger:** A critical bug (SEV-1/2) is fixed and needs to be deployed outside the normal release cycle.

Hot-fixes bypass the normal PR review cadence but still require:
- Sign-off from one other engineer
- CI passing on the fix commit
- Notification in #releases Slack channel

### Steps

```bash
# 1. Cherry-pick fix to a release branch or build directly from the fix commit
git checkout -b hotfix/sev1-<short-description> main
git cherry-pick <fix-commit-sha>
git push origin hotfix/sev1-<short-description>

# 2. CI builds and pushes the image — wait for it to complete

# 3. Deploy following standard backend deploy steps above
IMAGE_TAG="<fix-commit-sha>"
kubectl set image deployment/scavenger-backend \
  backend=<ecr-url>:"$IMAGE_TAG" \
  -n scavenger-backend

kubectl rollout status deployment/scavenger-backend -n scavenger-backend

# 4. Merge hotfix branch back to main after the incident is resolved
```

---

## 5. Blue-Green Cutover (Major Releases)

For major version releases that require zero-downtime cutover between incompatible API versions:

```bash
# 1. Deploy new version to the "green" deployment (separate from active "blue")
kubectl apply -f k8s/green-deployment.yaml

# 2. Smoke test green
kubectl port-forward service/scavenger-backend-green 8081:8080 -n scavenger-backend &
curl http://localhost:8081/api/contracts/stats

# 3. Switch the Service selector to green
kubectl patch service scavenger-backend \
  -n scavenger-backend \
  -p '{"spec": {"selector": {"slot": "green"}}}'

# 4. Monitor for 10 minutes; if healthy, scale down blue
kubectl scale deployment scavenger-backend-blue --replicas=0 -n scavenger-backend
```

Rollback: patch selector back to `blue` and scale blue up.

---

## 6. Deployment Verification Checklist

Run after every deploy before closing the deployment ticket:

- [ ] `kubectl get pods` — all pods `Running`, no `CrashLoopBackOff`
- [ ] `kubectl rollout status` — rollout complete
- [ ] API smoke test passes: `curl -f https://api.scavenger.io/api/contracts/stats`
- [ ] Error rate in Grafana is normal for 5 minutes post-deploy
- [ ] P95 latency in Grafana is normal for 5 minutes post-deploy
- [ ] No new alerts firing in PagerDuty
- [ ] Post deployment note in #releases: "Deployed `<version>` to prod ✓"
