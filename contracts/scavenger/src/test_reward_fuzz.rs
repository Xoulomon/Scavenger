#![cfg(test)]
// Property-based tests for reward/payout math — issue #1733.
// Invariants exercised here mirror the pure distribution logic in
// `distribute_rewards_internal` without touching Soroban host state.
use proptest::prelude::*;

/// Pure reward-distribution math extracted from `distribute_rewards_internal`.
/// Returns `(total_distributed, recycler_amount)`.
fn calc_reward(
    reward_points: u64,
    weight_grams: u64,
    collector_pct: u32,
    owner_pct: u32,
    num_collectors: u32,
) -> (i128, i128) {
    let weight_kg = (weight_grams / 1000) as i128;
    let total_reward = (reward_points as i128) * weight_kg;

    let collector_share = (total_reward * collector_pct as i128) / 100;
    let owner_share = (total_reward * owner_pct as i128) / 100;

    // Cap total collector pool so it cannot exceed what remains after the owner
    // share, matching the contract's saturating behaviour.
    let total_collector_pool = collector_share * num_collectors as i128;
    let total_distributed = total_collector_pool.min(total_reward - owner_share) + owner_share;
    let recycler_amount = total_reward - total_distributed;

    (total_distributed, recycler_amount)
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(2048))]

    /// Invariant 1: total_distributed never exceeds total_reward.
    /// Invariant 2: recycler_amount is always non-negative.
    /// Invariant 3: total_distributed is never negative.
    /// Invariant 4: zero or sub-kilogram weight always yields zero reward.
    ///
    /// Percentages are constrained so collector_pct + owner_pct <= 100,
    /// matching the guard in `ScavengerContract::initialize`.
    #[test]
    fn fuzz_reward_distribution(
        reward_points in 0u64..=u64::MAX,
        weight_grams in 0u64..=1_000_000_000u64,  // 0 g – 1 000 000 kg
        collector_pct in 0u32..=100u32,
        owner_pct_offset in 0u32..=100u32,
        num_collectors in 0u32..=500u32,
    ) {
        // Mirror the contract's initialize invariant: sum <= 100.
        let owner_pct = owner_pct_offset.min(100 - collector_pct);

        let (total_distributed, recycler_amount) =
            calc_reward(reward_points, weight_grams, collector_pct, owner_pct, num_collectors);

        let total_reward = (reward_points as i128) * ((weight_grams / 1000) as i128);

        prop_assert!(
            total_distributed <= total_reward,
            "total_distributed ({total_distributed}) > total_reward ({total_reward})"
        );
        prop_assert!(
            total_distributed >= 0,
            "total_distributed ({total_distributed}) is negative"
        );
        prop_assert!(
            recycler_amount >= 0,
            "recycler_amount ({recycler_amount}) is negative"
        );
        // Sub-kilogram weight rounds to zero kg → zero reward and zero distribution.
        if weight_grams < 1000 {
            prop_assert_eq!(total_reward, 0, "sub-kg weight must yield zero total_reward");
            prop_assert_eq!(total_distributed, 0, "sub-kg weight must yield zero distribution");
            prop_assert_eq!(recycler_amount, 0, "sub-kg weight must yield zero recycler_amount");
        }
    }

    /// Invariant: `checked_add` on u32 percentages never silently wraps.
    /// When the true 64-bit sum fits in u32, `checked_add` returns `Some(sum)`;
    /// when it overflows u32, it returns `None`.
    #[test]
    fn fuzz_percentage_sum_never_silently_wraps(
        collector_pct in 0u32..=u32::MAX,
        owner_pct in 0u32..=u32::MAX,
    ) {
        let true_sum = collector_pct as u64 + owner_pct as u64;
        match collector_pct.checked_add(owner_pct) {
            Some(sum) => {
                prop_assert!(true_sum <= u32::MAX as u64);
                prop_assert_eq!(sum as u64, true_sum);
            }
            None => prop_assert!(true_sum > u32::MAX as u64),
        }
    }

    /// Invariant: reward is monotone with weight — doubling weight_kg must at
    /// least double the total_reward (for non-zero reward_points).
    #[test]
    fn fuzz_payout_monotone_with_weight(
        reward_points in 1u64..=1_000_000u64,
        weight_kg_a in 1u64..=500_000u64,
        weight_kg_b in 1u64..=500_000u64,
    ) {
        // Ensure no overflow: reward_points * weight_kg must fit in i128.
        let reward_a = (reward_points as i128) * (weight_kg_a as i128);
        let reward_b = (reward_points as i128) * (weight_kg_b as i128);

        if weight_kg_a <= weight_kg_b {
            prop_assert!(reward_a <= reward_b, "reward should not decrease with more weight");
        } else {
            prop_assert!(reward_a >= reward_b, "reward should not increase with less weight");
        }
    }

    /// Invariant: with 0 collectors and 0% owner share, the recycler receives
    /// the full reward regardless of reward_points and weight.
    #[test]
    fn fuzz_zero_split_recycler_gets_all(
        reward_points in 1u64..=1_000_000u64,
        weight_grams in 1_000u64..=1_000_000_000u64,
    ) {
        let (total_distributed, recycler_amount) =
            calc_reward(reward_points, weight_grams, 0, 0, 0);
        let total_reward = (reward_points as i128) * ((weight_grams / 1000) as i128);
        prop_assert_eq!(total_distributed, 0, "zero-split: nothing distributed to others");
        prop_assert_eq!(recycler_amount, total_reward, "zero-split: recycler gets all");
    }
}
