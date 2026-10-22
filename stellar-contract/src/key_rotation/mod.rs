//! Key rotation and lifecycle management (issue #1515).
//!
//! This module handles cryptographic key management for the Scavenger contract,
//! including:
//! - **Installation** of initial keys per purpose
//! - **Rotation** to new key versions with automatic archival of old versions
//! - **Revocation** of compromised keys
//! - **Purging** of archived keys to reclaim storage
//! - **Lookup** of active and historical key versions
//!
//! # Design
//!
//! The module is split by responsibility for maintainability and security review:
//!
//! - **`auth`** (~80 LOC): Centralized authorization check. Every mutating
//!   operation calls `authorize()` before modifying storage, ensuring a single
//!   point for admin validation.
//!
//! - **`types`** (~130 LOC): Shared types (`KeyPurpose`, `KeyStatus`,
//!   `KeyRecord`, `KeyRotationError`, `KeyStorage`). Part of the contract's
//!   public API.
//!
//! - **`schedule`** (~150 LOC): Read-only operations (`get_active_key`,
//!   `get_key_version`, `active_version`). No authorization required.
//!
//! - **`lifecycle`** (~340 LOC): Mutating operations (`install_key`, `rotate_key`,
//!   `revoke_key_version`, `purge_key_version`). All call `auth::authorize()`.
//!
//! # Examples
//!
//! ```ignore
//! // Install the first key for webhook signing
//! let version = lifecycle::install_key(
//!     &env,
//!     &admin,
//!     &contract.get_admins()?,
//!     KeyPurpose::WebhookSigning,
//!     key_hash,
//! )?;
//!
//! // Later, rotate to a new key
//! let new_version = lifecycle::rotate_key(
//!     &env,
//!     &admin,
//!     &contract.get_admins()?,
//!     KeyPurpose::WebhookSigning,
//!     new_key_hash,
//! )?;
//!
//! // Look up the active key
//! let active = schedule::get_active_key(&env, KeyPurpose::WebhookSigning)?;
//! println!("Active key v{}: {:?}", active.version, active.key_hash);
//! ```
//!
//! # Storage
//!
//! Keys are stored under two slot types:
//! - `KeyStorage::Key(purpose, version)` → `KeyRecord`
//! - `KeyStorage::Active(purpose)` → `u32` (current version)
//!
//! # Authorization
//!
//! All mutating operations require the caller to be in the admin list, checked
//! against `current_admins` passed by the caller. This ensures the contract
//! enforces up-to-date authorization even if the admin list changed between
//! calls.

pub mod auth;
pub mod lifecycle;
pub mod schedule;
pub mod types;

// Re-export public API for ergonomics
pub use types::{KeyPurpose, KeyRecord, KeyRotationError, KeyStatus};

