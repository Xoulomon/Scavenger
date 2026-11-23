# Backup Strategy

## Overview

Scavenger uses automated daily backups with verification to protect against data loss. Backups are encrypted, stored in S3, and tested weekly via full restore.

## Backup Schedule

| Backup type             | Schedule                  | Retention |
| ----------------------- | ------------------------- | --------- |
| Full database dump      | Daily at 02:00 UTC        | 30 days   |
| RDS automated snapshots | Daily (AWS managed)       | 7 days    |
| Restore verification    | Daily (after backup)      | —         |
| Full restore test       | Weekly (Sunday 02:00 UTC) | —         |

## Backup Storage

- **Bucket**: `scavenger-backups-<env>-<account_id>` (S3)
- **Encryption**: AES-256 server-side encryption
- **Versioning**: Enabled
- **Public access**: Blocked

## Backup Process

1. `scripts/backup-database.sh` runs pg_dump, gzip-compresses the output, verifies integrity, then uploads to S3.
2. The GitHub Actions workflow `.github/workflows/backup.yml` runs it on schedule and publishes a `BackupSuccess` metric to CloudWatch.
3. `scripts/verify-backup-restore.sh` downloads the latest backup to a temporary database and counts rows to confirm data integrity.

## Recovery Procedures

### Standard restore (from latest backup)

```bash
# Download latest backup
LATEST=$(aws s3 ls s3://scavenger-backups-prod/database/ --recursive | sort | tail -n1 | awk '{print $4}')
aws s3 cp "s3://scavenger-backups-prod/$LATEST" /tmp/restore.sql.gz

# Restore to target database
gunzip -c /tmp/restore.sql.gz | psql -h "$DB_HOST" -U postgres -d scavenger
```

### Point-in-time recovery (RDS)

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier prod-scavenger-db \
  --target-db-instance-identifier prod-scavenger-db-restored \
  --restore-time "2026-01-15T03:00:00Z"
```

### Restore to specific backup

```bash
# List available backups
aws s3 ls s3://scavenger-backups-prod/database/ --recursive

# Pick a timestamp and restore
aws s3 cp "s3://scavenger-backups-prod/database/20260115_020000/db_backup_20260115_020000.sql.gz" /tmp/restore.sql.gz
gunzip -c /tmp/restore.sql.gz | psql -h "$DB_HOST" -U postgres -d scavenger
```

## Backup Monitoring

CloudWatch alarms trigger if:

- No successful backup in 24 hours (`scavenger-backup-failure-<env>`)
- Backup verification failed (`scavenger-backup-verify-failure-<env>`)

The `scavenger-backups-<env>` CloudWatch dashboard shows backup success rate and alarm status.

## Terraform

The `terraform/modules/backup` module provisions the S3 bucket, lifecycle rules, and CloudWatch alarms.

```hcl
module "backup" {
  source         = "./modules/backup"
  environment    = var.environment
  account_id     = data.aws_caller_identity.current.account_id
  retention_days = 30
  alarm_sns_arns = [var.alerts_sns_arn]
}
```
