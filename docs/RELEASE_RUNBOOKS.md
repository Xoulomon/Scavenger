# Release Runbooks

## Runbook: Standard Release

### Prerequisites
- [ ] All tests passing on main branch
- [ ] Security scan completed
- [ ] Performance benchmarks within baseline
- [ ] No blocking issues or bugs

### Steps
1. **Prepare Release**
   ```bash
   git checkout main
   git pull origin main
   ./scripts/release-automation.sh patch
   ```

2. **Review Changes**
   ```bash
   # Review version updates
   git diff

   # Review release notes
   cat RELEASE_NOTES_v*.md
   ```

3. **Push Release**
   ```bash
   git push origin main --tags
   ```

4. **Verify GitHub Actions**
   - Check the Release Management workflow completes successfully
   - Verify Docker images published to GHCR
   - Verify GitHub Release created

5. **Deploy to Production**
   - Use the deployment workflow to promote to production
   - Verify health checks pass
   - Monitor error rates for 30 minutes

## Runbook: Hotfix Release

### When to Use
- Critical security vulnerability
- Production outage
- Data loss or corruption

### Steps
1. **Create Hotfix Branch**
   ```bash
   git checkout main
   git checkout -b hotfix/description-of-fix
   ```

2. **Apply Fix**
   ```bash
   # Fix the issue and commit
   git add .
   git commit -m "fix: description of hotfix"
   ```

3. **Create Hotfix Release**
   ```bash
   ./scripts/release-automation.sh patch
   ```

4. **Push and Deploy**
   ```bash
   git push origin hotfix/description-of-fix --tags
   ```

5. **Merge Back**
   ```bash
   git checkout main
   git merge hotfix/description-of-fix
   git push origin main
   ```

## Runbook: Rollback

### When to Use
- Release causes production issues
- Performance degradation
- Increased error rates

### Steps
1. **Identify Previous Stable Version**
   ```bash
   ./scripts/release-tracking.sh list
   ```

2. **Redeploy Previous Version**
   ```bash
   # Revert the Kubernetes deployment
   kubectl set image deployment/scavenger-backend \
     scavenger-backend=ghcr.io/xoulomon/scavenger-backend:v1.0.0 \
     -n prod
   ```

3. **Verify Rollback**
   - Check health endpoints
   - Monitor error rates
   - Verify data integrity

4. **Post-Rollback Actions**
   - Create issue for the fix
   - Notify stakeholders
   - Schedule post-mortem

## Runbook: Release Verification

### Automated Checks
- [ ] All CI pipelines pass
- [ ] Docker images built and pushed
- [ ] GitHub Release created
- [ ] Staging deployment successful
- [ ] Health checks passing

### Manual Checks
- [ ] Smoke test critical user flows
- [ ] Verify API responses
- [ ] Check contract interactions
- [ ] Monitor dashboard metrics
- [ ] Verify logging and monitoring

## Communication Templates

### Pre-Release
```
Subject: [RELEASE] v{version} scheduled for {date}

The following changes will be deployed:
- {summary of changes}

Expected downtime: {duration}
Rollback plan: {link to runbook}
```

### Post-Release
```
Subject: [RELEASE] v{version} deployed successfully

Version: v{version}
Deployed at: {timestamp}
Status: {successful/failed}
Monitoring: {link to dashboard}
```

### Rollback Notification
```
Subject: [ROLLBACK] v{version} reverted to v{previous_version}

Reason: {description of issue}
Time to detect: {duration}
Time to rollback: {duration}
Next steps: {action items}
```
