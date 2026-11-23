//! Verification business logic: validation and state transitions. The HTTP handlers in
//! `api/verification.rs` call into this module.

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Domain constants ──────────────────────────────────────────────────────────
//
// All verification domain rules are defined here, as named constants, so that
// they can be unit-tested in isolation without any HTTP layer dependency.
// The API layer (`api/verification.rs`) must never define its own thresholds.

/// Maximum number of times a participant may retry their verification before
/// the system refuses further retries.
pub const MAX_VERIFICATION_RETRIES: u32 = 3;

/// Maximum character length accepted for a `doc_type` identifier.
/// This constant is imported and reused by the API layer's input validation.
pub const MAX_DOC_TYPE_LEN: usize = 64;

// ── #1158: Extracted helper for retry logic ───────────────────────────────────

/// #1158: extracted from retry_verification
/// Returns `Ok(())` if a retry is allowed, or `Err` with a human-readable
/// message when the participant has already exhausted their retries.
pub fn check_retry_allowed(current_count: u32, max: u32) -> Result<(), String> {
    if current_count >= max {
        Err(format!("Maximum retry attempts ({}) exceeded", max))
    } else {
        Ok(())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum VerificationStatus {
    #[serde(rename = "pending")]
    Pending,
    #[serde(rename = "approved")]
    Approved,
    #[serde(rename = "rejected")]
    Rejected,
    #[serde(rename = "under_review")]
    UnderReview,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VerificationRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub auto_approve: bool,
    pub checks: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Document {
    pub id: String,
    pub participant_id: String,
    pub doc_type: String,
    pub url: String,
    pub uploaded_at: DateTime<Utc>,
    pub verified: bool,
    pub verification_notes: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VerificationChecklist {
    pub id: String,
    pub participant_id: String,
    pub checks: HashMap<String, bool>,
    pub completed_at: Option<DateTime<Utc>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ParticipantVerification {
    pub participant_id: String,
    pub status: VerificationStatus,
    pub documents: Vec<Document>,
    pub checklist: VerificationChecklist,
    pub notes: Option<String>,
    pub submitted_at: DateTime<Utc>,
    pub reviewed_at: Option<DateTime<Utc>>,
    pub reviewed_by: Option<String>,
    pub retry_count: u32,
    pub last_retry_at: Option<DateTime<Utc>>,
}

#[async_trait]
pub trait VerificationService: Send + Sync {
    async fn start_verification(&self, participant_id: String) -> Result<ParticipantVerification, String>;
    async fn submit_document(&self, participant_id: String, doc_type: String, url: String) -> Result<Document, String>;
    async fn verify_document(&self, doc_id: String) -> Result<Document, String>;
    async fn get_verification_status(&self, participant_id: String) -> Result<ParticipantVerification, String>;
    async fn submit_checklist(
        &self,
        participant_id: String,
        checks: HashMap<String, bool>,
    ) -> Result<VerificationChecklist, String>;
    async fn create_review_queue_item(&self, participant_id: String) -> Result<String, String>;
    async fn approve_participant(&self, participant_id: String, reviewer_id: String) -> Result<(), String>;
    async fn reject_participant(
        &self,
        participant_id: String,
        reason: String,
        reviewer_id: String,
    ) -> Result<(), String>;
    async fn get_pending_reviews(&self) -> Result<Vec<ParticipantVerification>, String>;
    async fn retry_verification(&self, participant_id: String) -> Result<ParticipantVerification, String>;
    async fn send_approval_notification(&self, participant_id: String) -> Result<(), String>;
    async fn send_rejection_notification(&self, participant_id: String, reason: String) -> Result<(), String>;
}

// ── Repository layer ──────────────────────────────────────────────────────────
//
// Data access for verifications is abstracted behind this trait so that the
// business logic in `DefaultVerificationService` can be unit-tested with a
// mocked repository, and so the HTTP layer never touches storage directly.

#[async_trait]
pub trait VerificationRepository: Send + Sync {
    async fn get(&self, participant_id: &str) -> Result<Option<ParticipantVerification>, String>;
    async fn save(&self, verification: ParticipantVerification) -> Result<(), String>;
    async fn list(&self) -> Result<Vec<ParticipantVerification>, String>;
    async fn find_document(&self, doc_id: &str) -> Result<Option<Document>, String>;
    async fn update_document(&self, doc: Document) -> Result<(), String>;
}

/// In-memory implementation of [`VerificationRepository`].
pub struct InMemoryVerificationRepository {
    verifications: std::sync::Arc<tokio::sync::Mutex<HashMap<String, ParticipantVerification>>>,
}

impl InMemoryVerificationRepository {
    pub fn new() -> Self {
        Self {
            verifications: std::sync::Arc::new(tokio::sync::Mutex::new(HashMap::new())),
        }
    }
}

impl Default for InMemoryVerificationRepository {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl VerificationRepository for InMemoryVerificationRepository {
    async fn get(&self, participant_id: &str) -> Result<Option<ParticipantVerification>, String> {
        let verifications = self.verifications.lock().await;
        Ok(verifications.get(participant_id).cloned())
    }

    async fn save(&self, verification: ParticipantVerification) -> Result<(), String> {
        let mut verifications = self.verifications.lock().await;
        verifications.insert(verification.participant_id.clone(), verification);
        Ok(())
    }

    async fn list(&self) -> Result<Vec<ParticipantVerification>, String> {
        let verifications = self.verifications.lock().await;
        Ok(verifications.values().cloned().collect())
    }

    async fn find_document(&self, doc_id: &str) -> Result<Option<Document>, String> {
        let verifications = self.verifications.lock().await;
        for verification in verifications.values() {
            if let Some(doc) = verification.documents.iter().find(|d| d.id == doc_id) {
                return Ok(Some(doc.clone()));
            }
        }
        Ok(None)
    }

    async fn update_document(&self, doc: Document) -> Result<(), String> {
        let mut verifications = self.verifications.lock().await;
        for verification in verifications.values_mut() {
            if let Some(existing) = verification.documents.iter_mut().find(|d| d.id == doc.id) {
                *existing = doc;
                return Ok(());
            }
        }
        Err("Document not found".to_string())
    }
}

pub struct DefaultVerificationService {
    repository: std::sync::Arc<dyn VerificationRepository>,
    rules: Vec<VerificationRule>,
}

impl DefaultVerificationService {
    pub fn new() -> Self {
        Self::with_repository(std::sync::Arc::new(InMemoryVerificationRepository::new()))
    }

    pub fn with_repository(repository: std::sync::Arc<dyn VerificationRepository>) -> Self {
        Self {
            repository,
            rules: vec![
                VerificationRule {
                    id: "kyc_basic".to_string(),
                    name: "KYC Basic".to_string(),
                    description: "Basic KYC verification".to_string(),
                    enabled: true,
                    auto_approve: false,
                    checks: vec!["identity".to_string(), "address".to_string()],
                },
                VerificationRule {
                    id: "kyb_business".to_string(),
                    name: "KYB Business".to_string(),
                    description: "Business verification".to_string(),
                    enabled: true,
                    auto_approve: false,
                    checks: vec!["business_registration".to_string(), "tax_id".to_string()],
                },
            ],
        }
    }

    fn create_default_checklist(participant_id: String) -> VerificationChecklist {
        let mut checks = HashMap::new();
        checks.insert("identity".to_string(), false);
        checks.insert("address".to_string(), false);
        checks.insert("business_registration".to_string(), false);
        checks.insert("tax_id".to_string(), false);

        VerificationChecklist {
            id: uuid::Uuid::new_v4().to_string(),
            participant_id,
            checks,
            completed_at: None,
        }
    }
}

#[async_trait]
impl VerificationService for DefaultVerificationService {
    async fn start_verification(&self, participant_id: String) -> Result<ParticipantVerification, String> {
        let verification = ParticipantVerification {
            participant_id: participant_id.clone(),
            status: VerificationStatus::Pending,
            documents: Vec::new(),
            checklist: Self::create_default_checklist(participant_id.clone()),
            notes: None,
            submitted_at: Utc::now(),
            reviewed_at: None,
            reviewed_by: None,
            retry_count: 0,
            last_retry_at: None,
        };

        self.repository.save(verification.clone()).await?;
        Ok(verification)
    }

    async fn submit_document(&self, participant_id: String, doc_type: String, url: String) -> Result<Document, String> {
        let doc = Document {
            id: uuid::Uuid::new_v4().to_string(),
            participant_id: participant_id.clone(),
            doc_type,
            url,
            uploaded_at: Utc::now(),
            verified: false,
            verification_notes: None,
        };

        let mut verification = self
            .repository
            .get(&participant_id)
            .await?
            .ok_or_else(|| "Verification not found".to_string())?;
        verification.documents.push(doc.clone());
        self.repository.save(verification).await?;
        Ok(doc)
    }

    async fn verify_document(&self, doc_id: String) -> Result<Document, String> {
        let mut doc = self
            .repository
            .find_document(&doc_id)
            .await?
            .ok_or_else(|| "Document not found".to_string())?;
        doc.verified = true;
        doc.verification_notes = Some("Document verified".to_string());
        self.repository.update_document(doc.clone()).await?;
        Ok(doc)
    }

    async fn get_verification_status(&self, participant_id: String) -> Result<ParticipantVerification, String> {
        self.repository
            .get(&participant_id)
            .await?
            .ok_or_else(|| "Verification not found".to_string())
    }

    async fn submit_checklist(
        &self,
        participant_id: String,
        checks: HashMap<String, bool>,
    ) -> Result<VerificationChecklist, String> {
        let mut verification = self
            .repository
            .get(&participant_id)
            .await?
            .ok_or_else(|| "Verification not found".to_string())?;
        verification.checklist.checks = checks;
        verification.checklist.completed_at = Some(Utc::now());
        let checklist = verification.checklist.clone();
        self.repository.save(verification).await?;
        Ok(checklist)
    }

    async fn create_review_queue_item(&self, participant_id: String) -> Result<String, String> {
        let mut verification = self
            .repository
            .get(&participant_id)
            .await?
            .ok_or_else(|| "Verification not found".to_string())?;
        verification.status = VerificationStatus::UnderReview;
        self.repository.save(verification).await?;
        Ok(uuid::Uuid::new_v4().to_string())
    }

    async fn approve_participant(&self, participant_id: String, reviewer_id: String) -> Result<(), String> {
        let mut verification = self
            .repository
            .get(&participant_id)
            .await?
            .ok_or_else(|| "Verification not found".to_string())?;
        verification.status = VerificationStatus::Approved;
        verification.reviewed_at = Some(Utc::now());
        verification.reviewed_by = Some(reviewer_id);
        self.repository.save(verification).await
    }

    async fn reject_participant(
        &self,
        participant_id: String,
        reason: String,
        reviewer_id: String,
    ) -> Result<(), String> {
        let mut verification = self
            .repository
            .get(&participant_id)
            .await?
            .ok_or_else(|| "Verification not found".to_string())?;
        verification.status = VerificationStatus::Rejected;
        verification.notes = Some(reason);
        verification.reviewed_at = Some(Utc::now());
        verification.reviewed_by = Some(reviewer_id);
        self.repository.save(verification).await
    }

    async fn get_pending_reviews(&self) -> Result<Vec<ParticipantVerification>, String> {
        let all = self.repository.list().await?;
        let pending: Vec<_> = all
            .into_iter()
            .filter(|v| matches!(v.status, VerificationStatus::UnderReview | VerificationStatus::Pending))
            .collect();
        Ok(pending)
    }

    async fn retry_verification(&self, participant_id: String) -> Result<ParticipantVerification, String> {
        let mut verification = self
            .repository
            .get(&participant_id)
            .await?
            .ok_or_else(|| "Verification not found".to_string())?;
        check_retry_allowed(verification.retry_count, MAX_VERIFICATION_RETRIES)?;
        verification.status = VerificationStatus::Pending;
        verification.retry_count += 1;
        verification.last_retry_at = Some(Utc::now());
        self.repository.save(verification.clone()).await?;
        Ok(verification)
    }

    async fn send_approval_notification(&self, participant_id: String) -> Result<(), String> {
        // Integration point for notification service
        tracing::info!("Sending approval notification for participant: {}", participant_id);
        Ok(())
    }

    async fn send_rejection_notification(&self, participant_id: String, reason: String) -> Result<(), String> {
        // Integration point for notification service
        tracing::info!(
            "Sending rejection notification for participant: {} - reason: {}",
            participant_id,
            reason
        );
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── #1158: check_retry_allowed unit tests ────────────────────────────────

    #[test]
    fn test_check_retry_allowed_zero_count_passes() {
        assert!(check_retry_allowed(0, MAX_VERIFICATION_RETRIES).is_ok());
    }

    #[test]
    fn test_check_retry_allowed_below_max_passes() {
        assert!(check_retry_allowed(2, MAX_VERIFICATION_RETRIES).is_ok());
    }

    #[test]
    fn test_check_retry_allowed_at_max_fails() {
        assert!(check_retry_allowed(MAX_VERIFICATION_RETRIES, MAX_VERIFICATION_RETRIES).is_err());
    }

    #[test]
    fn test_check_retry_allowed_above_max_fails() {
        assert!(check_retry_allowed(MAX_VERIFICATION_RETRIES + 1, MAX_VERIFICATION_RETRIES).is_err());
    }

    #[test]
    fn test_check_retry_allowed_error_message_mentions_max() {
        let err = check_retry_allowed(5, 3).unwrap_err();
        assert!(err.contains("3"), "error message should mention max: {err}");
    }

    // ── basic service behaviour ────────────────────────────────────────────────

    #[tokio::test]
    async fn test_start_verification() {
        let service = DefaultVerificationService::new();
        let result = service.start_verification("test-participant".to_string()).await;
        assert!(result.is_ok());

        let verification = result.unwrap();
        assert!(matches!(verification.status, VerificationStatus::Pending));
        assert_eq!(verification.participant_id, "test-participant");
    }

    #[tokio::test]
    async fn test_submit_and_verify_document() {
        let service = DefaultVerificationService::new();
        service
            .start_verification("test-participant".to_string())
            .await
            .unwrap();

        let doc = service
            .submit_document(
                "test-participant".to_string(),
                "passport".to_string(),
                "http://example.com/doc".to_string(),
            )
            .await
            .unwrap();

        assert!(!doc.verified);

        let verified_doc = service.verify_document(doc.id.clone()).await.unwrap();
        assert!(verified_doc.verified);
    }

    // ── #1095 – domain-rule unit tests (HTTP-free) ────────────────────────────
    //
    // These tests exercise domain constants and business rules in isolation.
    // They must never import actix-web or reference HTTP concepts so they
    // remain independently runnable without a server.

    /// `MAX_VERIFICATION_RETRIES` is the domain constant; it must be ≥ 1.
    #[test]
    fn test_max_retries_constant_is_positive() {
        assert!(
            MAX_VERIFICATION_RETRIES >= 1,
            "MAX_VERIFICATION_RETRIES must be at least 1"
        );
    }

    /// `MAX_DOC_TYPE_LEN` is the domain constant; it must be a sensible positive bound.
    #[test]
    fn test_max_doc_type_len_is_reasonable() {
        assert!(
            MAX_DOC_TYPE_LEN > 0 && MAX_DOC_TYPE_LEN <= 256,
            "MAX_DOC_TYPE_LEN should be in (0, 256]"
        );
    }

    /// After an approval the status must be `Approved`.
    #[tokio::test]
    async fn test_approve_transitions_to_approved() {
        let service = DefaultVerificationService::new();
        service.start_verification("p-approve".to_string()).await.unwrap();
        service
            .approve_participant("p-approve".to_string(), "reviewer-1".to_string())
            .await
            .unwrap();

        let v = service.get_verification_status("p-approve".to_string()).await.unwrap();
        assert!(
            matches!(v.status, VerificationStatus::Approved),
            "status should be Approved after approve_participant"
        );
    }

    /// After a rejection the status must be `Rejected` and the reason must be stored.
    #[tokio::test]
    async fn test_reject_transitions_to_rejected_with_reason() {
        let service = DefaultVerificationService::new();
        service.start_verification("p-reject".to_string()).await.unwrap();
        service
            .reject_participant(
                "p-reject".to_string(),
                "Missing documentation".to_string(),
                "reviewer-2".to_string(),
            )
            .await
            .unwrap();

        let v = service.get_verification_status("p-reject".to_string()).await.unwrap();
        assert!(
            matches!(v.status, VerificationStatus::Rejected),
            "status should be Rejected after reject_participant"
        );
        assert_eq!(
            v.notes.as_deref(),
            Some("Missing documentation"),
            "rejection reason must be persisted"
        );
    }

    /// `retry_verification` increments the retry counter and resets status to Pending.
    #[tokio::test]
    async fn test_retry_increments_counter_and_resets_to_pending() {
        let service = DefaultVerificationService::new();
        service.start_verification("p-retry".to_string()).await.unwrap();

        let v1 = service.retry_verification("p-retry".to_string()).await.unwrap();
        assert_eq!(v1.retry_count, 1, "first retry should set count to 1");
        assert!(matches!(v1.status, VerificationStatus::Pending));

        let v2 = service.retry_verification("p-retry".to_string()).await.unwrap();
        assert_eq!(v2.retry_count, 2, "second retry should set count to 2");
    }

    /// Attempting to operate on a participant that was never registered must return
    /// an error (not a panic / unwrap failure).
    #[tokio::test]
    async fn test_get_status_for_unknown_participant_returns_error() {
        let service = DefaultVerificationService::new();
        let result = service.get_verification_status("ghost-participant".to_string()).await;
        assert!(result.is_err(), "Expected Err for unregistered participant");
    }

    /// `create_review_queue_item` transitions the status to UnderReview.
    #[tokio::test]
    async fn test_create_review_queue_item_sets_under_review() {
        let service = DefaultVerificationService::new();
        service.start_verification("p-queue".to_string()).await.unwrap();
        service.create_review_queue_item("p-queue".to_string()).await.unwrap();

        let v = service.get_verification_status("p-queue".to_string()).await.unwrap();
        assert!(
            matches!(v.status, VerificationStatus::UnderReview),
            "status should be UnderReview after create_review_queue_item"
        );
    }

    /// Completing a checklist sets `completed_at`.
    #[tokio::test]
    async fn test_submit_checklist_sets_completed_at() {
        let service = DefaultVerificationService::new();
        service.start_verification("p-checklist".to_string()).await.unwrap();

        let mut checks = HashMap::new();
        checks.insert("identity".to_string(), true);
        checks.insert("address".to_string(), true);

        let checklist = service
            .submit_checklist("p-checklist".to_string(), checks)
            .await
            .unwrap();

        assert!(
            checklist.completed_at.is_some(),
            "completed_at must be set after submitting a checklist"
        );
    }

    // ── repository-backed service tests (mocked repository) ───────────────────

    /// A minimal mock repository that records calls and serves fixed data.
    struct MockVerificationRepository {
        stored: std::sync::Arc<tokio::sync::Mutex<HashMap<String, ParticipantVerification>>>,
        save_calls: std::sync::Arc<std::sync::atomic::AtomicUsize>,
    }

    impl MockVerificationRepository {
        fn new() -> Self {
            Self {
                stored: std::sync::Arc::new(tokio::sync::Mutex::new(HashMap::new())),
                save_calls: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            }
        }
    }

    #[async_trait]
    impl VerificationRepository for MockVerificationRepository {
        async fn get(&self, participant_id: &str) -> Result<Option<ParticipantVerification>, String> {
            Ok(self.stored.lock().await.get(participant_id).cloned())
        }

        async fn save(&self, verification: ParticipantVerification) -> Result<(), String> {
            self.save_calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            self.stored
                .lock()
                .await
                .insert(verification.participant_id.clone(), verification);
            Ok(())
        }

        async fn list(&self) -> Result<Vec<ParticipantVerification>, String> {
            Ok(self.stored.lock().await.values().cloned().collect())
        }

        async fn find_document(&self, doc_id: &str) -> Result<Option<Document>, String> {
            for v in self.stored.lock().await.values() {
                if let Some(doc) = v.documents.iter().find(|d| d.id == doc_id) {
                    return Ok(Some(doc.clone()));
                }
            }
            Ok(None)
        }

        async fn update_document(&self, doc: Document) -> Result<(), String> {
            let mut stored = self.stored.lock().await;
            for v in stored.values_mut() {
                if let Some(existing) = v.documents.iter_mut().find(|d| d.id == doc.id) {
                    *existing = doc;
                    return Ok(());
                }
            }
            Err("Document not found".to_string())
        }
    }

    #[tokio::test]
    async fn test_service_uses_injected_repository() {
        let repo = std::sync::Arc::new(MockVerificationRepository::new());
        let service = DefaultVerificationService::with_repository(repo.clone());

        service.start_verification("p-mock".to_string()).await.unwrap();
        assert_eq!(
            repo.save_calls.load(std::sync::atomic::Ordering::SeqCst),
            1,
            "start_verification should persist through the repository"
        );

        let v = service.get_verification_status("p-mock".to_string()).await.unwrap();
        assert_eq!(v.participant_id, "p-mock");
    }

    #[tokio::test]
    async fn test_mock_repository_approve_flow() {
        let repo = std::sync::Arc::new(MockVerificationRepository::new());
        let service = DefaultVerificationService::with_repository(repo.clone());

        service.start_verification("p-mock-approve".to_string()).await.unwrap();
        service
            .approve_participant("p-mock-approve".to_string(), "reviewer".to_string())
            .await
            .unwrap();

        let v = service
            .get_verification_status("p-mock-approve".to_string())
            .await
            .unwrap();
        assert!(matches!(v.status, VerificationStatus::Approved));
        assert_eq!(v.reviewed_by.as_deref(), Some("reviewer"));
    }

    #[tokio::test]
    async fn test_mock_repository_unknown_participant_errors() {
        let repo = std::sync::Arc::new(MockVerificationRepository::new());
        let service = DefaultVerificationService::with_repository(repo);

        assert!(service
            .approve_participant("ghost".to_string(), "reviewer".to_string())
            .await
            .is_err());
        assert!(service
            .submit_document("ghost".to_string(), "passport".to_string(), "url".to_string())
            .await
            .is_err());
        assert!(service.retry_verification("ghost".to_string()).await.is_err());
    }

    #[tokio::test]
    async fn test_mock_repository_verify_document() {
        let repo = std::sync::Arc::new(MockVerificationRepository::new());
        let service = DefaultVerificationService::with_repository(repo);

        service.start_verification("p-mock-doc".to_string()).await.unwrap();
        let doc = service
            .submit_document(
                "p-mock-doc".to_string(),
                "passport".to_string(),
                "http://example.com/doc".to_string(),
            )
            .await
            .unwrap();

        let verified = service.verify_document(doc.id.clone()).await.unwrap();
        assert!(verified.verified);
        assert!(service.verify_document("missing-doc".to_string()).await.is_err());
    }

    /// `get_pending_reviews` returns only Pending / UnderReview verifications.
    #[tokio::test]
    async fn test_get_pending_reviews_excludes_approved() {
        let service = DefaultVerificationService::new();

        // One pending participant
        service.start_verification("p-pending".to_string()).await.unwrap();

        // One approved participant (should not appear in pending reviews)
        service.start_verification("p-done".to_string()).await.unwrap();
        service
            .approve_participant("p-done".to_string(), "reviewer-3".to_string())
            .await
            .unwrap();

        let pending = service.get_pending_reviews().await.unwrap();
        let ids: Vec<&str> = pending.iter().map(|v| v.participant_id.as_str()).collect();

        assert!(ids.contains(&"p-pending"), "pending participant should appear");
        assert!(
            !ids.contains(&"p-done"),
            "approved participant must not appear in pending reviews"
        );
    }
}
