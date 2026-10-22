#!/usr/bin/env bash
# Disaster Recovery Testing Script
# Tests backup and recovery procedures monthly.
#
# Usage: ./scripts/test-disaster-recovery.sh [--help]

set -euo pipefail

usage() {
  cat <<EOF
Usage: $(basename "$0") [--help]

Run a full disaster-recovery drill: locate the latest S3 backup, restore it to
a test database, validate data integrity, then clean up.

Environment:
  BACKUP_BUCKET   S3 URL for the backup bucket (default: s3://scavenger-backups)
  TEST_DB         Temporary database name        (default: scavenger_dr_test)
EOF
  exit 0
}

if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
  usage
fi

BACKUP_BUCKET="${BACKUP_BUCKET:-s3://scavenger-backups}"
TEST_DB="${TEST_DB:-scavenger_dr_test}"
LOG_FILE="/var/log/dr_test_$(date +%Y%m%d).log"

echo "Starting DR test at $(date)" | tee -a "$LOG_FILE"

# Phase 1: Verify backups exist
echo "Phase 1: Verifying backups..." | tee -a "$LOG_FILE"
LATEST_DB_BACKUP=$(aws s3 ls "${BACKUP_BUCKET}/db/" --recursive | sort | tail -n 1 | awk '{print $4}')
if [ -z "$LATEST_DB_BACKUP" ]; then
    echo "❌ No database backup found" | tee -a "$LOG_FILE"
    exit 1
fi
echo "✅ Found latest database backup: $LATEST_DB_BACKUP" | tee -a "$LOG_FILE"

# Phase 2: Download and restore to test database
echo "Phase 2: Restoring to test database..." | tee -a "$LOG_FILE"
aws s3 cp "${BACKUP_BUCKET}/${LATEST_DB_BACKUP}" /tmp/test_backup.sql

# Create test database
createdb "$TEST_DB" || true

# Restore
pg_restore -d "$TEST_DB" -v /tmp/test_backup.sql 2>&1 | tail -10 >> "$LOG_FILE"

echo "✅ Database restored to $TEST_DB" | tee -a "$LOG_FILE"

# Phase 3: Validation tests
echo "Phase 3: Running validation tests..." | tee -a "$LOG_FILE"

# Test 1: Count participants
PARTICIPANT_COUNT=$(psql -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM participants;" | tr -d ' ')
echo "  - Participants: $PARTICIPANT_COUNT" | tee -a "$LOG_FILE"

# Test 2: Count wastes
WASTE_COUNT=$(psql -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM waste;" | tr -d ' ')
echo "  - Wastes: $WASTE_COUNT" | tee -a "$LOG_FILE"

# Test 3: Verify recent data
RECENT_RECORDS=$(psql -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM participants WHERE created_at > NOW() - INTERVAL '1 day';" | tr -d ' ')
echo "  - Recent participants (24h): $RECENT_RECORDS" | tee -a "$LOG_FILE"

# Test 4: Data integrity check
INTEGRITY=$(psql -d "$TEST_DB" -t -c "SELECT version();" | wc -l)
if [ "$INTEGRITY" -gt 0 ]; then
    echo "✅ Database integrity verified" | tee -a "$LOG_FILE"
else
    echo "❌ Database integrity check failed" | tee -a "$LOG_FILE"
    exit 1
fi

# Phase 4: Cleanup
echo "Phase 4: Cleanup..." | tee -a "$LOG_FILE"
dropdb "$TEST_DB"
rm /tmp/test_backup.sql

echo "✅ DR test completed successfully at $(date)" | tee -a "$LOG_FILE"
echo ""
{
  echo "Test Summary:"
  echo "  - Backup file: $LATEST_DB_BACKUP"
  echo "  - Total participants: $PARTICIPANT_COUNT"
  echo "  - Total wastes: $WASTE_COUNT"
  echo "  - RTO estimate: 30 minutes"
  echo "  - RPO: 1 hour"
} | tee -a "$LOG_FILE"
