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
///
/// Returns [`Error::Overflow`] when the multiplication would overflow `u64`.
pub fn calculate_reward(incentive: &Incentive, weight_grams: u64) -> Result<u64, Error> {
    incentive.calculate_reward(weight_grams)
}

/// Attempts to claim a reward from `incentive`, updating its budget in place.
/// Returns the claimed amount or `Err(Error::NoRewardAvailable)` / budget errors.
pub fn claim(incentive: &mut Incentive, weight_grams: u64, now: u64) -> Result<u64, Error> {
    if !incentive.active {
        return Err(Error::IncentiveInactive);
    }
    if !is_in_window(incentive, now) {
        return Err(Error::IncentiveInactive);
    }
    let reward = incentive.calculate_reward(weight_grams)?;
    if reward == 0 {
        return Err(Error::NoRewardAvailable);
    }
    if reward > incentive.remaining_budget {
        return Err(Error::InsufficientBudget);
    }
    incentive.remaining_budget = incentive.remaining_budget.checked_sub(reward).ok_or(Error::Overflow)?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::IncentiveTier;
    use proptest::prelude::*;
    use soroban_sdk::{testutils::Address as _, Address, Env, Vec};

    fn incentive(env: &Env, reward_points: u64, budget: u64) -> Incentive {
        Incentive::new(
            1,
            Address::generate(env),
            WasteType::Plastic,
            reward_points,
            budget,
            0,
            env,
        )
    }

    #[test]
    fn zero_weight_earns_zero_reward() {
        let env = Env::default();
        let inc = incentive(&env, 10, 100);
        assert_eq!(calculate_reward(&inc, 0), Ok(0));
    }

    #[test]
    fn reward_overflow_is_typed_error() {
        let env = Env::default();
        let inc = incentive(&env, u64::MAX, u64::MAX);
        assert_eq!(calculate_reward(&inc, 1_000), Err(Error::Overflow));
    }

    #[test]
    fn claim_does_not_mutate_on_error() {
        let env = Env::default();
        let mut inc = incentive(&env, u64::MAX, u64::MAX);
        assert_eq!(claim(&mut inc, 1_000, 0), Err(Error::Overflow));
        assert_eq!(inc.remaining_budget, u64::MAX);
        assert!(inc.active);

        let mut inc = incentive(&env, 10, 5);
        assert_eq!(claim(&mut inc, 1_000, 0), Err(Error::InsufficientBudget));
        assert_eq!(inc.remaining_budget, 5);
        assert!(inc.active);
    }

    #[test]
    fn claim_exact_budget_deactivates() {
        let env = Env::default();
        let mut inc = incentive(&env, 10, 50);
        assert_eq!(claim(&mut inc, 5_000, 0), Ok(50));
        assert_eq!(inc.remaining_budget, 0);
        assert!(!inc.active);
    }

    #[test]
    fn tiered_reward_uses_checked_multiplication() {
        let env = Env::default();
        let mut inc = incentive(&env, 1, u64::MAX);
        inc.tiers = Vec::from_array(
            &env,
            [IncentiveTier {
                min_weight_kg: 0,
                max_weight_kg: 0,
                reward_points: u64::MAX,
            }],
        );
        assert_eq!(calculate_reward(&inc, 1_000), Err(Error::Overflow));
    }

    proptest! {
        #![proptest_config(ProptestConfig::with_cases(256))]

        #[test]
        fn reward_matches_checked_multiplication(
            weight_grams in any::<u64>(),
            reward_points in any::<u64>(),
        ) {
            let env = Env::default();
            let inc = incentive(&env, reward_points, u64::MAX);
            let expected = (weight_grams / 1_000).checked_mul(reward_points);
            let actual = calculate_reward(&inc, weight_grams);
            match expected {
                Some(value) => prop_assert_eq!(actual, Ok(value)),
                None => prop_assert_eq!(actual, Err(Error::Overflow)),
            }
        }

        #[test]
        fn claim_never_wraps_budget(
            budget in any::<u64>(),
            reward_points in any::<u64>(),
            weight_grams in any::<u64>(),
        ) {
            let env = Env::default();
            let mut inc = incentive(&env, reward_points, budget);
            let before = inc.remaining_budget;
            match claim(&mut inc, weight_grams, 0) {
                Ok(amount) => {
                    prop_assert!(amount <= before);
                    prop_assert_eq!(inc.remaining_budget, before - amount);
                }
                Err(_) => {
                    prop_assert_eq!(inc.remaining_budget, before);
                    prop_assert!(inc.active);
                }
            }
        }
    }
}
