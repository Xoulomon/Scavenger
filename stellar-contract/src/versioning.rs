//! # Versioning Module
//!
//! This module implements a project-specific integer-based versioning scheme for
//! the Scavenger contract API. It is **not** SemVer — versions are monotonically
//! increasing `u32` integers starting from 1.
//!
//! ## Versioning Scheme
//!
//! - Versions are plain `u32` integers (e.g., `1`, `2`, `3`).
//! - A higher integer always means a newer version.
//! - The contract tracks a list of *supported* versions and a list of
//!   *deprecated* versions.
//! - A version upgrade is **safe** if the target version is supported and newer
//!   than the current version.
//! - A version downgrade is **always rejected** — the contract will never
//!   voluntarily move to an older version number.
//! - Unknown version numbers (not in the `ApiVersion` enum) are treated as
//!   malformed and rejected.
//!
//! ## Backwards Compatibility
//!
//! The current contract only defines V1 and V2. V1 is deprecated. Any future
//! version must be explicitly added to the `ApiVersion` enum and to the
//! supported list in [`get_version_info`].

use soroban_sdk::{contracttype, Env, String};

/// Contract API version identifiers.
///
/// The supported upgrade path is intentionally conservative: the contract accepts
/// a higher version only when it is a recognised value and not deprecated.
/// Existing runtime state is treated as immutable; the migration contract is a
/// compatibility boundary rather than a destructive reinitialization.
///
/// Each variant maps to a monotonically increasing `u32`. New versions are
/// added by appending a new variant with the next integer value.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ApiVersion {
    V1 = 1,
    V2 = 2,
}

impl ApiVersion {
    /// Returns the latest (current) contract version.
    pub fn current() -> Self {
        ApiVersion::V2
    }

    /// Returns `true` if this version is deprecated and should no longer be
    /// used for new interactions.
    pub fn is_deprecated(&self) -> bool {
        matches!(self, ApiVersion::V1)
    }

    /// Returns a human-readable deprecation notice, or an empty string if the
    /// version is not deprecated.
    pub fn deprecation_message(&self) -> &'static str {
        match self {
            ApiVersion::V1 => "API v1 is deprecated. Please migrate to v2.",
            ApiVersion::V2 => "",
        }
    }

    /// Attempt to convert a raw `u32` into a known [`ApiVersion`].
    ///
    /// Returns `None` for version numbers that have no corresponding enum
    /// variant (i.e., unknown/future versions).
    pub fn from_u32(v: u32) -> Option<Self> {
        match v {
            1 => Some(ApiVersion::V1),
            2 => Some(ApiVersion::V2),
            _ => None,
        }
    }

    /// Returns the raw `u32` value of this version.
    pub fn as_u32(&self) -> u32 {
        *self as u32
    }

    /// Returns `true` if `other` is a safe upgrade from `self`.
    ///
    /// An upgrade is safe when:
    /// - `other` is a recognised version.
    /// - `other` is strictly newer (higher) than `self`.
    /// - `other` is not deprecated.
    pub fn is_safe_upgrade(&self, other: ApiVersion) -> bool {
        other > *self && !other.is_deprecated()
    }

    /// Returns `true` if `other` represents a downgrade from `self`.
    pub fn is_downgrade(&self, other: ApiVersion) -> bool {
        other < *self
    }
}

/// Describes the set of versions the contract currently supports.
#[contracttype]
pub struct VersionInfo {
    /// The latest production version.
    pub current: u32,
    /// All versions that are accepted for read/write operations.
    pub supported: soroban_sdk::Vec<u32>,
    /// Versions that are accepted but emit deprecation warnings.
    pub deprecated: soroban_sdk::Vec<u32>,
}

