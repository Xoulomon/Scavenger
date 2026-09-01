# Disaster Recovery Runbook

## Overview
This runbook defines backup, recovery, and failover procedures for the Scavenger platform.

### RTO/RPO SLAs
- **RTO (Recovery Time Objective)**: 4 hours
- **RPO (Recovery Point Objective)**: 1 hour
- **Critical Services**: Backend API, Blockchain Indexer, Database

## 1. Backup Strategy

### 1.1 Database Backups
- **Frequency**: Hourly automated backups
- **Retention**: 30 days daily, 90 days weekly, 1 year monthly
- **Storage**: S3 with cross-region replication
- **Location**: `s3://scavenger-backups/db/`

```bash
# Automated backup script (runs hourly)
BACKUP_FILE="postgres_$(date +%Y%m%d_%H%M%S).sql"
pg_dump -h $DB_HOST -U $DB_USER -F c $DB_NAME | \
  aws s3 cp - s3://scavenger-backups/db/$BACKUP_FILE
```

### 1.2 Contract State Backups
- **Frequency**: Every 6 hours
- **Method**: Export via Soroban RPC
- **Format**: JSON snapshots

```bash
# Contract state backup
soroban contract invoke \
  --contract-id $CONTRACT_ID \
  --op export_state > contract_state_$(date +%s).json
```

### 1.3 Configuration Backups
- **Frequency**: On-change + daily automatic
- **Items**: Environment configs, secrets (encrypted)
- **Storage**: S3 encrypted bucket

## 2. Testing DR Procedures

### 2.1 Monthly Backup Validation
```bash
# Verify backup integrity
aws s3 ls s3://scavenger-backups/db/ --recursive
pg_restore -d test_db -v latest_backup.sql
```

### 2.2 Quarterly Full Disaster Recovery Test
- Restore DB to isolated environment
- Verify contract deployment from state backup
- Run smoke tests on restored system
- Document any gaps or issues

## 3. Recovery Procedures

### 3.1 Database Recovery (Full)

**Estimated Recovery Time**: 30 minutes

```bash
#!/bin/bash
# Stop services
docker-compose down

# Download backup
BACKUP_FILE="postgres_20240101_120000.sql"
aws s3 cp s3://scavenger-backups/db/$BACKUP_FILE .

# Create new database
createdb scavenger_recovery

# Restore data
pg_restore -d scavenger_recovery -v $BACKUP_FILE

# Validate
psql -d scavenger_recovery -c "SELECT COUNT(*) FROM participants;"

# Swap databases
alter database scavenger rename to scavenger_old;
alter database scavenger_recovery rename to scavenger;

# Restart services
docker-compose up -d
```

### 3.2 Contract State Recovery

**Estimated Recovery Time**: 15 minutes

```bash
#!/bin/bash
# Download state backup
aws s3 cp s3://scavenger-backups/contract/state_latest.json .

# Re-initialize contract from state
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/contract.wasm \
  --restore-state state_latest.json
```

### 3.3 Partial Data Recovery (Specific Participant)

```bash
# Query backup for specific participant
pg_restore -l latest_backup.sql | grep "TABLE DATA participant"
pg_restore -d scavenger -a -e \
  -t participant_data latest_backup.sql \
  --where "participant_id = 'xyz'"
```

## 4. Failover Procedures

### 4.1 Database Failover (Primary → Secondary)

**Automatic Failover Time**: 2 minutes (with automated monitoring)

```bash
# Check secondary replication status
psql -h secondary_host -c "SELECT * FROM pg_stat_replication;"

# Promote secondary to primary
pg_ctl promote -D /var/lib/postgresql/data

# Update application connection strings
# Restart services with new primary
```

### 4.2 Backend Service Failover

**Manual Failover Steps**:
1. Detect primary backend failure via health check
2. Route traffic to standby backend via load balancer
3. Restart failed primary
4. Run integrity checks

```bash
# Health check
curl -f http://backend-primary:8080/health || {
  echo "Primary down, switching to standby"
  aws elb set-instance-health --instance-id i-primary --state OutOfService
}
```

### 4.3 Indexer Failover

Indexer can be restarted from checkpoint:
```bash
# Get last indexed block
SELECT max(block_height) FROM indexer_checkpoints;

# Restart from checkpoint
node dist/index.js --start-block <checkpoint>
```

## 5. Incident Response Checklist

### Phase 1: Detection (0-5 minutes)
- [ ] Identify affected service
- [ ] Check monitoring alerts
- [ ] Assess impact scope
- [ ] Notify incident response team

### Phase 2: Immediate Actions (5-15 minutes)
- [ ] Stop degrading service if necessary
- [ ] Isolate problem components
- [ ] Failover if RTO is at risk
- [ ] Update status page

### Phase 3: Recovery (15 minutes - RTO)
- [ ] Follow appropriate recovery procedure
- [ ] Run verification tests
- [ ] Restore normal traffic routing
- [ ] Monitor for anomalies

### Phase 4: Post-Incident (RTO + ongoing)
- [ ] Root cause analysis
- [ ] Update runbook
- [ ] Improve automated detection
- [ ] Document lessons learned

## 6. Monitoring & Alerts

### Critical Metrics
- Database connection pool utilization > 80%
- Backup job failure rate > 0%
- Replication lag > 5 minutes
- Contract state divergence
- API error rate > 1%

### Alert Thresholds
```yaml
alerts:
  database_down:
    threshold: immediate
    action: page on-call
  backup_failure:
    threshold: 1 consecutive failure
    action: email ops team
  replication_lag:
    threshold: 5 minutes
    action: escalate to DBA
```

## 7. Recovery Validation

After recovery, verify:
1. Database integrity: `PRAGMA integrity_check;`
2. Participant count: Compare with backup metadata
3. Contract state: Verify total_waste, total_tokens
4. Recent transactions: Confirm last 100 transactions present
5. API endpoints: Test 10 key endpoints
6. Event replay: Ensure event log completeness

## 8. Communication

### During Incident
- Update status page every 15 minutes
- Email affected customers
- Post in incident channel

### Post-Incident
- Send root cause analysis within 24 hours
- Schedule postmortem within 1 week
- Publish lessons learned

## 9. Backup Location & Access

**Primary Backup Location**: `s3://scavenger-backups/`

**Access Requirements**:
- AWS IAM role: `scavenger-backup-recovery`
- Encryption keys stored in AWS Secrets Manager
- 2FA required for restore operations

**Recovery Contact**:
- On-call DBA: See PagerDuty
- Ops team: ops@scavenger.io
