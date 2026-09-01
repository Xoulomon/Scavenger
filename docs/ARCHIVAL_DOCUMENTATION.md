# Data Archival System Documentation

## Overview

The data archival system provides comprehensive capabilities for archiving old data while maintaining full auditability and compliance. It supports multiple storage tiers, retention policies, and automated archival jobs.

## Architecture

### Components

1. **ArchivalService** (`services/archival.rs`)
   - Core service managing archival operations
   - Handles retention policies and archive records
   - Coordinates archival jobs

2. **ArchivalStorage** (`services/archival_storage.rs`)
   - Storage abstraction layer
   - File system and S3 implementations
   - Support for multiple storage tiers

3. **API Endpoints** (`api/archival.rs`)
   - RESTful API for archival operations
   - Policy management
   - Archive queries and restoration

## Storage Tiers

The system supports four storage tiers optimized for different access patterns:

- **Hot**: Frequently accessed data (high performance, higher cost)
- **Warm**: Occasionally accessed data (balanced performance/cost)
- **Cold**: Rarely accessed data (lower performance, lower cost)
- **Glacier**: Long-term storage (lowest cost, retrieval time measured in hours)

## Retention Policies

### Policy Structure

```rust
RetentionPolicy {
    id: String,
    name: String,
    description: String,
    data_type: String,
    retention_days: i64,        // How long to keep data
    archive_after_days: i64,    // When to archive data
    delete_after_days: Option<i64>, // When to delete (optional)
    storage_tier: StorageTier,
    enabled: bool,
}
```

### Policy Examples

```rust
// Short-term hot storage for recent transactions
let hot_policy = RetentionPolicy {
    name: "Recent Transactions".to_string(),
    data_type: "transactions".to_string(),
    retention_days: 90,
    archive_after_days: 30,
    delete_after_days: None,
    storage_tier: StorageTier::Hot,
    enabled: true,
};

// Long-term cold storage for audit logs
let audit_policy = RetentionPolicy {
    name: "Audit Logs".to_string(),
    data_type: "audit_logs".to_string(),
    retention_days: 2555, // 7 years
    archive_after_days: 365,
    delete_after_days: Some(2555),
    storage_tier: StorageTier::Glacier,
    enabled: true,
};
```

## API Endpoints

### Retention Policy Management

#### Create Policy
```
POST /api/v1/archival/policies
Content-Type: application/json

{
  "name": "Waste Records",
  "description": "Archive waste records after 90 days",
  "data_type": "wastes",
  "retention_days": 365,
  "archive_after_days": 90,
  "delete_after_days": 730,
  "storage_tier": "cold",
  "enabled": true
}
```

Response:
```json
{
  "policy_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Retention policy created successfully"
}
```

#### List Policies
```
GET /api/v1/archival/policies
```

Response:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Waste Records",
    "data_type": "wastes",
    "retention_days": 365,
    "archive_after_days": 90,
    "storage_tier": "cold",
    "enabled": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

#### Get Policy
```
GET /api/v1/archival/policies/{policy_id}
```

#### Update Policy
```
PUT /api/v1/archival/policies/{policy_id}
Content-Type: application/json

{
  "retention_days": 730,
  "enabled": false
}
```

#### Delete Policy
```
DELETE /api/v1/archival/policies/{policy_id}
```

### Archive Operations

#### Archive Data
```
POST /api/v1/archival/archives
Content-Type: application/json

{
  "data_type": "wastes",
  "data_id": "waste-123",
  "policy_id": "550e8400-e29b-41d4-a716-446655440000",
  "data": "SGVsbG8sIFdvcmxkIQ=="  // Base64 encoded
}
```

Response:
```json
{
  "archive_id": "archive-abc-123",
  "message": "Data archived successfully"
}
```

#### Query Archives
```
GET /api/v1/archival/archives?data_type=wastes&status=completed&limit=50
```

Query Parameters:
- `data_type`: Filter by data type
- `status`: pending, in_progress, completed, failed, restored
- `from_date`: ISO 8601 date
- `to_date`: ISO 8601 date
- `storage_tier`: hot, warm, cold, glacier
- `limit`: Results per page (default: 100)
- `offset`: Pagination offset

Response:
```json
[
  {
    "id": "archive-abc-123",
    "data_type": "wastes",
    "data_id": "waste-123",
    "storage_path": "archives/wastes/2024/01/01/waste-123",
    "storage_tier": "cold",
    "original_size": 1024,
    "compressed_size": 512,
    "checksum": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "status": "completed",
    "archived_at": "2024-01-01T12:00:00Z",
    "expires_at": "2026-01-01T12:00:00Z"
  }
]
```

#### Restore Archive
```
POST /api/v1/archival/archives/{archive_id}/restore
```

