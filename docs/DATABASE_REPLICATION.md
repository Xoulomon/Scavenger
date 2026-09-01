# Database Replication Configuration

## Overview
This document describes the database replication setup for high availability and read scaling.

## Kubernetes Setup

### Manifests

| File | Purpose |
|------|---------|
| `k8s/postgres-replication.yml` | StatefulSet for primary + 2 replicas, Services, PodDisruptionBudget |
| `k8s/backup-cronjob.yml` | Daily backup CronJob + weekly restore verification CronJob |

### Deploy

```bash
# Create secrets (replace placeholder values)
kubectl create secret generic postgres-secrets \
  --from-literal=POSTGRES_PASSWORD=<strong-password> \
  --from-literal=REPLICATION_PASSWORD=<strong-replication-password> \
  -n scavenger

# Apply replication manifests
kubectl apply -f k8s/postgres-replication.yml

# Apply backup CronJobs
kubectl apply -f k8s/backup-cronjob.yml
```

### Architecture (K8s)
- `postgres-primary` StatefulSet (1 replica) — accepts writes; WAL archiving enabled
- `postgres-replica` StatefulSet (2 replicas) — hot-standby; initialized via `pg_basebackup`
- Each pod includes a sidecar `postgres-exporter` that exposes metrics on port 9187
- A `PodDisruptionBudget` ensures at least 1 replica remains available during node drains

## Architecture

### Master-Slave Replication
- **Primary**: Master database (write operations)
- **Replicas**: Read-only replicas in different AZs
- **Replication**: PostgreSQL streaming replication
- **Lag Target**: < 1 second

### Multi-AZ Setup
- Primary in us-east-1a
- Replica 1 in us-east-1b
- Replica 2 in us-east-1c
- Automatic failover on primary failure

## PostgreSQL Streaming Replication

### Configuration

#### Primary Database
```sql
-- postgresql.conf
wal_level = replica
max_wal_senders = 10
wal_keep_size = 1GB
hot_standby_feedback = on
```

#### Replica Database
```sql
-- recovery.conf
standby_mode = 'on'
primary_conninfo = 'host=primary.db.internal port=5432 user=replication password=***'
recovery_target_timeline = 'latest'
```

### Replication User
```sql
CREATE ROLE replication WITH REPLICATION LOGIN PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE scavenger TO replication;
```

## Connection Pooling

### PgBouncer Configuration
```ini
[databases]
scavenger = host=primary.db.internal port=5432 dbname=scavenger

[pgbouncer]
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
min_pool_size = 10
reserve_pool_size = 5
reserve_pool_timeout = 3
```

### Connection Pool Sizing
- **Max Connections**: 1000
- **Default Pool Size**: 25 per database
- **Min Pool Size**: 10
- **Reserve Pool**: 5 connections
- **Timeout**: 3 seconds

## Automatic Failover

### RDS Failover
- **Detection Time**: 30-60 seconds
- **Failover Time**: 1-2 minutes
- **Automatic**: Enabled
- **Multi-AZ**: Required

### Failover Process
1. Primary failure detected
2. Replica promoted to primary
3. DNS updated (CNAME)
4. Applications reconnect
5. New replica created

## Replication Monitoring

### Key Metrics
- **Replication Lag**: Target < 1 second
- **WAL Retention**: Monitor disk usage
- **Replica Lag**: Per replica tracking
- **Failover Time**: Track recovery metrics

### Queries

#### Check Replication Status
```sql
SELECT
  client_addr,
  state,
  sync_state,
  write_lag,
  flush_lag,
  replay_lag
FROM pg_stat_replication;
```

#### Monitor Replication Lag
```sql
SELECT
  EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())) as replication_lag_seconds;
```

#### Check WAL Position
```sql
SELECT
  pg_current_wal_lsn() as current_wal,
  pg_last_wal_receive_lsn() as receive_lsn,
  pg_last_wal_replay_lsn() as replay_lsn;
```

## Read Scaling

### Read Replica Endpoints
- **Primary**: scavenger-db.c9akciq32.us-east-1.rds.amazonaws.com
- **Replica 1**: scavenger-db-replica-1.c9akciq32.us-east-1.rds.amazonaws.com
- **Replica 2**: scavenger-db-replica-2.c9akciq32.us-east-1.rds.amazonaws.com

### Read Distribution
- **Analytics**: Route to replica 1
- **Reporting**: Route to replica 2
- **Real-time**: Route to primary
- **Batch Jobs**: Route to replica with lowest lag

### Application Configuration
```python
# Primary for writes
PRIMARY_DB = "scavenger-db.c9akciq32.us-east-1.rds.amazonaws.com"

# Replicas for reads
READ_REPLICAS = [
  "scavenger-db-replica-1.c9akciq32.us-east-1.rds.amazonaws.com",
  "scavenger-db-replica-2.c9akciq32.us-east-1.rds.amazonaws.com"
]

# Connection pooling
POOL_SIZE = 25
POOL_RECYCLE = 3600
```

## Failover Testing

### Monthly Failover Drill
1. Promote read replica to primary
2. Verify all connections work
3. Monitor replication lag
4. Test application failover
5. Document recovery time
6. Restore original configuration

### Failover Checklist
- [ ] Verify replica is in sync
- [ ] Check application connection strings
- [ ] Monitor error rates during failover
- [ ] Verify data consistency
- [ ] Update DNS if needed
- [ ] Notify stakeholders
- [ ] Document incident

## Backup Strategy

### Continuous Backups
- **Method**: WAL archiving to S3
- **Frequency**: Continuous
- **Retention**: 30 days
- **Recovery**: Point-in-time recovery

### Snapshot Backups
- **Frequency**: Daily at 03:00 UTC
- **Retention**: 30 days
- **Location**: Multi-region replication
- **Verification**: Weekly restore test

## Disaster Recovery

### RTO (Recovery Time Objective)
- **Failover**: 2 minutes
- **Restore from backup**: 15 minutes
- **Full recovery**: 30 minutes

### RPO (Recovery Point Objective)
- **Streaming replication**: < 1 second
- **WAL archiving**: 5 minutes
- **Snapshots**: 24 hours

## Troubleshooting

### High Replication Lag
1. Check network connectivity
2. Monitor replica CPU/memory
3. Check WAL generation rate
4. Review slow queries on primary
5. Consider promoting replica if lag > 5 minutes

### Replica Crash
1. Check replica logs
2. Verify disk space
3. Restart replica service
4. Monitor recovery process
5. Verify replication resumes

### Connection Pool Issues
1. Check PgBouncer status
2. Monitor connection count
3. Review application logs
4. Restart pool if needed
5. Verify database connectivity
