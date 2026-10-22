//! Compliance business logic service

use super::models::*;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct ComplianceService;

impl ComplianceService {
    pub fn new() -> Self {
        Self
    }

    /// Main compliance check logic - MOVED FROM compliance_api.rs
    pub async fn check_compliance(&self, request: CheckRequest) -> Result<ComplianceResult, ComplianceError> {
        // All business logic moved here from compliance_api.rs
        self.validate_request(&request)?;

        // Simulate compliance processing
        let result = self.process_compliance(request).await?;

        Ok(result)
    }

    fn validate_request(&self, request: &CheckRequest) -> Result<(), ComplianceError> {
        // Validation logic moved from compliance_api.rs
        if request.amount <= 0 {
            return Err(ComplianceError::InvalidAmount(
                "Amount must be greater than zero".to_string()
            ));
        }

        if request.user_id.is_empty() {
            return Err(ComplianceError::ValidationError(
                "User ID cannot be empty".to_string()
            ));
        }

        Ok(())
    }

    async fn process_compliance(&self, request: CheckRequest) -> Result<ComplianceResult, ComplianceError> {
        // Core business logic moved from compliance_api.rs
        // This is where the actual compliance calculation happens

        // Simulate processing time
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

        // Business logic: determine compliance status based on amount
        let status = if request.amount > 10000 {
            ComplianceStatus::Pending  // Large amounts need review
        } else {
            ComplianceStatus::Approved // Small amounts auto-approved
        };

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Ok(ComplianceResult {
            id: format!("comp_{}_{}", timestamp, request.user_id),
            status,
            details: format!("Compliance check completed for amount {}", request.amount),
            timestamp,
        })
    }

    pub async fn get_status(&self, id: String) -> Result<ComplianceStatus, ComplianceError> {
        // Business logic to retrieve status - moved from compliance_api.rs
        // Simulate database lookup
        Ok(ComplianceStatus::Approved)
    }
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct CheckRequest {
    pub amount: i64,
    pub user_id: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct ComplianceResult {
    pub id: String,
    pub status: ComplianceStatus,
    pub details: String,
    pub timestamp: u64,
}
