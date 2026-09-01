# Incident Response Runbook

Version: 1.0
Last updated: 2026-06-28
Owner: @on-call-team

---

## Severity Definitions

| SEV | Criteria | Response time | Examples |
|-----|----------|--------------|---------|
| **SEV-1** | Complete service outage or data loss | 15 min | API down, DB unreachable, contract calls failing for all users |
| **SEV-2** | Partial outage or significant degradation | 30 min | Error rate > 10 %, latency > 5 s P95, one region down |
| **SEV-3** | Minor degradation, single feature broken | 2 hours | Export failures, email delays, WebSocket intermittent |
| **SEV-4** | Low-impact bug, cosmetic | Next business day | UI glitch, non-critical API endpoint slow |

---

## Incident Lifecycle

```
Detect → Declare → Diagnose → Mitigate → Resolve → Post-mortem
```

---

## Phase 1 — Detect

Incidents are detected via:
- Grafana alert firing (PagerDuty escalation)
- User report in #support Slack channel
- Automated smoke-test failure in CI

When you receive an alert, open the monitoring dashboard immediately:

```
grafana.internal/d/api-latency   ← API latency and error rates
grafana.internal/d/infra          ← CPU, memory, disk, network
```

---

## Phase 2 — Declare

**Do not wait to have all the facts before declaring.** Declaring early keeps the team coordinated.

### SEV-1 / SEV-2

```
1. Post in #incidents Slack channel:
   "SEV-[1/2] DECLARED: <short description>. IC: @your-name. Bridge: <link>."

2. Page the on-call engineer if not already engaged:
   pd incident create --title "<description>" --severity critical

3. Open a video bridge immediately.
```

### SEV-3 / SEV-4

```
Post in #incidents: "SEV-[3/4] TRACKING: <short description>. Owner: @your-name."
No bridge needed. Update thread with progress.
```

---

## Phase 3 — Diagnose

Work through [troubleshooting.md](./troubleshooting.md) for the relevant symptom.

Collect and share in the incident thread:

- [ ] Which endpoints / features are affected?
- [ ] When did the problem start? (check Grafana for exact timestamp)
- [ ] What changed recently? (deploys, config changes, infra changes)
- [ ] What is the blast radius? (all users, subset, single region?)
- [ ] Are there upstream dependencies involved? (Stellar network, SendGrid, S3)

### Useful diagnostic commands

```bash
# Recent deploys
kubectl rollout history deployment/scavenger-backend -n scavenger-backend

# Pod status
kubectl get pods -n scavenger-backend

# Recent errors (last 10 minutes)
kubectl logs -l app=scavenger-backend -n scavenger-backend --since=10m \
  | jq 'select(.level == "ERROR")'

# Node resource pressure
kubectl top nodes
kubectl top pods -n scavenger-backend
```

---

## Phase 4 — Mitigate

Mitigation stops the bleeding. It does not have to be the final fix.

### Common mitigations

| Situation | Mitigation |
|-----------|-----------|
| Bad deploy causing errors | **Rollback** — see [deployment.md](./deployment.md#rollback) |
| Traffic spike causing latency | **Scale up** — see [common-procedures.md](./common-procedures.md#1-horizontal-scaling) |
| Runaway process consuming CPU | Restart the affected pod: `kubectl delete pod <name> -n scavenger-backend` |
| Database connection exhaustion | Restart backend pods to reset connection pool |
| Stellar network outage | Enable read-only mode: set `STELLAR_READ_ONLY=true` env var and restart |
| Compromised credentials | **Rotate secrets** — see [common-procedures.md](./common-procedures.md#2-secret-rotation-automated) |

### Read-only mode

When Stellar is unavailable, the backend can serve cached data by setting:

```bash
kubectl set env deployment/scavenger-backend \
  STELLAR_READ_ONLY=true \
  -n scavenger-backend

kubectl rollout status deployment/scavenger-backend -n scavenger-backend
```

In read-only mode:
- `GET` endpoints continue to serve cached data
- Mutating endpoints (`POST`, `PUT`, `PATCH`, `DELETE`) return HTTP 503 with `{ "error": "service_unavailable" }`
- The frontend shows a maintenance banner

Disable read-only mode once Stellar recovers:

```bash
kubectl set env deployment/scavenger-backend \
  STELLAR_READ_ONLY=false \
  -n scavenger-backend
```

---

## Phase 5 — Resolve

An incident is resolved when:
- Normal error rates and latencies are restored (confirmed in Grafana for at least 15 minutes)
- Affected users can complete previously-broken workflows
- No new alerts are firing

### Resolve steps

```
1. Post in #incidents: "SEV-[N] RESOLVED: <short summary of what was done>."
2. Close the PagerDuty incident.
3. Update the status page if it was set to degraded.
4. Schedule post-mortem within 48 hours (SEV-1/2) or 7 days (SEV-3).
```

---

## Phase 6 — Post-Mortem

Every SEV-1 and SEV-2 requires a written post-mortem. SEV-3 incidents optionally produce one if the root cause reveals systemic issues.

### Post-mortem template

```markdown
## [Date] — [Short title]

**Severity:** SEV-[N]
**Duration:** [start time] → [end time] ([X] minutes)
**Impact:** [Who was affected and how]

### Timeline

| Time (UTC) | Event |
|------------|-------|
| HH:MM | Alert fired |
| HH:MM | IC declared incident |
| HH:MM | Root cause identified |
| HH:MM | Mitigation applied |
| HH:MM | Incident resolved |

### Root Cause

[Describe the technical root cause in plain language]

### Contributing Factors

- [Factor 1]
- [Factor 2]

### What Went Well

- [Thing 1]
- [Thing 2]

### Action Items

| Action | Owner | Due date |
|--------|-------|---------|
| [Task] | @person | YYYY-MM-DD |
```

Post the completed post-mortem in `docs/post-mortems/YYYY-MM-DD-title.md` and link it from the #incidents Slack thread.

---

## Communication Templates

### Initial user communication (status page)

```
We are investigating reports of [brief symptom]. Our team is engaged
and working to resolve the issue. Updates will follow every 30 minutes.
```

### Update (every 30 minutes during SEV-1/2)

```
Update [HH:MM UTC]: We have identified [root cause / are still investigating].
[Mitigation action] is in progress. Next update in 30 minutes.
```

### Resolution

```
[Service name] is fully restored as of [HH:MM UTC]. We apologise for the
disruption. A detailed post-mortem will be published within 48 hours.
```
