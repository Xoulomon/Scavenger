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
        self.records.lock().unwrap().insert(record.id.clone(), record.clone());
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

/// Repository abstraction for archival data access. Route handlers no longer
/// touch storage directly; they go through the service, which uses this
/// repository to load and persist records.
pub trait ArchivalRepository: Send + Sync {
    /// Fetch records eligible for archival according to the query.
    fn find_eligible(&self, query: &ArchiveQuery) -> Result<Vec<ArchiveRecord>, String>;
    /// Persist the final status of an archival job.
    fn save_job(&self, job: &ArchiveJob) -> Result<(), String>;
    /// Load a previously persisted job by id.
    fn find_job(&self, job_id: &str) -> Result<Option<ArchiveJob>, String>;
}

/// In-memory repository implementation used by the service and tests.
#[derive(Default)]
pub struct InMemoryArchivalRepository {
    records: Mutex<Vec<ArchiveRecord>>,
    jobs: Mutex<HashMap<String, ArchiveJob>>,
}

impl InMemoryArchivalRepository {
    pub fn new() -> Self {
        Self::default()
    }

    /// Seed the repository with records eligible for archival.
    pub fn with_records(records: Vec<ArchiveRecord>) -> Self {
        Self {
            records: Mutex::new(records),
            jobs: Mutex::new(HashMap::new()),
        }
    }

    pub fn job_count(&self) -> usize {
        self.jobs.lock().unwrap().len()
    }
}

impl ArchivalRepository for InMemoryArchivalRepository {
    fn find_eligible(&self, query: &ArchiveQuery) -> Result<Vec<ArchiveRecord>, String> {
        let records = self.records.lock().unwrap();
        Ok(records.iter().filter(|r| r.tier == query.tier).cloned().collect())
    }

    fn save_job(&self, job: &ArchiveJob) -> Result<(), String> {
        self.jobs.lock().unwrap().insert(job.id.clone(), job.clone());
        Ok(())
    }

    fn find_job(&self, job_id: &str) -> Result<Option<ArchiveJob>, String> {
        Ok(self.jobs.lock().unwrap().get(job_id).cloned())
    }
}

/// The archival service coordinates storage writes with contract state
/// updates, rolling back storage when the contract update fails. It also
/// owns the business logic previously embedded in the archival route
/// handlers, delegating data access to an [`ArchivalRepository`].
pub struct ArchivalService {
    storage: Arc<dyn ArchivalStorage>,
    contract: Arc<dyn ContractState>,
    repository: Arc<dyn ArchivalRepository>,
    stats: Mutex<ArchiveStats>,
}

impl ArchivalService {
    pub fn new(storage: Arc<dyn ArchivalStorage>, contract: Arc<dyn ContractState>) -> Self {
        Self::with_repository(storage, contract, Arc::new(InMemoryArchivalRepository::new()))
    }

    pub fn with_repository(
        storage: Arc<dyn ArchivalStorage>,
        contract: Arc<dyn ContractState>,
        repository: Arc<dyn ArchivalRepository>,
    ) -> Self {
        Self {
            storage,
            contract,
            repository,
            stats: Mutex::new(ArchiveStats::default()),
        }
    }

    pub fn stats(&self) -> ArchiveStats {
        self.stats.lock().unwrap().clone()
    }

    /// Business logic for the "create archival job" route handler: select
    /// eligible records via the repository, archive them, and persist the
    /// resulting job.
    pub fn create_job(&self, job_id: &str, query: &ArchiveQuery) -> Result<ArchiveJob, String> {
        let records = self.repository.find_eligible(query)?;
        let job = self.archive(job_id, &records);
        self.repository.save_job(&job)?;
        Ok(job)
    }

