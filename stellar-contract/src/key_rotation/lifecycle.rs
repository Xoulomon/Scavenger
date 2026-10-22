//! Key lifecycle operations: install, rotate, revoke, purge (issue #1515).
//!
//! This module handles all mutating operations on key versions:
//! - Installing the first key for a purpose
//! - Rotating to a new key version
//! - Revoking a compromised key
//! - Purging archived keys to reclaim storage
//!
//! All operations use centralized authorization from `auth.rs`.

use crate::key_rotation::auth;
use crate::key_rotation::schedule;
use crate::key_rotation::types::*;
use soroban_sdk::{symbol_short, Address, BytesN, Env, Vec};

/// Installs the first key for a given `purpose`.
///
/// Returns `Err(KeyRotationError::AlreadyExists)` if a key for this purpose
/// already exists — use `rotate_key` instead.
///
/// `current_admins` must be the caller's authoritative, up-to-date admin list
/// (e.g. `ScavengerContract::get_admins`); `admin` is checked against it.
pub fn install_key(
    env: &Env,
    admin: &Address,
    current_admins: &Vec<Address>,
    purpose: KeyPurpose,
    key_hash: BytesN<32>,
) -> Result<u32, KeyRotationError> {
    auth::authorize(admin, current_admins)?;
    reject_zero_hash(&key_hash)?;

    let active_key_slot = KeyStorage::Active(purpose);
    if env.storage().instance().has::<KeyStorage>(&active_key_slot) {
        return Err(KeyRotationError::AlreadyExists);
    }

    let version = 1u32;
    let record = KeyRecord {
        purpose,
        version,
        key_hash,
        installed_by: admin.clone(),
        installed_at: env.ledger().timestamp(),
        archived_at: 0,
        status: KeyStatus::Active,
    };

    env.storage()
        .instance()
        .set::<KeyStorage, KeyRecord>(&KeyStorage::Key(purpose, version), &record);
    env.storage()
        .instance()
        .set::<KeyStorage, u32>(&active_key_slot, &version);

    emit_key_event(env, "key_ins", purpose, version, admin);
    Ok(version)
}

/// Rotates the active key for `purpose`.
///
/// The current active version is archived, and `new_key_hash` is stored as
/// `version = old + 1`. Returns the new version number.
///
/// `current_admins` must be the caller's authoritative, up-to-date admin list;
/// `admin` is checked against it. All validation (authorization, zero-hash,
/// existing-key lookups) happens before any storage write, so a rejected call
/// never leaves the old key partially archived.
pub fn rotate_key(
    env: &Env,
    admin: &Address,
    current_admins: &Vec<Address>,
    purpose: KeyPurpose,
    new_key_hash: BytesN<32>,
) -> Result<u32, KeyRotationError> {
    auth::authorize(admin, current_admins)?;
    reject_zero_hash(&new_key_hash)?;

    // Fetch current active version
    let active_slot = KeyStorage::Active(purpose);
    let old_version = env
        .storage()
        .instance()
        .get::<KeyStorage, u32>(&active_slot)
        .ok_or(KeyRotationError::NoActiveKey)?;

    // Compute the new version before mutating storage. Rotation is rejected
    // rather than wrapping if the counter is exhausted; the old key stays
    // active and unchanged.
    let new_version = old_version.checked_add(1).ok_or(KeyRotationError::Overflow)?;

    // Archive old record
    let old_key_slot = KeyStorage::Key(purpose, old_version);
    let mut old_record = env
        .storage()
        .instance()
        .get::<KeyStorage, KeyRecord>(&old_key_slot)
        .ok_or(KeyRotationError::VersionNotFound)?;
    old_record.status = KeyStatus::Archived;
    old_record.archived_at = env.ledger().timestamp();
    env.storage()
        .instance()
        .set::<KeyStorage, KeyRecord>(&old_key_slot, &old_record);
    let new_record = KeyRecord {
        purpose,
        version: new_version,
        key_hash: new_key_hash,
        installed_by: admin.clone(),
        installed_at: env.ledger().timestamp(),
        archived_at: 0,
        status: KeyStatus::Active,
    };
    env.storage()
        .instance()
        .set::<KeyStorage, KeyRecord>(&KeyStorage::Key(purpose, new_version), &new_record);
    env.storage()
        .instance()
        .set::<KeyStorage, u32>(&active_slot, &new_version);

    emit_key_event(env, "key_rot", purpose, new_version, admin);
    Ok(new_version)
}

