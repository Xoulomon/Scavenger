#!/bin/bash
# Database replication monitoring script

set -euo pipefail

PRIMARY_HOST="${PRIMARY_HOST:-localhost}"
PRIMARY_USER="${PRIMARY_USER:-postgres}"
PRIMARY_DB="${PRIMARY_DB:-scavenger}"

echo "=== Database Replication Status ==="
echo ""

# Check replication status
echo "Replication Status:"
psql -h "$PRIMARY_HOST" -U "$PRIMARY_USER" -d "$PRIMARY_DB" -c "
SELECT
  client_addr,
  state,
  sync_state,
  EXTRACT(EPOCH FROM write_lag) as write_lag_seconds,
  EXTRACT(EPOCH FROM flush_lag) as flush_lag_seconds,
  EXTRACT(EPOCH FROM replay_lag) as replay_lag_seconds
FROM pg_stat_replication
ORDER BY client_addr;
" || echo "✗ Failed to query replication status"

echo ""
echo "Replication Lag:"
psql -h "$PRIMARY_HOST" -U "$PRIMARY_USER" -d "$PRIMARY_DB" -c "
SELECT
  EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())) as replication_lag_seconds;
" || echo "✗ Failed to query replication lag"

echo ""
echo "WAL Position:"
psql -h "$PRIMARY_HOST" -U "$PRIMARY_USER" -d "$PRIMARY_DB" -c "
SELECT
  pg_current_wal_lsn() as current_wal,
  pg_last_wal_receive_lsn() as receive_lsn,
  pg_last_wal_replay_lsn() as replay_lsn;
" || echo "✗ Failed to query WAL position"

echo ""
echo "Database Size:"
psql -h "$PRIMARY_HOST" -U "$PRIMARY_USER" -d "$PRIMARY_DB" -c "
SELECT
  datname,
  pg_size_pretty(pg_database_size(datname)) as size
FROM pg_database
WHERE datname = '$PRIMARY_DB';
" || echo "✗ Failed to query database size"

echo ""
echo "✓ Replication monitoring completed"
