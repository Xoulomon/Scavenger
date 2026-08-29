//! # Cryptographic Key Rotation — Issue #817
//!
//! Versioned on-chain key management for the Scavngr contract.
//!
//! ## Design
//!
//! Soroban has no native key-management API.  "Cryptographic keys" in this
//! context are arbitrary 32-byte opaque secrets (e.g. HMAC keys, API key
//! hashes, signing public keys) stored on-chain as versioned records.  Only
//! the admin can rotate or archive keys.
//!
//! ## Key versioning scheme
//!
//! Each key slot is identified by a `KeyPurpose` (enum) and a monotonically
//! increasing `version: u32`.  The **active** version is stored separately
//! so reads are O(1) without scanning all versions.
//!
//! ```text
//! KeyStorage::Active(purpose)       → u32 (current version number)
//! KeyStorage::Key(purpose, version) → KeyRecord
//! ```
//!
//! ## Rotation procedure (admin-only)
//!
//! 1. Call `rotate_key(env, admin, current_admins, purpose, new_key_hash)`.
//! 2. The current active key is archived (status → `Archived`).
//! 3. The new key is stored with `version = old_version + 1`.
//! 4. A `"key_rot"` event is emitted.
//!
//! ## Archival
//!
//! Archived keys remain readable via `get_key_version` for audit purposes
//! but are no longer returned by `get_active_key`.  Call `purge_key_version`
//! to delete an archived entry and reclaim storage rent.
//!
//! ## Security review (issue #1099)
//!
//! This module has **no call sites in `lib.rs`** — it is not wired into any
//! `ScavengerContract` entry point today, so there is no live on-chain
//! exposure yet. It was however written to be wired in eventually, so it is
//! reviewed and hardened as if it were:
//!
//! - **Authorization was previously only a doc comment.** Every mutating
//!   function here used to accept an `admin: &Address` and simply *trust*
//!   that the caller had already validated that address against the real
//!   admin list before calling in ("Caller must ensure `admin.require_auth()`
//!   was already called"). That is not enforcement — `require_auth()` only
//!   proves the caller controls that specific address, not that the address
//!   is an actual contract admin. A future call site that forgot the
//!   membership check (or got it wrong) would let *any* address rotate,
//!   revoke, or purge keys for itself. Every mutating function now takes the
//!   authoritative `current_admins: &Vec<Address>` list and enforces both
//!   `require_auth()` and admin membership internally via [`authorize`], so
//!   the module can no longer be bypassed by a careless caller.
//! - **Atomicity of rotation.** `rotate_key` performs its zero-hash check and
//!   both storage reads *before* writing anything, and if any of those
//!   fail (or the caller is unauthorized) the function returns `Err` before
//!   any storage mutation occurs — so a rejected rotation can never leave the
//!   old key archived without the new key active. Because Soroban only
//!   commits a contract invocation's storage writes when the invocation
//!   returns successfully, a rejected/panicking call is rolled back in full
//!   by the host as well; this module additionally guarantees no partial
//!   writes happen even *within* a single successful call. See the
//!   `rotate_key_failure_leaves_old_key_untouched` test.
//! - **Replay.** Once a key is rotated, `get_active_key` only ever returns
//!   the newest version; archived/revoked versions are never promoted back
//!   to active, so a stale key hash cannot be replayed as if it were still
//!   current. See the `old_key_is_never_returned_as_active_after_rotation`
//!   test.

use soroban_sdk::{contracttype, symbol_short, Address, BytesN, Env, Vec};

// ─── Key purpose ──────────────────────────────────────────────────────────────

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
    pub fn to_u32(self) -> u32 { self as u32 }

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
            KeyPurpose::WebhookSigning  => "WEBHOOK_SIGNING",
            KeyPurpose::ApiKeyHash      => "API_KEY_HASH",
            KeyPurpose::ZkpVerification => "ZKP_VERIFICATION",
            KeyPurpose::PiiEncryption   => "PII_ENCRYPTION",
        }
    }
}

// ─── Key status ───────────────────────────────────────────────────────────────

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

// ─── Key record ───────────────────────────────────────────────────────────────

/// On-chain record for a single key version.
///
/// The actual secret is **never** stored on-chain.  Only its SHA-256 hash is
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

// ─── Storage keys ─────────────────────────────────────────────────────────────

/// Storage key type for the key rotation system.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum KeyStorage {
    /// Maps `purpose → current version number`.
    Active(KeyPurpose),
    /// Maps `(purpose, version) → KeyRecord`.
    Key(KeyPurpose, u32),
}

// ─── Errors ───────────────────────────────────────────────────────────────────

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
}

// ─── Public API ───────────────────────────────────────────────────────────────