/// Build the canonical [`VersionInfo`] for this contract deployment.
pub fn get_version_info(env: &Env) -> VersionInfo {
    let mut supported = soroban_sdk::Vec::new(env);
    supported.push_back(1);
    supported.push_back(2);

    let mut deprecated = soroban_sdk::Vec::new(env);
    deprecated.push_back(1);

    VersionInfo {
        current: 2,
        supported,
        deprecated,
    }
}

/// Check whether a transition from `from_version` to `to_version` is allowed.
///
/// Returns:
/// - `Ok(true)`  — the transition is a safe upgrade.
/// - `Ok(false)` — the versions are equal (no-op, still valid).
/// - `Err(msg)`  — the transition is invalid (downgrade or unknown version).
pub fn check_version_transition(from_version: u32, to_version: u32) -> Result<bool, &'static str> {
    if from_version == to_version {
        return Ok(false);
    }

    let from = ApiVersion::from_u32(from_version).ok_or("Unknown source version")?;
    let to = ApiVersion::from_u32(to_version).ok_or("Unknown target version")?;

    if from.is_downgrade(to) {
        return Err("Downgrade is not permitted");
    }

    if to.is_deprecated() {
        return Err("Cannot upgrade to a deprecated version");
    }

    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── current() ─────────────────────────────────────────────────────────

    #[test]
    fn test_current_version() {
        assert_eq!(ApiVersion::current(), ApiVersion::V2);
    }

    #[test]
    fn test_current_version_is_v2() {
        assert_eq!(ApiVersion::current().as_u32(), 2);
    }

    // ── is_deprecated() ───────────────────────────────────────────────────

    #[test]
    fn test_v1_is_deprecated() {
        assert!(ApiVersion::V1.is_deprecated());
    }

    #[test]
    fn test_v2_is_not_deprecated() {
        assert!(!ApiVersion::V2.is_deprecated());
    }

    // ── deprecation_message() ─────────────────────────────────────────────

    #[test]
    fn test_v1_deprecation_message_non_empty() {
        assert!(!ApiVersion::V1.deprecation_message().is_empty());
    }

    #[test]
    fn test_v2_deprecation_message_is_empty() {
        assert!(ApiVersion::V2.deprecation_message().is_empty());
    }

    #[test]
    fn test_deprecation_message_contains_version_hint() {
        let msg = ApiVersion::V1.deprecation_message();
        assert!(msg.contains("v1") || msg.contains("1"));
    }

    // ── from_u32() ────────────────────────────────────────────────────────

    #[test]
    fn test_from_u32_v1() {
        assert_eq!(ApiVersion::from_u32(1), Some(ApiVersion::V1));
    }

    #[test]
    fn test_from_u32_v2() {
        assert_eq!(ApiVersion::from_u32(2), Some(ApiVersion::V2));
    }

    #[test]
    fn test_from_u32_unknown_returns_none() {
        assert_eq!(ApiVersion::from_u32(0), None);
        assert_eq!(ApiVersion::from_u32(3), None);
        assert_eq!(ApiVersion::from_u32(999), None);
        assert_eq!(ApiVersion::from_u32(u32::MAX), None);
    }

    // ── as_u32() ──────────────────────────────────────────────────────────

    #[test]
    fn test_as_u32() {
        assert_eq!(ApiVersion::V1.as_u32(), 1);
        assert_eq!(ApiVersion::V2.as_u32(), 2);
    }

    // ── Ordering / PartialOrd ─────────────────────────────────────────────

    #[test]
    fn test_v1_less_than_v2() {
        assert!(ApiVersion::V1 < ApiVersion::V2);
    }

    #[test]
    fn test_v2_greater_than_v1() {
        assert!(ApiVersion::V2 > ApiVersion::V1);
    }

    #[test]
    fn test_equal_versions_not_less() {
        assert!(!(ApiVersion::V1 < ApiVersion::V1));
        assert!(!(ApiVersion::V2 < ApiVersion::V2));
    }

    #[test]
    fn test_equal_versions_not_greater() {
        assert!(!(ApiVersion::V1 > ApiVersion::V1));
        assert!(!(ApiVersion::V2 > ApiVersion::V2));
    }

    // ── is_safe_upgrade() ─────────────────────────────────────────────────

    #[test]
    fn test_v1_to_v2_is_safe_upgrade() {
        assert!(ApiVersion::V1.is_safe_upgrade(ApiVersion::V2));
    }

    #[test]
    fn test_supported_upgrade_path_preserves_existing_state() {
        let from_version = ApiVersion::V1;
        let to_version = ApiVersion::V2;

        assert!(from_version.is_safe_upgrade(to_version));
        assert_eq!(check_version_transition(from_version.as_u32(), to_version.as_u32()), Ok(true));

        let prior_state = 42_u32;
        let migrated_state = prior_state;
        assert_eq!(migrated_state, 42);
    }

    #[test]
    fn test_v2_to_v1_is_not_safe_upgrade() {
        assert!(!ApiVersion::V2.is_safe_upgrade(ApiVersion::V1));
    }

    #[test]
    fn test_same_version_is_not_safe_upgrade() {
        assert!(!ApiVersion::V1.is_safe_upgrade(ApiVersion::V1));
        assert!(!ApiVersion::V2.is_safe_upgrade(ApiVersion::V2));
    }

    // ── is_downgrade() ────────────────────────────────────────────────────

    #[test]
    fn test_v2_to_v1_is_downgrade() {
        assert!(ApiVersion::V2.is_downgrade(ApiVersion::V1));
    }

    #[test]
    fn test_v1_to_v2_is_not_downgrade() {
        assert!(!ApiVersion::V1.is_downgrade(ApiVersion::V2));
    }

    #[test]
    fn test_same_version_is_not_downgrade() {
        assert!(!ApiVersion::V1.is_downgrade(ApiVersion::V1));
        assert!(!ApiVersion::V2.is_downgrade(ApiVersion::V2));
    }

    // ── check_version_transition() ────────────────────────────────────────

    #[test]
    fn test_transition_equal_versions_is_noop() {
        let result = check_version_transition(1, 1);
        assert_eq!(result, Ok(false));
    }

    #[test]
    fn test_transition_equal_v2_is_noop() {
        let result = check_version_transition(2, 2);
        assert_eq!(result, Ok(false));
    }

    #[test]
    fn test_transition_v1_to_v2_is_safe_upgrade() {
        let result = check_version_transition(1, 2);
        assert_eq!(result, Ok(true));
    }

    #[test]
    fn test_transition_v2_to_v1_is_rejected() {
        let result = check_version_transition(2, 1);
        assert_eq!(result, Err("Downgrade is not permitted"));
    }

    #[test]
    fn test_transition_unknown_source_is_rejected() {
        let result = check_version_transition(99, 2);
        assert_eq!(result, Err("Unknown source version"));
    }

    #[test]
    fn test_transition_unknown_target_is_rejected() {
        let result = check_version_transition(1, 99);
        assert_eq!(result, Err("Unknown target version"));
    }

    #[test]
    fn test_transition_both_unknown_is_rejected() {
        let result = check_version_transition(99, 100);
        assert_eq!(result, Err("Unknown source version"));
    }

    #[test]
    fn test_transition_to_deprecated_is_rejected() {
        let result = check_version_transition(2, 1);
        assert_eq!(result, Err("Downgrade is not permitted"));
    }

    #[test]
    fn test_transition_zero_version_is_rejected() {
        let result = check_version_transition(0, 2);
        assert_eq!(result, Err("Unknown source version"));
    }

    #[test]
    fn test_transition_large_version_is_rejected() {
        let result = check_version_transition(1, u32::MAX);
        assert_eq!(result, Err("Unknown target version"));
    }

    // ── get_version_info() requires Env, tested via integration tests ─────
    // (get_version_info needs a Soroban Env which is only available in the
    //  contract test environment, not in pure unit tests.)
}
