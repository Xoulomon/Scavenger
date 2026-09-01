use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, Duration};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use anyhow::{Result, Context};
use uuid::Uuid;
use async_trait::async_trait;

/// Archive status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ArchiveStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    Restored,
}

/// Archive storage tier
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StorageTier {
    Hot,       // Frequently accessed
    Warm,      // Occasionally accessed
    Cold,      // Rarely accessed
    Glacier,   // Long-term storage
}

/// Retention policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetentionPolicy {
    pub id: String,
    pub name: String,
    pub description: String,
    pub data_type: String,
    pub retention_days: i64,
    pub archive_after_days: i64,
    pub delete_after_days: Option<i64>,
    pub storage_tier: StorageTier,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl RetentionPolicy {
    pub fn new(
        name: String,
        data_type: String,
        retention_days: i64,
        archive_after_days: i64,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            description: String::new(),
            data_type,
            retention_days,
            archive_after_days,
            delete_after_days: None,
            storage_tier: StorageTier::Cold,
            enabled: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }
}

/// Archive record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveRecord {
    pub id: String,
    pub data_type: String,
    pub data_id: String,
    pub storage_path: String,
    pub storage_tier: StorageTier,
    pub original_size: u64,
    pub compressed_size: u64,
    pub checksum: String,
    pub status: ArchiveStatus,
    pub archived_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub metadata: HashMap<String, String>,
}

/// Archive job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveJob {
    pub id: String,
    pub name: String,
    pub policy_id: String,
    pub data_type: String,
    pub status: ArchiveStatus,
    pub total_records: usize,
    pub archived_records: usize,
    pub failed_records: usize,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub error_message: Option<String>,
}

impl ArchiveJob {
    pub fn new(name: String, policy_id: String, data_type: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            policy_id,
            data_type,
            status: ArchiveStatus::Pending,
            total_records: 0,
            archived_records: 0,
            failed_records: 0,
            started_at: None,
            completed_at: None,
            error_message: None,
        }
    }
}

/// Archival notification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchivalNotification {
    pub id: String,
    pub notification_type: ArchivalNotificationType,
    pub job_id: String,
    pub message: String,
    pub recipients: Vec<String>,
    pub sent_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ArchivalNotificationType {
    JobStarted,
    JobCompleted,
    JobFailed,
    PolicyExpiring,
    StorageThreshold,
}

/// Archive query parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveQuery {
    pub data_type: Option<String>,
    pub status: Option<ArchiveStatus>,
    pub from_date: Option<DateTime<Utc>>,
    pub to_date: Option<DateTime<Utc>>,
    pub storage_tier: Option<StorageTier>,
    pub limit: usize,
    pub offset: usize,
}

impl Default for ArchiveQuery {
    fn default() -> Self {
        Self {
            data_type: None,
            status: None,
            from_date: None,
            to_date: None,
            storage_tier: None,
            limit: 100,
            offset: 0,
        }
    }
}

/// Archive statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveStats {
    pub total_archives: usize,
    pub total_size: u64,
    pub by_status: HashMap<String, usize>,
    pub by_tier: HashMap<String, usize>,
    pub by_data_type: HashMap<String, usize>,
}

/// Archival storage trait
#[async_trait]
pub trait ArchivalStorage: Send + Sync {
    async fn store(&self, data: &[u8], path: &str) -> Result<String>;
    async fn retrieve(&self, path: &str) -> Result<Vec<u8>>;
    async fn delete(&self, path: &str) -> Result<()>;
    async fn exists(&self, path: &str) -> Result<bool>;
    async fn move_to_tier(&self, path: &str, tier: &StorageTier) -> Result<()>;
}

/// Data archival service
pub struct ArchivalService {
    policies: Arc<RwLock<HashMap<String, RetentionPolicy>>>,
    archives: Arc<RwLock<HashMap<String, ArchiveRecord>>>,
    jobs: Arc<RwLock<HashMap<String, ArchiveJob>>>,
    storage: Arc<dyn ArchivalStorage>,
}

impl ArchivalService {
    pub fn new(storage: Arc<dyn ArchivalStorage>) -> Self {
        Self {
            policies: Arc::new(RwLock::new(HashMap::new())),
            archives: Arc::new(RwLock::new(HashMap::new())),
            jobs: Arc::new(RwLock::new(HashMap::new())),
            storage,
        }
    }

    /// Create a retention policy
    pub fn create_policy(&self, policy: RetentionPolicy) -> Result<String> {
        let mut policies = self.policies.write()
            .map_err(|_| anyhow::anyhow!("Failed to acquire write lock"))?;

        let policy_id = policy.id.clone();
        policies.insert(policy_id.clone(), policy);

        Ok(policy_id)
    }