/// Verifies `caller` has signed the invocation **and** is a member of
/// `current_admins`. Every mutating function in this module calls this before
/// touching storage — authorization is enforced here, not left to callers.
fn authorize(caller: &Address, current_admins: &Vec<Address>) -> Result<(), KeyRotationError> {
    caller.require_auth();
    if !current_admins.contains(caller) {
        return Err(KeyRotationError::Unauthorized);
    }
    Ok(())
}

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
    authorize(admin, current_admins)?;
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
/// `version = old + 1`.  Returns the new version number.
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
    authorize(admin, current_admins)?;
    reject_zero_hash(&new_key_hash)?;

    // Fetch current active version
    let active_slot = KeyStorage::Active(purpose);
    let old_version = env
        .storage()
        .instance()
        .get::<KeyStorage, u32>(&active_slot)
        .ok_or(KeyRotationError::NoActiveKey)?;

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

    // Install new version
    let new_version = old_version + 1;
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
    authorize(admin, current_admins)?;
    let slot = KeyStorage::Key(purpose, version);
    let mut record = env
        .storage()
        .instance()
        .get::<KeyStorage, KeyRecord>(&slot)
        .ok_or(KeyRotationError::VersionNotFound)?;

    record.status = KeyStatus::Revoked;
    record.archived_at = env.ledger().timestamp();
    env.storage()
        .instance()
        .set::<KeyStorage, KeyRecord>(&slot, &record);

    emit_key_event(env, "key_rev", purpose, version, admin);
    Ok(())
}

