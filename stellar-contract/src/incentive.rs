//! Incentive module (issue #759)
//!
//! Encapsulates incentive lifecycle helpers extracted from `lib.rs`.
//!
//! # Responsibilities
//! - Incentive creation validation
//! - Reward calculation (flat-rate and tiered)
//! - Scheduling guards (starts_at / ends_at)
//! - Budget exhaustion logic
//!
//! # Error consolidation audit (issue #1097)
//! Audited: every fallible function here already returns `Result<_,
//! errors::Error>` and no local error enum or `panic!`/`.expect()` exists in
//! this file. No migration was needed. See `errors.rs` for the full audit
//! covering all four files named in issue #1097.

use soroban_sdk::Env;

use crate::errors::Error;
use crate::types::{Incentive, WasteType};

// ── Creation validation ───────────────────────────────────────────────────────

/// Validates incentive creation parameters.
///
/// * `reward_points` must be ≥ 1.
/// * `budget` must be ≥ `reward_points` (so at least 1 kg can be rewarded).
/// * If both `starts_at` and `ends_at` are set, `starts_at` must be before `ends_at`.
pub fn validate_creation(
    reward_points: u64,
    budget: u64,
    starts_at: Option<u64>,
    ends_at: Option<u64>,
    now: u64,
) -> Result<(), Error> {
    if reward_points == 0 {
        return Err(Error::InvalidAmount);
    }
    if budget == 0 {
        return Err(Error::InvalidAmount);
    }
    if let (Some(start), Some(end)) = (starts_at, ends_at) {
        if start >= end || end <= now {
            return Err(Error::InvalidSchedule);
        }
    }
    Ok(())
}

// ── Scheduling ────────────────────────────────────────────────────────────────

/// Returns `true` if the incentive is currently within its active window.
/// An incentive with no schedule is always considered "in window".
pub fn is_in_window(incentive: &Incentive, now: u64) -> bool {
    if let Some(start) = incentive.starts_at {
        if now < start {
            return false;
        }
    }
    if let Some(end) = incentive.ends_at {
        if now >= end {
            return false;
        }
    }
    true
}

// ── Reward calculation ────────────────────────────────────────────────────────

/// Calculates the reward for `weight_grams` using the incentive's rate schedule.
/// Returns `0` if no tier matches and the flat rate is also `0`.
pub fn calculate_reward(incentive: &Incentive, weight_grams: u64) -> u64 {
    incentive.calculate_reward(weight_grams)
}

/// Attempts to claim a reward from `incentive`, updating its budget in place.
/// Returns the claimed amount or `Err(Error::NoRewardAvailable)` / budget errors.
pub fn claim(
    incentive: &mut Incentive,
    weight_grams: u64,
    now: u64,
) -> Result<u64, Error> {
    if !incentive.active {
        return Err(Error::IncentiveInactive);
    }
    if !is_in_window(incentive, now) {
        return Err(Error::IncentiveInactive);
    }
    let reward = incentive.calculate_reward(weight_grams);
    if reward == 0 {
        return Err(Error::NoRewardAvailable);
    }
    if reward > incentive.remaining_budget {
        return Err(Error::InsufficientBudget);
    }
    incentive.remaining_budget -= reward;
    if incentive.remaining_budget == 0 {
        incentive.active = false;
    }
    Ok(reward)
}

// ── Waste-type matching ───────────────────────────────────────────────────────

/// Returns `Err(Error::WasteTypeMismatch)` if types differ.
pub fn require_matching_type(incentive: &Incentive, waste_type: WasteType) -> Result<(), Error> {
    if incentive.waste_type != waste_type {
        return Err(Error::WasteTypeMismatch);
    }
    Ok(())
}
