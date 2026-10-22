use super::*;

// ============ RBAC Types (#704) ============

/// Granular permission types for contract functions.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PermissionType {
    /// Can verify and grade waste
    Verifier = 0,
    /// Can read audit logs and access reports
    Auditor = 1,
    /// Can manage participants and config (sub-admin)
    Admin = 2,
    /// Can create and update incentives on behalf of others
    IncentiveManager = 3,
}

impl PermissionType {
    /// Convert from u32, returning None for unknown variants.
    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(PermissionType::Verifier),
            1 => Some(PermissionType::Auditor),
            2 => Some(PermissionType::Admin),
            3 => Some(PermissionType::IncentiveManager),
            _ => None,
        }
    }
}

/// A single entry in the permission audit trail.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PermissionAuditEntry {
    /// Address whose permission changed
    pub subject: Address,
    /// The permission type
    pub permission: PermissionType,
    /// true = granted, false = revoked
    pub granted: bool,
    /// Who performed the change (admin)
    pub changed_by: Address,
    /// Ledger timestamp of the change
    pub timestamp: u64,
}