/// Revokes a specific version (marks it `Revoked`).
///
/// Revoked keys are not returned by `get_active_key` and signal that the key
/// material was compromised. `current_admins` must be the caller's
/// authoritative, up-to-date admin list; `admin` is checked against it.
pub fn revoke_key_version(
    env: &Env,
    admin: &Address,
    current_admins: &Vec<Address>,
    purpose: KeyPurpose,
    version: u32,
) -> Result<(), KeyRotationError> {
    auth::authorize(admin, current_admins)?;
    let slot = KeyStorage::Key(purpose, version);
    let mut record = env
        .storage()
        .instance()
        .get::<KeyStorage, KeyRecord>(&slot)
        .ok_or(KeyRotationError::VersionNotFound)?;

    record.status = KeyStatus::Revoked;
    record.archived_at = env.ledger().timestamp();
    env.storage().instance().set::<KeyStorage, KeyRecord>(&slot, &record);

    emit_key_event(env, "key_rev", purpose, version, admin);
    Ok(())
}

/// Purges an archived key version from storage, recovering the storage rent.
///
/// Cannot purge the currently active version. `current_admins` must be the
/// caller's authoritative, up-to-date admin list; `admin` is checked against
/// it.
pub fn purge_key_version(
    env: &Env,
    admin: &Address,
    current_admins: &Vec<Address>,
    purpose: KeyPurpose,
    version: u32,
) -> Result<(), KeyRotationError> {
    auth::authorize(admin, current_admins)?;
    // Prevent purging the active version
    if let Some(active) = schedule::active_version(env, purpose) {
        if active == version {
            return Err(KeyRotationError::CannotPurgeActive);
        }
    }
    let slot = KeyStorage::Key(purpose, version);
    if !env.storage().instance().has::<KeyStorage>(&slot) {
        return Err(KeyRotationError::VersionNotFound);
    }
    env.storage().instance().remove::<KeyStorage>(&slot);
    emit_key_event(env, "key_prg", purpose, version, admin);
    Ok(())
}

// ─── Internal helpers ─────────────────────────────────────────────────────

/// Rejects an all-zeros key hash (common mistake when initializing with a
/// zero-value placeholder).
fn reject_zero_hash(hash: &BytesN<32>) -> Result<(), KeyRotationError> {
    let arr = hash.to_array();
    if arr.iter().all(|&b| b == 0) {
        return Err(KeyRotationError::ZeroKeyHash);
    }
    Ok(())
}

