//! Participant module (issue #759)
//!
//! Encapsulates all helpers and constants related to participant management so
//! that `lib.rs` can delegate validation, lookup, and update logic here instead
//! of inlining it across thousands of lines.
//!
//! # Responsibilities
//! - Participant registration / deregistration helpers
//! - Role-based permission checks
//! - Reputation score helpers
//! - Location validation
//!
//! # Integration status (audited under issue #1100)
//!
//! `ScavengerContract`'s public entry points in `lib.rs` (`register_participant`,
//! `update_role`, `deregister_participant`, `get_participant`, …) currently do
//! **not** call into this module — they keep an independent, inlined
//! implementation of storage access and lifecycle logic. This module is not
//! dead code by design; it was extracted from `lib.rs` under issue #759 as the
//! target shape for that logic, but the follow-up wiring was never done.
//!
//! Consequences audited here:
//! - The storage key/tier used below now matches `lib.rs`'s real scheme (see
//!   [`participant_key`]) — previously this module used a different key
//!   (`("PART", address)` in *persistent* storage) than `lib.rs`'s actual
//!   `(address,)` key in *instance* storage, which would have silently missed
//!   all real participant data had anything ever called into this module.
//! - [`certification_from_weight`] and [`tier_from_tokens`] used to duplicate
//!   `types::CertificationLevel`/`types::ParticipantTier` with *different*
//!   thresholds and input semantics (item-count/weight vs. weight/tokens).
//!   They now delegate to the canonical implementations in `types.rs` so the
//!   two can no longer drift apart.
//!
//! Fully rewiring `lib.rs` to call through this module (instead of its inline
//! implementation) touches every participant code path in an ~8,000-line file
//! with no local build/test verification available in this change, so it is
//! intentionally left as a follow-up rather than attempted blind here. Tracked
//! as a migration note for the next pass.

use soroban_sdk::{Address, Env};

use crate::errors::Error;
use crate::types::{CertificationLevel, Participant, ParticipantRole, ParticipantTier};

/// Returns `true` if `address` is currently registered and active.
pub fn is_registered(env: &Env, address: &Address) -> bool {
    let key = participant_key(address);
    if let Some(p) = env
        .storage()
        .instance()
        .get::<(Address,), Participant>(&key)
    {
        p.is_registered
    } else {
        false
    }
}

/// Loads a participant or returns `Error::NotRegistered`.
pub fn require_participant(env: &Env, address: &Address) -> Result<Participant, Error> {
    let key = participant_key(address);
    env.storage()
        .instance()
        .get::<(Address,), Participant>(&key)
        .filter(|p| p.is_registered)
        .ok_or(Error::NotRegistered)
}

/// Persists updated participant data.
pub fn save_participant(env: &Env, participant: &Participant) {
    let key = participant_key(&participant.address);
    env.storage().instance().set(&key, participant);
}

/// Validates GPS coordinates (microdegrees).
/// Latitude ∈ [-90_000_000, +90_000_000]
/// Longitude ∈ [-180_000_000, +180_000_000]
pub fn validate_coordinates(lat: i128, lon: i128) -> Result<(), Error> {
    if lat < -90_000_000 || lat > 90_000_000 || lon < -180_000_000 || lon > 180_000_000 {
        return Err(Error::InvalidCoordinates);
    }
    Ok(())
}

/// Derives the `CertificationLevel` from total waste items processed.
///
/// Delegates to `types::CertificationLevel::from_waste_count`, the
/// implementation `lib.rs` actually calls, so this helper cannot drift from
/// production behavior (issue #1100 — the two previously used different
/// thresholds and input units).
pub fn certification_from_weight(total_waste_count: u128) -> CertificationLevel {
    CertificationLevel::from_waste_count(total_waste_count)
}

/// Derives the `ParticipantTier` from total waste processed (in grams).
///
/// Delegates to `types::ParticipantTier::from_total_waste`, the
/// implementation `lib.rs` actually calls (issue #1100).
pub fn tier_from_tokens(total_waste_grams: u128) -> ParticipantTier {
    ParticipantTier::from_total_waste(total_waste_grams)
}

/// Checks that `role` is allowed to submit waste.
/// Recyclers and Collectors may submit; Manufacturers may not.
pub fn can_submit_waste(role: ParticipantRole) -> bool {
    matches!(role, ParticipantRole::Recycler | ParticipantRole::Collector)
}

// ── Private helpers ───────────────────────────────────────────────────────────

/// Constructs the instance-storage key for a participant.
/// Matches the key scheme actually used by `lib.rs`: a bare `(address,)`
/// tuple in *instance* storage (not persistent storage — see the module-level
/// "Integration status" note for why this matters).
fn participant_key(address: &Address) -> (Address,) {
    (address.clone(),)
}
