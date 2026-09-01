use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use async_trait::async_trait;

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
    async fn submit_checklist(&self, participant_id: String, checks: HashMap<String, bool>) -> Result<VerificationChecklist, String>;
    async fn create_review_queue_item(&self, participant_id: String) -> Result<String, String>;
    async fn approve_participant(&self, participant_id: String, reviewer_id: String) -> Result<(), String>;
    async fn reject_participant(&self, participant_id: String, reason: String, reviewer_id: String) -> Result<(), String>;
    async fn get_pending_reviews(&self) -> Result<Vec<ParticipantVerification>, String>;
    async fn retry_verification(&self, participant_id: String) -> Result<ParticipantVerification, String>;
    async fn send_approval_notification(&self, participant_id: String) -> Result<(), String>;
    async fn send_rejection_notification(&self, participant_id: String, reason: String) -> Result<(), String>;
}

pub struct DefaultVerificationService {
    verifications: std::sync::Arc<tokio::sync::Mutex<HashMap<String, ParticipantVerification>>>,
    rules: Vec<VerificationRule>,
}

impl DefaultVerificationService {
    pub fn new() -> Self {
        Self {
            verifications: std::sync::Arc::new(tokio::sync::Mutex::new(HashMap::new())),
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

        let mut verifications = self.verifications.lock().await;
        verifications.insert(participant_id, verification.clone());
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

        let mut verifications = self.verifications.lock().await;
        if let Some(verification) = verifications.get_mut(&participant_id) {
            verification.documents.push(doc.clone());
            Ok(doc)
        } else {
            Err("Verification not found".to_string())
        }
    }

    async fn verify_document(&self, doc_id: String) -> Result<Document, String> {
        let mut verifications = self.verifications.lock().await;
        for verification in verifications.values_mut() {
            if let Some(doc) = verification.documents.iter_mut().find(|d| d.id == doc_id) {
                doc.verified = true;
                doc.verification_notes = Some("Document verified".to_string());
                return Ok(doc.clone());
            }
        }
        Err("Document not found".to_string())
    }

    async fn get_verification_status(&self, participant_id: String) -> Result<ParticipantVerification, String> {
        let verifications = self.verifications.lock().await;
        verifications
            .get(&participant_id)
            .cloned()
            .ok_or_else(|| "Verification not found".to_string())
    }

    async fn submit_checklist(&self, participant_id: String, checks: HashMap<String, bool>) -> Result<VerificationChecklist, String> {
        let mut verifications = self.verifications.lock().await;
        if let Some(verification) = verifications.get_mut(&participant_id) {
            verification.checklist.checks = checks;
            verification.checklist.completed_at = Some(Utc::now());
            Ok(verification.checklist.clone())
        } else {
            Err("Verification not found".to_string())
        }
    }

    async fn create_review_queue_item(&self, participant_id: String) -> Result<String, String> {
        let mut verifications = self.verifications.lock().await;
        if let Some(verification) = verifications.get_mut(&participant_id) {
            verification.status = VerificationStatus::UnderReview;
            Ok(uuid::Uuid::new_v4().to_string())
        } else {
            Err("Verification not found".to_string())
        }
    }

    async fn approve_participant(&self, participant_id: String, reviewer_id: String) -> Result<(), String> {
        let mut verifications = self.verifications.lock().await;
        if let Some(verification) = verifications.get_mut(&participant_id) {
            verification.status = VerificationStatus::Approved;
            verification.reviewed_at = Some(Utc::now());
            verification.reviewed_by = Some(reviewer_id);
            Ok(())
        } else {
            Err("Verification not found".to_string())
        }
    }

    async fn reject_participant(&self, participant_id: String, reason: String, reviewer_id: String) -> Result<(), String> {
        let mut verifications = self.verifications.lock().await;
        if let Some(verification) = verifications.get_mut(&participant_id) {
            verification.status = VerificationStatus::Rejected;
            verification.notes = Some(reason);
            verification.reviewed_at = Some(Utc::now());
            verification.reviewed_by = Some(reviewer_id);
            Ok(())
        } else {
            Err("Verification not found".to_string())
        }
    }

    async fn get_pending_reviews(&self) -> Result<Vec<ParticipantVerification>, String> {
        let verifications = self.verifications.lock().await;
        let pending: Vec<_> = verifications
            .values()
            .filter(|v| matches!(v.status, VerificationStatus::UnderReview | VerificationStatus::Pending))
            .cloned()
            .collect();
        Ok(pending)
    }

    async fn retry_verification(&self, participant_id: String) -> Result<ParticipantVerification, String> {
        let mut verifications = self.verifications.lock().await;
        if let Some(verification) = verifications.get_mut(&participant_id) {
            verification.status = VerificationStatus::Pending;
            verification.retry_count += 1;
            verification.last_retry_at = Some(Utc::now());
            Ok(verification.clone())
        } else {
            Err("Verification not found".to_string())
        }
    }

    async fn send_approval_notification(&self, participant_id: String) -> Result<(), String> {
        // Integration point for notification service
        tracing::info!("Sending approval notification for participant: {}", participant_id);
        Ok(())
    }

    async fn send_rejection_notification(&self, participant_id: String, reason: String) -> Result<(), String> {
        // Integration point for notification service
        tracing::info!("Sending rejection notification for participant: {} - reason: {}", participant_id, reason);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
        service.start_verification("test-participant".to_string()).await.unwrap();

        let doc = service
            .submit_document("test-participant".to_string(), "passport".to_string(), "http://example.com/doc".to_string())
            .await
            .unwrap();

        assert!(!doc.verified);

        let verified_doc = service.verify_document(doc.id.clone()).await.unwrap();
        assert!(verified_doc.verified);
    }
}
