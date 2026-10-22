//! Version tracking and lookup for active/archived keys (issue #1515).
//!
//! This module handles read-only operations on key versions:
//! - Looking up the currently active key
//! - Retrieving a specific version by ID
//! - Querying the current version number
//!
//! These operations do not require authorization (reads are public).

use crate::key_rotation::types::{KeyRecord, KeyRotationError, KeyStorage, KeyPurpose};
use soroban_sdk::Env;

/// Returns the active `KeyRecord` for `purpose`.
///
/// The active key is the one currently in use for validation/verification.
///
/// # Returns
/// - `Ok(KeyRecord)` if a key has been installed for this purpose
/// - `Err(KeyRotationError::NoActiveKey)` if no key exists yet
pub fn get_active_key(
    env: &Env,
    purpose: KeyPurpose,
) -> Result<KeyRecord, KeyRotationError> {
    let version = env
        .storage()
        .instance()
        .get::<KeyStorage, u32>(&KeyStorage::Active(purpose))
        .ok_or(KeyRotationError::NoActiveKey)?;
    get_key_version(env, purpose, version)
}

/// Returns a specific `KeyRecord` by version.
///
/// This allows access to archived/revoked versions for auditing purposes.
///
/// # Returns
/// - `Ok(KeyRecord)` if the (purpose, version) pair exists
/// - `Err(KeyRotationError::VersionNotFound)` if not found
pub fn get_key_version(
    env: &Env,
    purpose: KeyPurpose,
    version: u32,
) -> Result<KeyRecord, KeyRotationError> {
    env.storage()
        .instance()
        .get::<KeyStorage, KeyRecord>(&KeyStorage::Key(purpose, version))
        .ok_or(KeyRotationError::VersionNotFound)
}

/// Returns the current active version number, or `None` if no key is
/// installed for this purpose.
pub fn active_version(env: &Env, purpose: KeyPurpose) -> Option<u32> {
    env.storage()
        .instance()
        .get::<KeyStorage, u32>(&KeyStorage::Active(purpose))
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, BytesN, Env, Vec};

    fn make_hash(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn setup(env: &Env) -> (Address, Vec<Address>) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let admins = Vec::from_array(env, [admin.clone()]);
        (admin, admins)
    }

    /// Helper to install a key without importing the full lifecycle module
    fn install_key_for_test(
        env: &Env,
        purpose: KeyPurpose,
        key_hash: BytesN<32>,
    ) {
        let version = 1u32;
        let (admin, _) = setup(env);
        let record = KeyRecord {
            purpose,
            version,
            key_hash,
            installed_by: admin.clone(),
            installed_at: env.ledger().timestamp(),
            archived_at: 0,
            status: crate::key_rotation::types::KeyStatus::Active,
        };

        env.storage()
            .instance()
            .set::<KeyStorage, KeyRecord>(&KeyStorage::Key(purpose, version), &record);
        env.storage()
            .instance()
            .set::<KeyStorage, u32>(&KeyStorage::Active(purpose), &version);
    }

    #[test]
    fn get_active_key_returns_current_version() {
        let env = Env::default();
        let (_, _) = setup(&env);
        let hash = make_hash(&env, 0xAA);
        install_key_for_test(&env, KeyPurpose::WebhookSigning, hash.clone());

        let record = get_active_key(&env, KeyPurpose::WebhookSigning).unwrap();
        assert_eq!(record.version, 1);
        assert_eq!(record.key_hash, hash);
    }

    #[test]
    fn get_active_key_returns_not_found_when_no_key_installed() {
        let env = Env::default();
        assert_eq!(
            get_active_key(&env, KeyPurpose::PiiEncryption),
            Err(KeyRotationError::NoActiveKey)
        );
    }

    #[test]
    fn get_key_version_retrieves_specific_version() {
        let env = Env::default();
        let (_, _) = setup(&env);
        let hash = make_hash(&env, 0xBB);
        install_key_for_test(&env, KeyPurpose::ApiKeyHash, hash.clone());

        let record = get_key_version(&env, KeyPurpose::ApiKeyHash, 1).unwrap();
        assert_eq!(record.version, 1);
        assert_eq!(record.key_hash, hash);
    }

    #[test]
    fn get_key_version_returns_not_found_for_nonexistent() {
        let env = Env::default();
        assert_eq!(
            get_key_version(&env, KeyPurpose::ZkpVerification, 99),
            Err(KeyRotationError::VersionNotFound)
        );
    }

    #[test]
    fn active_version_returns_current_version() {
        let env = Env::default();
        let (_, _) = setup(&env);
        let hash = make_hash(&env, 0xCC);
        install_key_for_test(&env, KeyPurpose::ApiKeyHash, hash);

        assert_eq!(active_version(&env, KeyPurpose::ApiKeyHash), Some(1));
    }

    #[test]
    fn active_version_returns_none_before_install() {
        let env = Env::default();
        assert_eq!(active_version(&env, KeyPurpose::WebhookSigning), None);
    }

    #[test]
    fn active_version_returns_none_for_never_installed_purpose() {
        let env = Env::default();
        assert_eq!(active_version(&env, KeyPurpose::PiiEncryption), None);
    }
}
