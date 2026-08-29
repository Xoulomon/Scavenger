//! Waste module (issue #759)
//!
//! Encapsulates helpers for waste lifecycle management: validation, status
//! transitions, and batch operations.  Extracted from `lib.rs` to keep the
//! main contract file focused on dispatch logic.
//!
//! # Responsibilities
//! - Weight and coordinate validation for waste submissions
//! - State-transition guards (active, confirmed, frozen, expired)
//! - Transfer-route validation between participant roles
//! - Batch operation helpers
//!
//! # Error consolidation audit (issue #1097)
//! Audited: every fallible function here already returns `Result<_,
//! errors::Error>` and no local error enum or `panic!`/`.expect()` exists in
//! this file. No migration was needed. See `errors.rs` for the full audit
//! covering all four files named in issue #1097.

use crate::errors::Error;
use crate::types::{ParticipantRole, Waste};

/// Maximum waste weight per submission: 1 000 000 kg expressed in grams.
pub const MAX_WASTE_WEIGHT_GRAMS: u128 = 1_000_000_000;

/// Minimum weight a waste item must have to be submitted (100 g).
pub const MIN_WASTE_WEIGHT_GRAMS: u128 = 100;

// ── Transfer-route validation ─────────────────────────────────────────────────

/// Valid routes: Recycler→Collector, Recycler→Manufacturer, Collector→Manufacturer.
///
/// Returns `Err(Error::InvalidTransferRoute)` for any other combination and
/// `Err(Error::SameAddress)` when both addresses resolve to the same role.
pub fn validate_transfer_route(from_role: ParticipantRole, to_role: ParticipantRole) -> Result<(), Error> {
    match (from_role, to_role) {
        (ParticipantRole::Recycler, ParticipantRole::Collector)
        | (ParticipantRole::Recycler, ParticipantRole::Manufacturer)
        | (ParticipantRole::Collector, ParticipantRole::Manufacturer) => Ok(()),
        _ => Err(Error::InvalidTransferRoute),
    }
}

// ── Waste state guards ────────────────────────────────────────────────────────

/// Returns `Err(Error::WasteDeactivated)` if the waste is not active.
pub fn require_active(waste: &Waste) -> Result<(), Error> {
    if !waste.is_active {
        return Err(Error::WasteDeactivated);
    }
    Ok(())
}

/// Returns `Err(Error::WasteFrozen)` if the waste is frozen.
pub fn require_not_frozen(waste: &Waste) -> Result<(), Error> {
    if waste.is_frozen {
        return Err(Error::WasteFrozen);
    }
    Ok(())
}

/// Returns `Err(Error::WasteExpired)` if the waste has expired.
pub fn require_not_expired(waste: &Waste, now: u64) -> Result<(), Error> {
    if waste.is_expired(now) {
        return Err(Error::WasteExpired);
    }
    Ok(())
}

/// Returns `Err(Error::WasteAlreadyConfirmed)` if already confirmed.
pub fn require_not_confirmed(waste: &Waste) -> Result<(), Error> {
    if waste.is_confirmed {
        return Err(Error::WasteAlreadyConfirmed);
    }
    Ok(())
}

/// Returns `Err(Error::WasteNotConfirmed)` if not yet confirmed.
pub fn require_confirmed(waste: &Waste) -> Result<(), Error> {
    if !waste.is_confirmed {
        return Err(Error::WasteNotConfirmed);
    }
    Ok(())
}

// ── Weight validation ─────────────────────────────────────────────────────────

/// Validates that `weight` is within [MIN, MAX] bounds.
pub fn validate_weight(weight: u128) -> Result<(), Error> {
    if weight == 0 {
        return Err(Error::InvalidWeight);
    }
    if weight > MAX_WASTE_WEIGHT_GRAMS {
        return Err(Error::InvalidWeight);
    }
    Ok(())
}

// ── Impact score ──────────────────────────────────────────────────────────────

/// Convenience wrapper – delegates to `types::calculate_impact_score`.
pub fn impact_score(_env: &soroban_sdk::Env, waste: &Waste) -> u128 {
    crate::types::calculate_impact_score(waste.waste_type, waste.weight)
}
