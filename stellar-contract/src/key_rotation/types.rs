//! Type definitions for key rotation system (issue #1515).
//!
//! Core types used throughout the key rotation subsystem:
//! - KeyPurpose: distinguishes key slots
//! - KeyStatus: lifecycle status of a key version
//! - KeyRecord: on-chain record for a single key version
//! - KeyStorage: storage key enumeration
//! - KeyRotationError: error types for this subsystem

use soroban_sdk::{contracttype, Address, BytesN};

/// Distinguishes which secret a key record belongs to.
///
/// Add new variants here when new key slots are needed.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum KeyPurpose {
    /// HMAC-SHA256 key used for off-chain webhook signatures.
    WebhookSigning = 0,
    /// Hash of the API key used for backend authentication.
    ApiKeyHash = 1,
    /// Public key used to verify off-chain ZKP proofs.
    ZkpVerification = 2,
    /// Encryption key hash for participant PII export.
    PiiEncryption = 3,
}

impl KeyPurpose {
    pub fn to_u32(self) -> u32 {
        self as u32
    }

    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            0 => Some(KeyPurpose::WebhookSigning),
            1 => Some(KeyPurpose::ApiKeyHash),
            2 => Some(KeyPurpose::ZkpVerification),
            3 => Some(KeyPurpose::PiiEncryption),
            _ => None,
        }
    }

    /// Human-readable label, used in emitted events.
    pub fn label(&self) -> &'static str {
        match self {
            KeyPurpose::WebhookSigning => "WEBHOOK_SIGNING",
            KeyPurpose::ApiKeyHash => "API_KEY_HASH",
            KeyPurpose::ZkpVerification => "ZKP_VERIFICATION",
            KeyPurpose::PiiEncryption => "PII_ENCRYPTION",
        }
    }
}

/// Lifecycle status of a stored key version.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum KeyStatus {
    /// This version is the current active key.
    Active = 0,
    /// This version has been superseded and is kept for auditing only.
    Archived = 1,
    /// This version has been revoked and must not be trusted.
    Revoked = 2,
}

/// On-chain record for a single key version.
///
/// The actual secret is **never** stored on-chain. Only its SHA-256 hash is
/// stored, enabling integrity verification without revealing the secret.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct KeyRecord {
    /// Which slot this key belongs to.
    pub purpose: KeyPurpose,
    /// Monotonic version counter (starts at 1, increments on each rotation).
    pub version: u32,
    /// SHA-256 hash of the actual secret key material.
    pub key_hash: BytesN<32>,
    /// Address of the admin who installed this key version.
    pub installed_by: Address,
    /// Ledger timestamp when this version was installed.
    pub installed_at: u64,
    /// Ledger timestamp when this version was superseded (0 if still active).
    pub archived_at: u64,
    /// Current lifecycle status.
    pub status: KeyStatus,
}

/// Storage key type for the key rotation system.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum KeyStorage {
    /// Maps `purpose → current version number`.
    Active(KeyPurpose),
    /// Maps `(purpose, version) → KeyRecord`.
    Key(KeyPurpose, u32),
}

/// Errors from the key rotation subsystem.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum KeyRotationError {
    /// No key has been installed for this purpose yet.
    NoActiveKey = 1,
    /// The requested (purpose, version) pair does not exist.
    VersionNotFound = 2,
    /// Only the contract admin may rotate or revoke keys.
    Unauthorized = 3,
    /// Cannot purge the currently active key version.
    CannotPurgeActive = 4,
    /// The supplied key hash is all-zeros (likely an accident).
    ZeroKeyHash = 5,
    /// A key already exists for this purpose — use `rotate_key` instead.
    AlreadyExists = 6,
    /// The version counter would overflow `u32`.
    Overflow = 7,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn key_purpose_labels_are_non_empty() {
        assert!(!KeyPurpose::WebhookSigning.label().is_empty());
        assert!(!KeyPurpose::ApiKeyHash.label().is_empty());
        assert!(!KeyPurpose::ZkpVerification.label().is_empty());
        assert!(!KeyPurpose::PiiEncryption.label().is_empty());
    }

    #[test]
    fn key_purpose_roundtrip() {
        for i in 0u32..4 {
            let p = KeyPurpose::from_u32(i).unwrap();
            assert_eq!(p.to_u32(), i);
        }
        assert!(KeyPurpose::from_u32(99).is_none());
    }
}