// Module visibility for tests
#[cfg(test)]
mod integration_tests {
    use crate::key_rotation::*;
    use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, Vec};

    fn make_hash(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn setup(env: &Env) -> (Address, Vec<Address>) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let admins = Vec::from_array(env, [admin.clone()]);
        (admin, admins)
    }

    /// Integration test: Install two keys for different purposes, rotate one,
    /// then verify both can coexist independently.
    #[test]
    fn install_rotate_multiple_purposes_independently() {
        let env = Env::default();
        let (admin, admins) = setup(&env);

        // Install for purpose A
        let v1_a = lifecycle::install_key(
            &env,
            &admin,
            &admins,
            KeyPurpose::ApiKeyHash,
            make_hash(&env, 0xAA),
        )
        .unwrap();
        assert_eq!(v1_a, 1);

        // Install for purpose B
        let v1_b = lifecycle::install_key(
            &env,
            &admin,
            &admins,
            KeyPurpose::WebhookSigning,
            make_hash(&env, 0xBB),
        )
        .unwrap();
        assert_eq!(v1_b, 1);

        // Rotate only purpose A
        let v2_a = lifecycle::rotate_key(
            &env,
            &admin,
            &admins,
            KeyPurpose::ApiKeyHash,
            make_hash(&env, 0xCC),
        )
        .unwrap();
        assert_eq!(v2_a, 2);

        // Verify purpose A is now v2
        let active_a = schedule::get_active_key(&env, KeyPurpose::ApiKeyHash).unwrap();
        assert_eq!(active_a.version, 2);

        // Verify purpose B is still v1
        let active_b = schedule::get_active_key(&env, KeyPurpose::WebhookSigning).unwrap();
        assert_eq!(active_b.version, 1);
    }

    /// Integration test: Full lifecycle including revocation.
    #[test]
    fn full_lifecycle_install_rotate_revoke_purge() {
        let env = Env::default();
        let (admin, admins) = setup(&env);

        // Install v1
        lifecycle::install_key(
            &env,
            &admin,
            &admins,
            KeyPurpose::PiiEncryption,
            make_hash(&env, 1),
        )
        .unwrap();

        // Rotate to v2
        lifecycle::rotate_key(
            &env,
            &admin,
            &admins,
            KeyPurpose::PiiEncryption,
            make_hash(&env, 2),
        )
        .unwrap();

        // Rotate to v3
        lifecycle::rotate_key(
            &env,
            &admin,
            &admins,
            KeyPurpose::PiiEncryption,
            make_hash(&env, 3),
        )
        .unwrap();

        // Current should be v3
        assert_eq!(schedule::active_version(&env, KeyPurpose::PiiEncryption), Some(3));

        // Revoke v2 (archived, not active)
        lifecycle::revoke_key_version(&env, &admin, &admins, KeyPurpose::PiiEncryption, 2).unwrap();
        let v2_revoked = schedule::get_key_version(&env, KeyPurpose::PiiEncryption, 2).unwrap();
        assert_eq!(v2_revoked.status, KeyStatus::Revoked);

        // Purge v1 (archived, not active)
        lifecycle::purge_key_version(&env, &admin, &admins, KeyPurpose::PiiEncryption, 1).unwrap();
        assert_eq!(
            schedule::get_key_version(&env, KeyPurpose::PiiEncryption, 1),
            Err(KeyRotationError::VersionNotFound)
        );

        // v2 still accessible (revoked but not purged)
        assert!(schedule::get_key_version(&env, KeyPurpose::PiiEncryption, 2).is_ok());

        // v3 still active
        let active = schedule::get_active_key(&env, KeyPurpose::PiiEncryption).unwrap();
        assert_eq!(active.version, 3);
        assert_eq!(active.status, KeyStatus::Active);
    }

    /// Integration test: Authorization is enforced across all operations.
    #[test]
    fn authorization_enforced_consistently() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        let attacker = Address::generate(&env);

        // Attacker cannot install
        assert_eq!(
            lifecycle::install_key(
                &env,
                &attacker,
                &admins,
                KeyPurpose::ZkpVerification,
                make_hash(&env, 1)
            ),
            Err(KeyRotationError::Unauthorized)
        );

        // Admin installs
        lifecycle::install_key(
            &env,
            &admin,
            &admins,
            KeyPurpose::ZkpVerification,
            make_hash(&env, 1),
        )
        .unwrap();

        // Attacker cannot rotate
        assert_eq!(
            lifecycle::rotate_key(
                &env,
                &attacker,
                &admins,
                KeyPurpose::ZkpVerification,
                make_hash(&env, 2)
            ),
            Err(KeyRotationError::Unauthorized)
        );

        // Attacker cannot revoke
        assert_eq!(
            lifecycle::revoke_key_version(
                &env,
                &attacker,
                &admins,
                KeyPurpose::ZkpVerification,
                1
            ),
            Err(KeyRotationError::Unauthorized)
        );

        // Attacker cannot purge
        lifecycle::rotate_key(
            &env,
            &admin,
            &admins,
            KeyPurpose::ZkpVerification,
            make_hash(&env, 2),
        )
        .unwrap();
        assert_eq!(
            lifecycle::purge_key_version(
                &env,
                &attacker,
                &admins,
                KeyPurpose::ZkpVerification,
                1
            ),
            Err(KeyRotationError::Unauthorized)
        );
    }

    /// Integration test: Reading operations do not require authorization.
    #[test]
    fn read_operations_are_public() {
        let env = Env::default();
        let (admin, admins) = setup(&env);

        lifecycle::install_key(
            &env,
            &admin,
            &admins,
            KeyPurpose::ApiKeyHash,
            make_hash(&env, 0x42),
        )
        .unwrap();

        // Any caller can read
        let anyone = Address::generate(&env);
        let record = schedule::get_active_key(&env, KeyPurpose::ApiKeyHash).unwrap();
        assert_eq!(record.key_hash, make_hash(&env, 0x42));

        // Same with version lookup
        let v1 = schedule::get_key_version(&env, KeyPurpose::ApiKeyHash, 1).unwrap();
        assert_eq!(v1.version, 1);

        // And active_version
        assert_eq!(schedule::active_version(&env, KeyPurpose::ApiKeyHash), Some(1));
    }

    /// Integration test: Simultaneous rotations for different purposes are isolated.
    #[test]
    fn concurrent_rotation_isolation() {
        let env = Env::default();
        let (admin, admins) = setup(&env);

        // Set up three purposes at v1
        for purpose in [
            KeyPurpose::ApiKeyHash,
            KeyPurpose::WebhookSigning,
            KeyPurpose::PiiEncryption,
        ] {
            lifecycle::install_key(&env, &admin, &admins, purpose, make_hash(&env, 0x11)).unwrap();
        }

        // Rotate only the first one to v2
        lifecycle::rotate_key(
            &env,
            &admin,
            &admins,
            KeyPurpose::ApiKeyHash,
            make_hash(&env, 0x22),
        )
        .unwrap();

        // Verify versions
        assert_eq!(schedule::active_version(&env, KeyPurpose::ApiKeyHash), Some(2));
        assert_eq!(schedule::active_version(&env, KeyPurpose::WebhookSigning), Some(1));
        assert_eq!(schedule::active_version(&env, KeyPurpose::PiiEncryption), Some(1));

        // Rotate the second one to v2
        lifecycle::rotate_key(
            &env,
            &admin,
            &admins,
            KeyPurpose::WebhookSigning,
            make_hash(&env, 0x33),
        )
        .unwrap();

        // Verify again
        assert_eq!(schedule::active_version(&env, KeyPurpose::ApiKeyHash), Some(2));
        assert_eq!(schedule::active_version(&env, KeyPurpose::WebhookSigning), Some(2));
        assert_eq!(schedule::active_version(&env, KeyPurpose::PiiEncryption), Some(1));
    }
}
