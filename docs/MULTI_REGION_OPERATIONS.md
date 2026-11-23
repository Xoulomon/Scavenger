# Multi-Region Operations

## Daily Operations

### Health Monitoring

Health checks run every 5 minutes via a CronJob in the scavenger namespace:

```bash
# Check region health status
scripts/region-health-check.sh
```

### Traffic Monitoring

Monitor traffic distribution across regions using CloudWatch metrics:

- Primary region request count
- Secondary region request count
- Failover event count
- Cross-region latency

## Runbooks

### Runbook: Primary Region Degradation

**Symptoms:**

- Increased error rates in primary region
- Elevated latency
- Health check failures

**Steps:**

1. Verify primary region health
2. Check CloudWatch alarms
3. If 3 consecutive health checks fail, failover is automatic
4. Monitor secondary region for traffic increase
5. Investigate root cause in primary
6. Once resolved, failback to primary

### Runbook: Complete Region Failure

**Symptoms:**

- Primary region completely unreachable
- All health checks failing
- Automatic failover triggered

**Steps:**

1. Confirm automatic failover occurred
2. Verify secondary region is serving traffic
3. Check secondary region database is promoted
4. Monitor error rates in secondary
5. Contact AWS support for primary region
6. Plan failback after primary region restoration

### Runbook: Cross-Region Replication Lag

**Symptoms:**

- Replication lag > 5 seconds
- Data inconsistency warnings

**Steps:**

1. Check replication status
2. Verify network connectivity between regions
3. Check WAL generation rate on primary
4. Scale up replica instance if needed
5. Monitor lag reduction

## Capacity Planning

Each region should be provisioned with sufficient capacity to handle full traffic load during failover:

- ECS: Set max_capacity to handle 2x normal traffic
- RDS: Provision for read replica promotion
- ALB: Configure for full traffic load