/// Emits a key management event.
fn emit_key_event(env: &Env, action: &str, purpose: KeyPurpose, version: u32, actor: &Address) {
    let sym = match action {
        "key_ins" => symbol_short!("key_ins"),
        "key_rot" => symbol_short!("key_rot"),
        "key_rev" => symbol_short!("key_rev"),
        "key_prg" => symbol_short!("key_prg"),
        _ => symbol_short!("key_evt"),
    };
    env.events().publish((sym, actor), (purpose.to_u32(), version));
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn make_hash(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn zero_hash(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[0u8; 32])
    }

    fn setup(env: &Env) -> (Address, Vec<Address>) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let admins = Vec::from_array(env, [admin.clone()]);
        (admin, admins)
    }

    // ── install_key tests ─────────────────────────────────────────────────────

    #[test]
    fn install_key_creates_version_1() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        let hash = make_hash(&env, 0xAA);
        let version = install_key(&env, &admin, &admins, KeyPurpose::WebhookSigning, hash.clone()).unwrap();
        assert_eq!(version, 1);
        let record = schedule::get_active_key(&env, KeyPurpose::WebhookSigning).unwrap();
        assert_eq!(record.key_hash, hash);
        assert_eq!(record.status, KeyStatus::Active);
        assert_eq!(record.version, 1);
    }

    #[test]
    fn install_key_rejects_zero_hash() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        assert_eq!(
            install_key(&env, &admin, &admins, KeyPurpose::WebhookSigning, zero_hash(&env)),
            Err(KeyRotationError::ZeroKeyHash)
        );
    }

    #[test]
    fn install_key_twice_fails_instead_of_panicking() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::WebhookSigning, make_hash(&env, 1)).unwrap();
        assert_eq!(
            install_key(&env, &admin, &admins, KeyPurpose::WebhookSigning, make_hash(&env, 2)),
            Err(KeyRotationError::AlreadyExists)
        );
    }

    #[test]
    fn install_key_rejects_non_admin_caller() {
        let env = Env::default();
        let (_admin, admins) = setup(&env);
        let attacker = Address::generate(&env);
        assert_eq!(
            install_key(&env, &attacker, &admins, KeyPurpose::WebhookSigning, make_hash(&env, 1)),
            Err(KeyRotationError::Unauthorized)
        );
        assert_eq!(schedule::active_version(&env, KeyPurpose::WebhookSigning), None);
    }

    // ── rotate_key tests ──────────────────────────────────────────────────────

    #[test]
    fn rotate_key_increments_version() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 0x01)).unwrap();
        let v2 = rotate_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 0x02)).unwrap();
        assert_eq!(v2, 2);
        let active = schedule::get_active_key(&env, KeyPurpose::ApiKeyHash).unwrap();
        assert_eq!(active.version, 2);
        assert_eq!(active.key_hash, make_hash(&env, 0x02));
    }

    #[test]
    fn rotate_key_archives_previous_version() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 0x01)).unwrap();
        rotate_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 0x02)).unwrap();
        let old = schedule::get_key_version(&env, KeyPurpose::ApiKeyHash, 1).unwrap();
        assert_eq!(old.status, KeyStatus::Archived);
        assert_ne!(old.archived_at, 0);
    }

    #[test]
    fn rotate_without_existing_key_fails() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        assert_eq!(
            rotate_key(&env, &admin, &admins, KeyPurpose::PiiEncryption, make_hash(&env, 0x10)),
            Err(KeyRotationError::NoActiveKey)
        );
    }

    #[test]
    fn multiple_rotations_track_history() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ZkpVerification, make_hash(&env, 1)).unwrap();
        rotate_key(&env, &admin, &admins, KeyPurpose::ZkpVerification, make_hash(&env, 2)).unwrap();
        rotate_key(&env, &admin, &admins, KeyPurpose::ZkpVerification, make_hash(&env, 3)).unwrap();

        assert_eq!(schedule::active_version(&env, KeyPurpose::ZkpVerification), Some(3));

        let v1 = schedule::get_key_version(&env, KeyPurpose::ZkpVerification, 1).unwrap();
        let v2 = schedule::get_key_version(&env, KeyPurpose::ZkpVerification, 2).unwrap();
        let v3 = schedule::get_key_version(&env, KeyPurpose::ZkpVerification, 3).unwrap();

        assert_eq!(v1.status, KeyStatus::Archived);
        assert_eq!(v2.status, KeyStatus::Archived);
        assert_eq!(v3.status, KeyStatus::Active);
    }

    #[test]
    fn rotate_key_failure_leaves_old_key_untouched() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 1)).unwrap();

        assert_eq!(
            rotate_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, zero_hash(&env)),
            Err(KeyRotationError::ZeroKeyHash)
        );

        let still_active = schedule::get_active_key(&env, KeyPurpose::ApiKeyHash).unwrap();
        assert_eq!(still_active.version, 1);
        assert_eq!(still_active.status, KeyStatus::Active);
        assert_eq!(still_active.key_hash, make_hash(&env, 1));
        assert_eq!(
            schedule::get_key_version(&env, KeyPurpose::ApiKeyHash, 2),
            Err(KeyRotationError::VersionNotFound)
        );
    }

    // ── purge_key_version tests ───────────────────────────────────────────────

    #[test]
    fn purge_archived_version_removes_storage() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 1)).unwrap();
        rotate_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 2)).unwrap();
        purge_key_version(&env, &admin, &admins, KeyPurpose::ApiKeyHash, 1).unwrap();
        assert_eq!(
            schedule::get_key_version(&env, KeyPurpose::ApiKeyHash, 1),
            Err(KeyRotationError::VersionNotFound)
        );
    }

    #[test]
    fn purge_active_version_is_forbidden() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 1)).unwrap();
        assert_eq!(
            purge_key_version(&env, &admin, &admins, KeyPurpose::ApiKeyHash, 1),
            Err(KeyRotationError::CannotPurgeActive)
        );
    }

    // ── Edge cases: rotation during "pending transactions" ──────────────────────

    #[test]
    fn rotation_during_pending_verification_does_not_invalidate_archived_record_lookup() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 1)).unwrap();
        let pending_version = schedule::active_version(&env, KeyPurpose::ApiKeyHash).unwrap();

        rotate_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 2)).unwrap();

        let record = schedule::get_key_version(&env, KeyPurpose::ApiKeyHash, pending_version).unwrap();
        assert_eq!(record.status, KeyStatus::Archived);
        assert_eq!(record.key_hash, make_hash(&env, 1));
    }

    // ── Edge cases: invalid / expired key rotation attempts ──────────────────────

    #[test]
    fn rotate_key_rejects_version_overflow() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        let purpose = KeyPurpose::WebhookSigning;

        install_key(&env, &admin, &admins, purpose, make_hash(&env, 0x11)).unwrap();
        env.storage().instance().set(&KeyStorage::Active(purpose), &u32::MAX);

        assert_eq!(
            rotate_key(&env, &admin, &admins, purpose, make_hash(&env, 0x22)),
            Err(KeyRotationError::Overflow)
        );
        assert_eq!(schedule::active_version(&env, purpose), Some(u32::MAX));
    }
}