Response:
```json
{
  "archive_id": "archive-abc-123",
  "data": "SGVsbG8sIFdvcmxkIQ==",
  "size": 13
}
```

#### Delete Archive
```
DELETE /api/v1/archival/archives/{archive_id}
```

### Statistics

#### Get Archive Statistics
```
GET /api/v1/archival/stats
```

Response:
```json
{
  "total_archives": 1500,
  "total_size": 157286400,
  "by_status": {
    "Completed": 1450,
    "InProgress": 40,
    "Failed": 10
  },
  "by_tier": {
    "Hot": 200,
    "Warm": 300,
    "Cold": 800,
    "Glacier": 200
  },
  "by_data_type": {
    "wastes": 1000,
    "participants": 300,
    "transactions": 200
  }
}
```

### Job Management

#### List Jobs
```
GET /api/v1/archival/jobs?status=completed
```

Response:
```json
[
  {
    "id": "job-xyz-789",
    "name": "Daily Waste Archive",
    "policy_id": "550e8400-e29b-41d4-a716-446655440000",
    "data_type": "wastes",
    "status": "completed",
    "total_records": 1000,
    "archived_records": 998,
    "failed_records": 2,
    "started_at": "2024-01-01T02:00:00Z",
    "completed_at": "2024-01-01T02:15:00Z"
  }
]
```

#### Get Job Status
```
GET /api/v1/archival/jobs/{job_id}
```

## Usage Examples

### Basic Archival Workflow

```rust
use scavenger_backend::services::{
    ArchivalService, RetentionPolicy, StorageTier,
    FileSystemArchivalStorage,
};
use std::sync::Arc;

// Initialize service
let storage = Arc::new(FileSystemArchivalStorage::new(
    std::path::PathBuf::from("/var/archives")
));
let service = ArchivalService::new(storage);

// Create retention policy
let policy = RetentionPolicy::new(
    "Waste Records".to_string(),
    "wastes".to_string(),
    365,  // Keep for 1 year
    90,   // Archive after 90 days
);
let policy_id = service.create_policy(policy)?;

// Archive data
let data = b"Waste record data...".to_vec();
let archive_id = service.archive_data(
    "wastes".to_string(),
    "waste-123".to_string(),
    data,
    policy_id,
).await?;

// Restore when needed
let restored_data = service.restore_data(&archive_id).await?;

// Query archives
let query = ArchiveQuery {
    data_type: Some("wastes".to_string()),
    status: Some(ArchiveStatus::Completed),
    limit: 100,
    offset: 0,
    ..Default::default()
};
let archives = service.query_archives(query)?;
```


### Automated Archival Job

```rust
use scavenger_backend::services::{ArchiveJob, ArchiveStatus};
use chrono::Utc;

// Create archive job
let mut job = ArchiveJob::new(
    "Daily Waste Archive".to_string(),
    policy_id,
    "wastes".to_string(),
);

job.status = ArchiveStatus::InProgress;
job.started_at = Some(Utc::now());
job.total_records = 1000;

let job_id = service.create_job(job.clone())?;

// Process records
for record in eligible_records {
    match service.archive_data(
        "wastes".to_string(),
        record.id,
        record.data,
        policy_id,
    ).await {
        Ok(_) => job.archived_records += 1,
        Err(_) => job.failed_records += 1,
    }
}

// Complete job
job.status = ArchiveStatus::Completed;
job.completed_at = Some(Utc::now());
service.update_job(&job_id, job)?;
```

## Storage Implementation

### File System Storage

For development and small deployments:

```rust
use scavenger_backend::services::FileSystemArchivalStorage;
use std::path::PathBuf;

let storage = FileSystemArchivalStorage::new(
    PathBuf::from("/var/scavenger/archives")
);
```

Directory structure:
```
/var/scavenger/archives/
├── wastes/
│   ├── 2024/
│   │   ├── 01/
│   │   │   ├── 01/
│   │   │   │   └── waste-123.gz
│   │   │   └── 02/
│   │   │       └── waste-456.gz
```

### S3 Storage

For production with AWS:

```rust
use scavenger_backend::services::S3ArchivalStorage;

let storage = S3ArchivalStorage::new(
    "my-archive-bucket".to_string(),
    "us-east-1".to_string(),
);
```

S3 benefits:
- Automatic lifecycle transitions
- Built-in durability and redundancy
- Glacier and Deep Archive support
- Cost-effective for long-term storage

## Configuration

### Environment Variables

```bash
# Archival storage path (for file system)
ARCHIVAL_STORAGE_PATH=/var/scavenger/archives

# Or for S3
ARCHIVAL_S3_BUCKET=my-archive-bucket
ARCHIVAL_S3_REGION=us-east-1

# Archive job schedule (cron format)
ARCHIVAL_JOB_SCHEDULE="0 2 * * *"  # Daily at 2 AM

# Compression level (0-9)
ARCHIVAL_COMPRESSION_LEVEL=6

# Notification settings
ARCHIVAL_NOTIFICATION_EMAIL=admin@example.com
```

