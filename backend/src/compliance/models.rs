//! Domain models for compliance

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComplianceCheck {
    pub id: String,
    pub amount: i64,
    pub status: ComplianceStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ComplianceStatus {
    Pending,
    Approved,
    Rejected,
    Failed,
}

#[derive(Debug, thiserror::Error)]
pub enum ComplianceError {
    #[error("Invalid amount: {0}")]
    InvalidAmount(String),
    #[error("Compliance check failed: {0}")]
    CheckFailed(String),
    #[error("Validation error: {0}")]
    ValidationError(String),
}
