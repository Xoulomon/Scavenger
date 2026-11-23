# Audit Logging Guide

## Overview

Sensitive on-chain operations emit `AUDIT/log` contract events containing a structured `AuditLog` payload. These are captured by the indexer and stored in the `audit_logs` PostgreSQL table.

## Audited Operations

| Function                     | Actor         | Target      |
| ---------------------------- | ------------- | ----------- |
| `initialize_admin`           | admin         | admin       |
| `transfer_admin`             | current_admin | admin       |
| `register_participant`       | address       | participant |
| `deregister_participant`     | address       | participant |
| `update_role`                | address       | participant |
| `deactivate_waste`           | admin         | waste       |
| `generate_compliance_report` | admin         | COMPLIANCE  |
| `finalize_compliance_report` | admin         | COMPLIANCE  |
| `substitute_waste`           | approver      | WASTE       |

## Querying Audit Logs

```sql
-- Recent sensitive operations
SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100;

-- Operations by actor
SELECT * FROM audit_logs WHERE actor_address = $1 ORDER BY timestamp DESC;

-- Specific action
SELECT * FROM audit_logs WHERE action = 'deactivate_waste' ORDER BY timestamp DESC;

-- Time range
SELECT * FROM audit_logs
WHERE timestamp BETWEEN NOW() - INTERVAL '24 hours' AND NOW()
ORDER BY timestamp DESC;
```

## Off-Chain Event Queries

Audit events are also queryable via the Stellar RPC:

```bash
curl -X POST $RPC_URL -d '{
  "jsonrpc": "2.0", "id": 1,
  "method": "getEvents",
  "params": {
    "filters": [{"type": "contract", "contractIds": ["$CONTRACT_ID"],
                 "topics": [["*", "AUDIT"]]}]
  }
}'
```

## Gas Design

Audit entries are emitted as **contract events** (not written to persistent storage). This avoids an expensive read-modify-write of a growing Vec on every audited call, significantly reducing gas cost per operation. An on-chain counter tracks the sequential ID only.

## Retention

The indexer stores audit logs indefinitely in PostgreSQL. Apply a retention policy via a scheduled job:

```sql
DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '1 year';
```