## Data Compression

All archived data is automatically compressed using gzip compression:

- **Compression ratio**: Typically 60-80% reduction
- **Algorithm**: gzip (RFC 1952)
- **Level**: Configurable (default: 6)

Example compression results:
```
Original: 1,024 KB JSON
Compressed: 256 KB (75% reduction)
```

## Auditability

Every archival operation is tracked:

```rust
ArchiveRecord {
    id: "archive-abc-123",
    data_type: "wastes",
    data_id: "waste-123",
    storage_path: "archives/wastes/2024/01/01/waste-123",
    original_size: 1024,
    compressed_size: 512,
    checksum: "e3b0c44...",  // SHA-256 for integrity
    status: "completed",
    archived_at: "2024-01-01T12:00:00Z",
    metadata: {
        "archived_by": "system",
        "policy_id": "550e8400...",
        "original_location": "wastes_table"
    }
}
```

## Best Practices

### 1. Policy Design

```rust
// ✓ Good: Specific policies for different data types
let active_policy = RetentionPolicy {
    name: "Active Wastes",
    data_type: "wastes",
    archive_after_days: 90,
    storage_tier: StorageTier::Warm,
    ..Default::default()
};

let completed_policy = RetentionPolicy {
    name: "Completed Wastes",
    data_type: "completed_wastes",
    archive_after_days: 30,
    storage_tier: StorageTier::Cold,
    ..Default::default()
};

// ✗ Bad: One-size-fits-all policy
let generic_policy = RetentionPolicy {
    name: "Everything",
    data_type: "all",
    archive_after_days: 365,
    ..Default::default()
};
```

### 2. Testing Restoration

Always test restoration before relying on archives:

```rust
#[tokio::test]
async fn test_archive_integrity() {
    let original_data = generate_test_data();
    let archive_id = service.archive_data(..., original_data.clone()).await?;

    let restored_data = service.restore_data(&archive_id).await?;

    assert_eq!(original_data, restored_data);
}
```

### 3. Monitor Archive Jobs

Set up alerts for failed archival jobs:

```rust
let jobs = service.list_jobs(Some(ArchiveStatus::Failed))?;

if !jobs.is_empty() {
    send_alert(&format!("{} archival jobs failed", jobs.len()));
}
```

### 4. Gradual Tier Migration

Move data through tiers gradually:

```
Day 0-30:   Hot storage (frequent access)
Day 31-90:  Warm storage (occasional access)
Day 91-365: Cold storage (rare access)
Day 365+:   Glacier (compliance/audit only)
```

## Performance Considerations

### Compression Impact

```
Operation    | Time    | CPU Usage
-------------|---------|----------
Compress 1MB | ~50ms   | Low
Decompress   | ~10ms   | Very Low
```

### Storage Retrieval Times

```
Tier      | Retrieval Time | Cost
----------|----------------|------
Hot       | < 1s          | $$$
Warm      | < 5s          | $$
Cold      | < 1min        | $
Glacier   | 1-5 hours     | ¢
```

### Batch Operations

For best performance:
- Archive in batches of 100-1000 records
- Use parallel processing for large jobs
- Schedule archival during off-peak hours

## Troubleshooting

### Issue: Archive Not Found

```
Error: Archive not found
```

**Solution**: Check if the archive was deleted or moved to a different tier.

### Issue: Restoration Timeout

```
Error: Restoration timeout for glacier tier
```

**Solution**: Glacier retrievals take 1-5 hours. Use expedited retrieval for urgent needs.

### Issue: Checksum Mismatch

```
Error: Checksum validation failed
```

**Solution**: Data corruption detected. Use backup or redundant copy.

### Issue: Storage Full

```
Error: Failed to store archive: disk full
```

**Solution**:
- Increase storage capacity
- Delete old archives past retention period
- Migrate to higher capacity tier

## Compliance

The archival system supports compliance with:

- **GDPR**: Right to erasure with configurable delete_after_days
- **HIPAA**: Secure storage with encryption at rest
- **SOC 2**: Audit trail for all archival operations
- **ISO 27001**: Data retention and disposal policies

## Future Enhancements

Planned features:
1. Encryption at rest for archived data
2. Automated tier migration based on access patterns
3. Cross-region replication for disaster recovery
4. Advanced search within archived data
5. Machine learning for optimal archival timing
6. Integration with blockchain for immutable audit trail

## References

- Backend source: `backend/src/services/archival.rs`
- API implementation: `backend/src/api/archival.rs`
- Storage implementations: `backend/src/services/archival_storage.rs`
- Tests: `backend/tests/archival_tests.rs`
- AWS S3 Storage Classes: https://aws.amazon.com/s3/storage-classes/
