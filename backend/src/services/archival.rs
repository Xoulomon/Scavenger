// Archival service: manages archival of records across storage tiers and
// coordinates with contract state. This module also contains the contract
// test coverage for archival interactions (partial-failure rollback and
// idempotent re-archival).

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

/// Storage tiers available for archival.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum StorageTier {
    Hot,
    Warm,
    Cold,
}

/// Status of an archival job.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
    RolledBack,
}

/// Retention policy applied to archived records.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RetentionPolicy {
    pub days: u64,
    pub tier: StorageTier,
}

/// A record eligible for archival.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveRecord {
    pub id: String,
    pub payload: Vec<u8>,
    pub tier: StorageTier,
}

/// Query used to select records for archival.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveQuery {
    pub older_than_days: u64,
    pub tier: StorageTier,
}

/// Aggregated archival statistics.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ArchiveStats {
    pub archived: u64,
    pub failed: u64,
    pub rolled_back: u64,
}

/// Notification emitted when archival completes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchivalNotification {
    pub job_id: String,
    pub status: ArchiveStatus,
}

/// A single archival job.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArchiveJob {
    pub id: String,
    pub query: ArchiveQuery,
    pub status: ArchiveStatus,
}

/// Abstraction over the storage backend used during archival.
pub trait ArchivalStorage: Send + Sync {
    fn store(&self, record: &ArchiveRecord) -> Result<(), String>;
    fn remove(&self, id: &str) -> Result<(), String>;
    fn contains(&self, id: &str) -> bool;
}

/// Abstraction over the contract state that must stay consistent with storage.
pub trait ContractState: Send + Sync {
    fn mark_archived(&self, id: &str, tier: StorageTier) -> Result<(), String>;
    fn unmark_archived(&self, id: &str) -> Result<(), String>;
    fn is_archived(&self, id: &str) -> bool;
}

/// In-memory archival storage used by the service and tests.
#[derive(Default)]
pub struct InMemoryArchivalStorage {
    records: Mutex<HashMap<String, ArchiveRecord>>,
}

impl InMemoryArchivalStorage {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn len(&self) -> usize {
        self.records.lock().unwrap().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

impl ArchivalStorage for InMemoryArchivalStorage {
    fn store(&self, record: &ArchiveRecord) -> Result<(), String> {
        self.records
            .lock()
            .unwrap()
            .insert(record.id.clone(), record.clone());
        Ok(())
    }

    fn remove(&self, id: &str) -> Result<(), String> {
        self.records.lock().unwrap().remove(id);
        Ok(())
    }

    fn contains(&self, id: &str) -> bool {
        self.records.lock().unwrap().contains_key(id)
    }
}

/// In-memory contract state used by the service and tests.
#[derive(Default)]
pub struct InMemoryContractState {
    archived: Mutex<HashMap<String, StorageTier>>,
}

impl InMemoryContractState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn len(&self) -> usize {
        self.archived.lock().unwrap().len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

impl ContractState for InMemoryContractState {
    fn mark_archived(&self, id: &str, tier: StorageTier) -> Result<(), String> {
        self.archived.lock().unwrap().insert(id.to_string(), tier);
        Ok(())
    }

    fn unmark_archived(&self, id: &str) -> Result<(), String> {
        self.archived.lock().unwrap().remove(id);
        Ok(())
    }

    fn is_archived(&self, id: &str) -> bool {
        self.archived.lock().unwrap().contains_key(id)
    }
}

/// The archival service coordinates storage writes with contract state
/// updates, rolling back storage when the contract update fails.
pub struct ArchivalService {
    storage: Arc<dyn ArchivalStorage>,
    contract: Arc<dyn ContractState>,
    stats: Mutex<ArchiveStats>,
}

impl ArchivalService {
    pub fn new(storage: Arc<dyn ArchivalStorage>, contract: Arc<dyn ContractState>) -> Self {
        Self {
            storage,
            contract,
            stats: Mutex::new(ArchiveStats::default()),
        }
    }

    pub fn stats(&self) -> ArchiveStats {
        self.stats.lock().unwrap().clone()
    }

    /// Archive a single record. If the contract state update fails after the
    /// storage write succeeds, the storage write is rolled back so that
    /// storage and contract state remain consistent.
    pub fn archive_record(&self, record: &ArchiveRecord) -> Result<ArchiveStatus, String> {
        // Idempotent re-archival: if already archived in both storage and
        // contract state, do nothing and report Completed.
        if self.storage.contains(&record.id) && self.contract.is_archived(&record.id) {
            return Ok(ArchiveStatus::Completed);
        }

        self.storage.store(record)?;

        match self.contract.mark_archived(&record.id, record.tier) {
            Ok(()) => {
                self.stats.lock().unwrap().archived += 1;
                Ok(ArchiveStatus::Completed)
            }
            Err(e) => {
                // Partial failure: roll back the storage write.
                let _ = self.storage.remove(&record.id);
                self.stats.lock().unwrap().rolled_back += 1;
                self.stats.lock().unwrap().failed += 1;
                Err(format!("contract update failed, rolled back: {e}"))
            }
        }
    }