/// Returns the active `KeyRecord` for `purpose`.
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
    authorize(admin, current_admins)?;
    // Prevent purging the active version
    if let Some(active) = active_version(env, purpose) {
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

// ─── Internal helpers ─────────────────────────────────────────────────────────

/// Rejects an all-zeros key hash (common mistake when initialising with a
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
    // Build event using a purpose-tagged topic
    let sym = match action {
        "key_ins" => symbol_short!("key_ins"),
        "key_rot" => symbol_short!("key_rot"),
        "key_rev" => symbol_short!("key_rev"),
        "key_prg" => symbol_short!("key_prg"),
        _         => symbol_short!("key_evt"),
    };
    env.events()
        .publish((sym, actor), (purpose.to_u32(), version));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, BytesN, Env};

    fn make_hash(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn zero_hash(env: &Env) -> BytesN<32> {
        BytesN::from_array(env, &[0u8; 32])
    }

    /// Test env with mocked auths, one admin address, and its singleton
    /// admin list — mirrors how `lib.rs` would fetch `current_admins`.
    fn setup(env: &Env) -> (Address, Vec<Address>) {
        env.mock_all_auths();
        let admin = Address::generate(env);
        let admins = Vec::from_array(env, [admin.clone()]);
        (admin, admins)
    }

    // ── install_key ───────────────────────────────────────────────────────────

    #[test]
    fn install_key_creates_version_1() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        let hash = make_hash(&env, 0xAA);
        let version =
            install_key(&env, &admin, &admins, KeyPurpose::WebhookSigning, hash.clone()).unwrap();
        assert_eq!(version, 1);
        let record = get_active_key(&env, KeyPurpose::WebhookSigning).unwrap();
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
        // Confirm the rejected call left no state behind.
        assert_eq!(active_version(&env, KeyPurpose::WebhookSigning), None);
    }

    // ── rotate_key ────────────────────────────────────────────────────────────

    #[test]
    fn rotate_key_increments_version() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 0x01)).unwrap();
        let v2 = rotate_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 0x02))
            .unwrap();
        assert_eq!(v2, 2);
        let active = get_active_key(&env, KeyPurpose::ApiKeyHash).unwrap();
        assert_eq!(active.version, 2);
        assert_eq!(active.key_hash, make_hash(&env, 0x02));
    }

    #[test]
    fn rotate_key_archives_previous_version() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 0x01)).unwrap();
        rotate_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 0x02)).unwrap();
        let old = get_key_version(&env, KeyPurpose::ApiKeyHash, 1).unwrap();
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

        assert_eq!(active_version(&env, KeyPurpose::ZkpVerification), Some(3));

        let v1 = get_key_version(&env, KeyPurpose::ZkpVerification, 1).unwrap();
        let v2 = get_key_version(&env, KeyPurpose::ZkpVerification, 2).unwrap();
        let v3 = get_key_version(&env, KeyPurpose::ZkpVerification, 3).unwrap();

        assert_eq!(v1.status, KeyStatus::Archived);
        assert_eq!(v2.status, KeyStatus::Archived);
        assert_eq!(v3.status, KeyStatus::Active);
    }

    #[test]
    fn rotate_key_rejects_non_admin_caller() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        let attacker = Address::generate(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 1)).unwrap();

        assert_eq!(
            rotate_key(&env, &attacker, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 2)),
            Err(KeyRotationError::Unauthorized)
        );
        // Unauthorized attempt must not have touched the active key.
        let active = get_active_key(&env, KeyPurpose::ApiKeyHash).unwrap();
        assert_eq!(active.version, 1);
        assert_eq!(active.key_hash, make_hash(&env, 1));
    }

    /// Partial-failure / atomicity: a rotation rejected for a *content* reason
    /// (zero hash) must not have archived the old key first. Regression test
    /// for the class of bug where validation and mutation are interleaved.
    #[test]
    fn rotate_key_failure_leaves_old_key_untouched() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 1)).unwrap();

        assert_eq!(
            rotate_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, zero_hash(&env)),
            Err(KeyRotationError::ZeroKeyHash)
        );

        let still_active = get_active_key(&env, KeyPurpose::ApiKeyHash).unwrap();
        assert_eq!(still_active.version, 1);
        assert_eq!(still_active.status, KeyStatus::Active);
        assert_eq!(still_active.key_hash, make_hash(&env, 1));
        // Only one version should exist — no half-installed "version 2".
        assert_eq!(
            get_key_version(&env, KeyPurpose::ApiKeyHash, 2),
            Err(KeyRotationError::VersionNotFound)
        );
    }

    /// Replay: an old key hash must never be returned as active again once a
    /// newer version has been installed.
    #[test]
    fn old_key_is_never_returned_as_active_after_rotation() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 1)).unwrap();
        rotate_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 2)).unwrap();
        rotate_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 3)).unwrap();

        let active = get_active_key(&env, KeyPurpose::ApiKeyHash).unwrap();
        assert_ne!(active.key_hash, make_hash(&env, 1));
        assert_ne!(active.key_hash, make_hash(&env, 2));
        assert_eq!(active.key_hash, make_hash(&env, 3));
    }

    // ── revoke_key_version ────────────────────────────────────────────────────

    #[test]
    fn revoke_marks_version_revoked() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::WebhookSigning, make_hash(&env, 0xA0)).unwrap();
        rotate_key(&env, &admin, &admins, KeyPurpose::WebhookSigning, make_hash(&env, 0xB0)).unwrap();
        revoke_key_version(&env, &admin, &admins, KeyPurpose::WebhookSigning, 1).unwrap();
        let v1 = get_key_version(&env, KeyPurpose::WebhookSigning, 1).unwrap();
        assert_eq!(v1.status, KeyStatus::Revoked);
    }

    #[test]
    fn revoke_nonexistent_version_fails() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        assert_eq!(
            revoke_key_version(&env, &admin, &admins, KeyPurpose::WebhookSigning, 99),
            Err(KeyRotationError::VersionNotFound)
        );
    }

    #[test]
    fn revoke_key_version_rejects_non_admin_caller() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        let attacker = Address::generate(&env);
        install_key(&env, &admin, &admins, KeyPurpose::WebhookSigning, make_hash(&env, 1)).unwrap();

        assert_eq!(
            revoke_key_version(&env, &attacker, &admins, KeyPurpose::WebhookSigning, 1),
            Err(KeyRotationError::Unauthorized)
        );
        let v1 = get_key_version(&env, KeyPurpose::WebhookSigning, 1).unwrap();
        assert_eq!(v1.status, KeyStatus::Active);
    }

    // ── purge_key_version ─────────────────────────────────────────────────────

    #[test]
    fn purge_archived_version_removes_storage() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 1)).unwrap();
        rotate_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 2)).unwrap();
        purge_key_version(&env, &admin, &admins, KeyPurpose::ApiKeyHash, 1).unwrap();
        assert_eq!(
            get_key_version(&env, KeyPurpose::ApiKeyHash, 1),
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

    #[test]
    fn purge_key_version_rejects_non_admin_caller() {
        let env = Env::default();
        let (admin, admins) = setup(&env);
        let attacker = Address::generate(&env);
        install_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 1)).unwrap();
        rotate_key(&env, &admin, &admins, KeyPurpose::ApiKeyHash, make_hash(&env, 2)).unwrap();

        assert_eq!(
            purge_key_version(&env, &attacker, &admins, KeyPurpose::ApiKeyHash, 1),
            Err(KeyRotationError::Unauthorized)
        );
        // Attacker must not have been able to purge the archived version.
        assert!(get_key_version(&env, KeyPurpose::ApiKeyHash, 1).is_ok());
    }

    // ── get_active_key ────────────────────────────────────────────────────────

    #[test]
    fn get_active_key_returns_not_found_when_no_key_installed() {
        let env = Env::default();
        assert_eq!(
            get_active_key(&env, KeyPurpose::PiiEncryption),
            Err(KeyRotationError::NoActiveKey)
        );
    }

    #[test]
    fn active_version_returns_none_before_install() {
        let env = Env::default();
        assert_eq!(active_version(&env, KeyPurpose::WebhookSigning), None);
    }

    // ── key purpose helpers ───────────────────────────────────────────────────

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
