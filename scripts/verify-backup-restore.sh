#!/usr/bin/env bash
# Weekly backup restoration verification.
#
# Usage: ./scripts/verify-backup-restore.sh [--help]

set -euo pipefail

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  cat <<EOF
Usage: $(basename "$0") [--help]

Download the latest database backup from S3, restore it into a test database,
run a smoke query, then drop the test database.  Exits 1 on any failure.

Environment:
  BACKUP_BUCKET   S3 bucket holding backups  (default: s3://scavenger-backups)
  TEST_DB         Name of temporary test DB  (default: scavenger_restore_test)
  DB_HOST         PostgreSQL host             (default: localhost)
EOF
  exit 0
fi

BACKUP_BUCKET="s3://scavenger-backups"
TEST_DB="scavenger_restore_test"
DB_HOST="${DB_HOST:-localhost}"

echo "Starting backup restoration verification..."

# Get latest backup
LATEST_BACKUP=$(aws s3 ls "$BACKUP_BUCKET/database/" --recursive | sort | tail -n 1 | awk '{print $4}')

if [ -z "$LATEST_BACKUP" ]; then
    echo "✗ No backups found"
    exit 1
fi

echo "Testing restore from: $LATEST_BACKUP"

# Download backup
aws s3 cp "$BACKUP_BUCKET/$LATEST_BACKUP" /tmp/restore_test.sql.gz

# Create test database
psql -h "$DB_HOST" -U postgres -c "DROP DATABASE IF EXISTS $TEST_DB;" || true
psql -h "$DB_HOST" -U postgres -c "CREATE DATABASE $TEST_DB;"

# Restore backup
gunzip -c /tmp/restore_test.sql.gz | psql -h "$DB_HOST" -U postgres -d "$TEST_DB"

# Verify data integrity
RECORD_COUNT=$(psql -h "$DB_HOST" -U postgres -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM participants;")

if [ "$RECORD_COUNT" -gt 0 ]; then
    echo "✓ Restore verification passed (found $RECORD_COUNT records)"
    psql -h "$DB_HOST" -U postgres -c "DROP DATABASE $TEST_DB;"
    rm /tmp/restore_test.sql.gz
    exit 0
else
    echo "✗ Restore verification failed (no records found)"
    exit 1
fi