    /// Archive a batch of records selected by a query. Returns the job with
    /// its final status. Records that fail are rolled back individually.
    pub fn archive(&self, job_id: &str, records: &[ArchiveRecord]) -> ArchiveJob {
        let mut status = ArchiveStatus::Completed;
        for record in records {
            if self.archive_record(record).is_err() {
                status = ArchiveStatus::RolledBack;
            }
        }
        ArchiveJob {
            id: job_id.to_string(),
            query: ArchiveQuery {
                older_than_days: 0,
                tier: StorageTier::Cold,
            },
            status,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Contract state that fails on the first `mark_archived` call.
    struct FailingContractState {
        inner: InMemoryContractState,
        fail_next: Mutex<bool>,
    }

    impl FailingContractState {
        fn new() -> Self {
            Self {
                inner: InMemoryContractState::new(),
                fail_next: Mutex::new(true),
            }
        }
    }

    impl ContractState for FailingContractState {
        fn mark_archived(&self, id: &str, tier: StorageTier) -> Result<(), String> {
            let mut fail = self.fail_next.lock().unwrap();
            if *fail {
                *fail = false;
                return Err("contract unavailable".to_string());
            }
            self.inner.mark_archived(id, tier)
        }

        fn unmark_archived(&self, id: &str) -> Result<(), String> {
            self.inner.unmark_archived(id)
        }

        fn is_archived(&self, id: &str) -> bool {
            self.inner.is_archived(id)
        }
    }

    fn record(id: &str) -> ArchiveRecord {
        ArchiveRecord {
            id: id.to_string(),
            payload: vec![1, 2, 3],
            tier: StorageTier::Cold,
        }
    }

    #[test]
    fn archive_record_succeeds_and_updates_both_sides() {
        let storage = Arc::new(InMemoryArchivalStorage::new());
        let contract = Arc::new(InMemoryContractState::new());
        let service = ArchivalService::new(storage.clone(), contract.clone());

        let status = service.archive_record(&record("r1")).unwrap();
        assert_eq!(status, ArchiveStatus::Completed);
        assert!(storage.contains("r1"));
        assert!(contract.is_archived("r1"));
        assert_eq!(service.stats().archived, 1);
    }

    #[test]
    fn partial_failure_rolls_back_storage() {
        let storage = Arc::new(InMemoryArchivalStorage::new());
        let contract = Arc::new(FailingContractState::new());
        let service = ArchivalService::new(storage.clone(), contract.clone());

        let err = service.archive_record(&record("r2")).unwrap_err();
        assert!(err.contains("rolled back"));
        // Storage write must be rolled back to stay consistent with contract.
        assert!(!storage.contains("r2"));
        assert!(!contract.is_archived("r2"));
        let stats = service.stats();
        assert_eq!(stats.rolled_back, 1);
        assert_eq!(stats.failed, 1);
        assert_eq!(stats.archived, 0);
    }

    #[test]
    fn partial_failure_then_retry_succeeds() {
        let storage = Arc::new(InMemoryArchivalStorage::new());
        let contract = Arc::new(FailingContractState::new());
        let service = ArchivalService::new(storage.clone(), contract.clone());

        assert!(service.archive_record(&record("r3")).is_err());
        // Retry after the transient contract failure.
        let status = service.archive_record(&record("r3")).unwrap();
        assert_eq!(status, ArchiveStatus::Completed);
        assert!(storage.contains("r3"));
        assert!(contract.is_archived("r3"));
    }

    #[test]
    fn re_archival_is_idempotent() {
        let storage = Arc::new(InMemoryArchivalStorage::new());
        let contract = Arc::new(InMemoryContractState::new());
        let service = ArchivalService::new(storage.clone(), contract.clone());

        assert_eq!(
            service.archive_record(&record("r4")).unwrap(),
            ArchiveStatus::Completed
        );
        assert_eq!(
            service.archive_record(&record("r4")).unwrap(),
            ArchiveStatus::Completed
        );
        // No duplication or corruption of state.
        assert_eq!(storage.len(), 1);
        assert_eq!(contract.len(), 1);
        assert_eq!(service.stats().archived, 1);
    }

    #[test]
    fn batch_archive_reports_rolled_back_on_failure() {
        let storage = Arc::new(InMemoryArchivalStorage::new());
        let contract = Arc::new(FailingContractState::new());
        let service = ArchivalService::new(storage.clone(), contract.clone());

        let records = vec![record("b1"), record("b2")];
        let job = service.archive("job-1", &records);
        assert_eq!(job.status, ArchiveStatus::RolledBack);
        // First record rolled back, second succeeded.
        assert!(!storage.contains("b1"));
        assert!(storage.contains("b2"));
        assert!(contract.is_archived("b2"));
    }
}
