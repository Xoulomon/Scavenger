use super::*;

/// Represents a period for compliance reporting
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReportPeriod {
    pub start_timestamp: u64,
    pub end_timestamp: u64,
}

/// Status of regulatory validation
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ComplianceStatus {
    Pending = 0,
    Compliant = 1,
    NonCompliant = 2,
    Exempt = 3,
}

/// Regulatory requirement validation result
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RegulatoryValidation {
    pub requirement_id: String,
    pub status: ComplianceStatus,
    pub notes: String,
}

/// Represents a compliance report for environmental regulations
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ComplianceReport {
    pub id: u64,
    pub period: ReportPeriod,
    pub total_waste_tracked: u128,
    pub waste_by_type: soroban_sdk::Vec<(WasteType, u128)>,
    pub total_carbon_credits: u128,
    pub validations: soroban_sdk::Vec<RegulatoryValidation>,
    pub generated_at: u64,
    pub version: u32,
    pub is_finalized: bool,
}