    /// Get retention policy
    pub fn get_policy(&self, policy_id: &str) -> Result<RetentionPolicy> {
        let policies = self.policies.read()
            .map_err(|_| anyhow::anyhow!("Failed to acquire read lock"))?;

        policies.get(policy_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Policy not found"))
    }

    /// List all retention policies
    pub fn list_policies(&self) -> Result<Vec<RetentionPolicy>> {
        let policies = self.policies.read()
            .map_err(|_| anyhow::anyhow!("Failed to acquire read lock"))?;

        Ok(policies.values().cloned().collect())
    }

    /// Update retention policy
    pub fn update_policy(&self, policy_id: &str, mut policy: RetentionPolicy) -> Result<()> {
        let mut policies = self.policies.write()
            .map_err(|_| anyhow::anyhow!("Failed to acquire write lock"))?;

        if !policies.contains_key(policy_id) {
            return Err(anyhow::anyhow!("Policy not found"));
        }

        policy.updated_at = Utc::now();
        policies.insert(policy_id.to_string(), policy);

        Ok(())
    }

    /// Delete retention policy
    pub fn delete_policy(&self, policy_id: &str) -> Result<()> {
        let mut policies = self.policies.write()
            .map_err(|_| anyhow::anyhow!("Failed to acquire write lock"))?;

        policies.remove(policy_id)
            .ok_or_else(|| anyhow::anyhow!("Policy not found"))?;

        Ok(())
    }

    /// Create archive job
    pub fn create_job(&self, job: ArchiveJob) -> Result<String> {
        let mut jobs = self.jobs.write()
            .map_err(|_| anyhow::anyhow!("Failed to acquire write lock"))?;

        let job_id = job.id.clone();
        jobs.insert(job_id.clone(), job);

        Ok(job_id)
    }

    /// Get archive job
    pub fn get_job(&self, job_id: &str) -> Result<ArchiveJob> {
        let jobs = self.jobs.read()
            .map_err(|_| anyhow::anyhow!("Failed to acquire read lock"))?;

        jobs.get(job_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Job not found"))
    }

    /// Update job status
    pub fn update_job(&self, job_id: &str, mut job: ArchiveJob) -> Result<()> {
        let mut jobs = self.jobs.write()
            .map_err(|_| anyhow::anyhow!("Failed to acquire write lock"))?;

        if !jobs.contains_key(job_id) {
            return Err(anyhow::anyhow!("Job not found"));
        }

        jobs.insert(job_id.to_string(), job);

        Ok(())
    }

    /// List jobs
    pub fn list_jobs(&self, status: Option<ArchiveStatus>) -> Result<Vec<ArchiveJob>> {
        let jobs = self.jobs.read()
            .map_err(|_| anyhow::anyhow!("Failed to acquire read lock"))?;

        let mut result: Vec<ArchiveJob> = jobs.values().cloned().collect();

        if let Some(filter_status) = status {
            result.retain(|job| job.status == filter_status);
        }

        Ok(result)
    }

    /// Archive data
    pub async fn archive_data(
        &self,
        data_type: String,
        data_id: String,
        data: Vec<u8>,
        policy_id: String,
    ) -> Result<String> {
        let policy = self.get_policy(&policy_id)?;

        // Generate storage path
        let storage_path = format!("archives/{}/{}/{}",
            data_type,
            Utc::now().format("%Y/%m/%d"),
            data_id
        );

        // Compress data
        let compressed_data = self.compress_data(&data)?;
        let compressed_size = compressed_data.len() as u64;

        // Store data
        let checksum = self.storage.store(&compressed_data, &storage_path).await?;

        // Create archive record
        let expires_at = policy.delete_after_days.map(|days| {
            Utc::now() + Duration::days(days)
        });

        let archive = ArchiveRecord {
            id: Uuid::new_v4().to_string(),
            data_type,
            data_id,
            storage_path,
            storage_tier: policy.storage_tier.clone(),
            original_size: data.len() as u64,
            compressed_size,
            checksum,
            status: ArchiveStatus::Completed,
            archived_at: Utc::now(),
            expires_at,
            metadata: HashMap::new(),
        };

        let archive_id = archive.id.clone();

        let mut archives = self.archives.write()
            .map_err(|_| anyhow::anyhow!("Failed to acquire write lock"))?;
        archives.insert(archive_id.clone(), archive);

        Ok(archive_id)
    }

    /// Restore archived data
    pub async fn restore_data(&self, archive_id: &str) -> Result<Vec<u8>> {
        let archive = {
            let archives = self.archives.read()
                .map_err(|_| anyhow::anyhow!("Failed to acquire read lock"))?;
            archives.get(archive_id)
                .cloned()
                .ok_or_else(|| anyhow::anyhow!("Archive not found"))?
        };

        // Retrieve compressed data
        let compressed_data = self.storage.retrieve(&archive.storage_path).await?;

        // Decompress data
        let data = self.decompress_data(&compressed_data)?;

        // Update archive status
        let mut archives = self.archives.write()
            .map_err(|_| anyhow::anyhow!("Failed to acquire write lock"))?;
        if let Some(mut archive) = archives.get_mut(archive_id) {
            archive.status = ArchiveStatus::Restored;
        }

        Ok(data)
    }

    /// Query archives
    pub fn query_archives(&self, query: ArchiveQuery) -> Result<Vec<ArchiveRecord>> {
        let archives = self.archives.read()
            .map_err(|_| anyhow::anyhow!("Failed to acquire read lock"))?;

        let mut results: Vec<ArchiveRecord> = archives.values()
            .filter(|archive| {
                // Filter by data type
                if let Some(ref dt) = query.data_type {
                    if &archive.data_type != dt {
                        return false;
                    }
                }

                // Filter by status
                if let Some(ref status) = query.status {
                    if &archive.status != status {
                        return false;
                    }
                }

                // Filter by date range
                if let Some(from) = query.from_date {
                    if archive.archived_at < from {
                        return false;
                    }
                }

                if let Some(to) = query.to_date {
                    if archive.archived_at > to {
                        return false;
                    }
                }

                // Filter by storage tier
                if let Some(ref tier) = query.storage_tier {
                    // Note: This is a simplified comparison
                    return true;
                }

                true
            })
            .cloned()
            .collect();

        // Sort by archived_at descending
        results.sort_by(|a, b| b.archived_at.cmp(&a.archived_at));

        // Apply pagination
        let start = query.offset;
        let end = (start + query.limit).min(results.len());

        Ok(results[start..end].to_vec())
    }

    /// Get archive statistics
    pub fn get_statistics(&self) -> Result<ArchiveStats> {
        let archives = self.archives.read()
            .map_err(|_| anyhow::anyhow!("Failed to acquire read lock"))?;

        let mut stats = ArchiveStats {
            total_archives: archives.len(),
            total_size: 0,
            by_status: HashMap::new(),
            by_tier: HashMap::new(),
            by_data_type: HashMap::new(),
        };

        for archive in archives.values() {
            stats.total_size += archive.compressed_size;

            let status_key = format!("{:?}", archive.status);
            *stats.by_status.entry(status_key).or_insert(0) += 1;

            let tier_key = format!("{:?}", archive.storage_tier);
            *stats.by_tier.entry(tier_key).or_insert(0) += 1;

            *stats.by_data_type.entry(archive.data_type.clone()).or_insert(0) += 1;
        }

        Ok(stats)
    }

    /// Delete archived data
    pub async fn delete_archive(&self, archive_id: &str) -> Result<()> {
        let storage_path = {
            let archives = self.archives.read()
                .map_err(|_| anyhow::anyhow!("Failed to acquire read lock"))?;
            let archive = archives.get(archive_id)
                .ok_or_else(|| anyhow::anyhow!("Archive not found"))?;
            archive.storage_path.clone()
        };

        // Delete from storage
        self.storage.delete(&storage_path).await?;

        // Remove from records
        let mut archives = self.archives.write()
            .map_err(|_| anyhow::anyhow!("Failed to acquire write lock"))?;
        archives.remove(archive_id);

        Ok(())
    }

    /// Find archives eligible for archival based on policies
    pub fn find_eligible_data(&self, data_type: &str) -> Result<Vec<String>> {
        let policies = self.policies.read()
            .map_err(|_| anyhow::anyhow!("Failed to acquire read lock"))?;

        // Find policy for this data type
        let policy = policies.values()
            .find(|p| p.data_type == data_type && p.enabled)
            .ok_or_else(|| anyhow::anyhow!("No active policy found for data type"))?;

        let cutoff_date = Utc::now() - Duration::days(policy.archive_after_days);

        // In a real implementation, this would query the database
        // For now, return empty vec
        Ok(Vec::new())
    }

    /// Compress data
    fn compress_data(&self, data: &[u8]) -> Result<Vec<u8>> {
        use std::io::Write;
        use flate2::Compression;
        use flate2::write::GzEncoder;

        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(data)?;
        let compressed = encoder.finish()?;

        Ok(compressed)
    }

    /// Decompress data
    fn decompress_data(&self, data: &[u8]) -> Result<Vec<u8>> {
        use std::io::Read;
        use flate2::read::GzDecoder;

        let mut decoder = GzDecoder::new(data);
        let mut decompressed = Vec::new();
        decoder.read_to_end(&mut decompressed)?;

        Ok(decompressed)
    }
}

impl Clone for ArchivalService {
    fn clone(&self) -> Self {
        Self {
            policies: Arc::clone(&self.policies),
            archives: Arc::clone(&self.archives),
            jobs: Arc::clone(&self.jobs),
            storage: Arc::clone(&self.storage),
        }
    }
}