    /// Business logic for the "get archival job" route handler.
    pub fn get_job(&self, job_id: &str) -> Result<Option<ArchiveJob>, String> {
        self.repository.find_job(job_id)
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

        assert_eq!(service.archive_record(&record("r4")).unwrap(), ArchiveStatus::Completed);
        assert_eq!(service.archive_record(&record("r4")).unwrap(), ArchiveStatus::Completed);
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

    /// Mock repository that records calls and can be configured to fail.
    struct MockRepository {
        eligible: Vec<ArchiveRecord>,
        fail_find: bool,
        fail_save: bool,
        saved: Mutex<Vec<ArchiveJob>>,
    }

    impl MockRepository {
        fn new(eligible: Vec<ArchiveRecord>) -> Self {
            Self {
                eligible,
                fail_find: false,
                fail_save: false,
                saved: Mutex::new(Vec::new()),
            }
        }
    }

    impl ArchivalRepository for MockRepository {
        fn find_eligible(&self, _query: &ArchiveQuery) -> Result<Vec<ArchiveRecord>, String> {
            if self.fail_find {
                return Err("repository unavailable".to_string());
            }
            Ok(self.eligible.clone())
        }

        fn save_job(&self, job: &ArchiveJob) -> Result<(), String> {
            if self.fail_save {
                return Err("save failed".to_string());
            }
            self.saved.lock().unwrap().push(job.clone());
            Ok(())
        }

        fn find_job(&self, job_id: &str) -> Result<Option<ArchiveJob>, String> {
            Ok(self.saved.lock().unwrap().iter().find(|j| j.id == job_id).cloned())
        }
    }

    #[test]
    fn create_job_uses_repository_and_persists_job() {
        let storage = Arc::new(InMemoryArchivalStorage::new());
        let contract = Arc::new(InMemoryContractState::new());
        let repo = Arc::new(MockRepository::new(vec![record("m1"), record("m2")]));
        let service = ArchivalService::with_repository(storage.clone(), contract.clone(), repo.clone());

        let query = ArchiveQuery {
            older_than_days: 30,
            tier: StorageTier::Cold,
        };
        let job = service.create_job("job-m", &query).unwrap();
        assert_eq!(job.status, ArchiveStatus::Completed);
        assert!(storage.contains("m1"));
        assert!(storage.contains("m2"));
        assert!(contract.is_archived("m1"));
        assert_eq!(repo.saved.lock().unwrap().len(), 1);
        assert_eq!(service.stats().archived, 2);
    }

    #[test]
    fn create_job_propagates_repository_find_error() {
        let storage = Arc::new(InMemoryArchivalStorage::new());
        let contract = Arc::new(InMemoryContractState::new());
        let mut mock = MockRepository::new(vec![]);
        mock.fail_find = true;
        let service = ArchivalService::with_repository(storage, contract, Arc::new(mock));

        let query = ArchiveQuery {
            older_than_days: 1,
            tier: StorageTier::Cold,
        };
        let err = service.create_job("job-err", &query).unwrap_err();
        assert!(err.contains("repository unavailable"));
    }

    #[test]
    fn create_job_propagates_repository_save_error() {
        let storage = Arc::new(InMemoryArchivalStorage::new());
        let contract = Arc::new(InMemoryContractState::new());
        let mut mock = MockRepository::new(vec![record("m3")]);
        mock.fail_save = true;
        let service = ArchivalService::with_repository(storage, contract, Arc::new(mock));

        let query = ArchiveQuery {
            older_than_days: 1,
            tier: StorageTier::Cold,
        };
        let err = service.create_job("job-save", &query).unwrap_err();
        assert!(err.contains("save failed"));
    }

    #[test]
    fn get_job_returns_persisted_job() {
        let storage = Arc::new(InMemoryArchivalStorage::new());
        let contract = Arc::new(InMemoryContractState::new());
        let repo = Arc::new(InMemoryArchivalRepository::with_records(vec![record("g1")]));
        let service = ArchivalService::with_repository(storage, contract, repo);

        let query = ArchiveQuery {
            older_than_days: 7,
            tier: StorageTier::Cold,
        };
        let created = service.create_job("job-get", &query).unwrap();
        let fetched = service.get_job("job-get").unwrap().unwrap();
        assert_eq!(fetched, created);
        assert!(service.get_job("missing").unwrap().is_none());
    }

    #[test]
    fn in_memory_repository_filters_by_tier() {
        let mut warm = record("w1");
        warm.tier = StorageTier::Warm;
        let repo = InMemoryArchivalRepository::with_records(vec![record("c1"), warm]);

        let cold_query = ArchiveQuery {
            older_than_days: 0,
            tier: StorageTier::Cold,
        };
        let cold = repo.find_eligible(&cold_query).unwrap();
        assert_eq!(cold.len(), 1);
        assert_eq!(cold[0].id, "c1");

        let warm_query = ArchiveQuery {
            older_than_days: 0,
            tier: StorageTier::Warm,
        };
        let warm = repo.find_eligible(&warm_query).unwrap();
        assert_eq!(warm.len(), 1);
        assert_eq!(warm[0].id, "w1");
    }
}
