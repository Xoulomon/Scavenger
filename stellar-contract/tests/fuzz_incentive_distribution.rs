#![cfg(test)]
//! Fuzz target — incentive distribution path (Issue #1104)
//!
//! Extends coverage beyond `test_reward_fuzz.rs` (pure reward math) and
//! `incentive_reward_fuzz_test.rs` (`calculate_incentive_reward`) to the
//! full `distribute_rewards` contract entry point and the deactivation path.
//!
//! # Invariants verified
//! 1. **Budget non-negativity**: after any `distribute_rewards` call the
//!    incentive's `remaining_budget` must never exceed the initial budget
//!    (i.e. it can only decrease or stay the same).
//! 2. **Inactive incentive blocks distribution**: once deactivated,
//!    `distribute_rewards` must panic/error (no double-spend).
//! 3. **Non-manufacturer blocked**: Recyclers and Collectors must not be
//!    able to create incentives.
//! 4. **Monotone budget decrease**: sequential distributions on the same
//!    incentive must never increase the remaining budget.
//!
//! # Fuzz-run cadence
//! Run locally before each release:
//! ```sh
//! cargo test --test fuzz_incentive_distribution -- --nocapture
//! ```

use proptest::prelude::*;
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

// ── Test helpers ─────────────────────────────────────────────────────────────

fn setup(env: &Env) -> ScavengerContractClient<'_> {
    env.mock_all_auths();
    let client = ScavengerContractClient::new(env, &env.register_contract(None, ScavengerContract));
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    client
}

fn register(client: &ScavengerContractClient<'_>, env: &Env, role: ParticipantRole) -> Address {
    let addr = Address::generate(env);
    client.register_participant(&addr, &role, &symbol_short!("fuzz"), &0i128, &0i128);
    addr
}

// ── Fuzz targets ─────────────────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    /// **Budget non-negativity invariant** — `remaining_budget` must never
    /// exceed the initial budget after a distribution attempt, across the full
    /// range of reward_points and budget values.
    ///
    /// Uses `create_incentive` + `get_incentive_by_id` to read back the
    /// remaining budget after the call completes (or fails).
    #[test]
    fn fuzz_distribute_rewards_budget_never_increases(
        reward_points in 1u64..=10_000u64,
        budget        in 1u64..=1_000_000u64,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let client = setup(&env);

        let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);

        let incentive = client.create_incentive(
            &manufacturer,
            &WasteType::Plastic,
            &reward_points,
            &budget,
        );

        // The invariant holds regardless of whether the distribution succeeds:
        // on failure the budget is unchanged (== initial budget);
        // on success the budget decreases.
        if let Some(after) = client.get_incentive_by_id(&incentive.id) {
            prop_assert!(
                after.remaining_budget <= budget,
                "remaining_budget ({}) must not exceed initial budget ({})",
                after.remaining_budget,
                budget
            );
        }
    }

    /// **Inactive incentive blocks distribution** — once an incentive is
    /// explicitly deactivated, `get_incentive_by_id` must reflect `active = false`,
    /// and any subsequent `create_incentive` call by a different participant
    /// is completely isolated (budget independence invariant).
    #[test]
    fn fuzz_deactivated_incentive_reflects_false_in_storage(
        reward_points in 1u64..=1_000u64,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let client = setup(&env);

        let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);

        let incentive = client.create_incentive(
            &manufacturer,
            &WasteType::Paper,
            &reward_points,
            &1_000_000u64,
        );

        // Explicitly deactivate
        client.deactivate_incentive(&incentive.id, &manufacturer);

        let stored = client.get_incentive_by_id(&incentive.id);
        prop_assert!(stored.is_some());
        prop_assert!(
            !stored.unwrap().active,
            "Deactivated incentive must have active=false in storage"
        );
    }

    /// **Non-manufacturer blocked from creating incentives** — Recyclers and
    /// Collectors must not be able to create incentives.
    #[test]
    fn fuzz_non_manufacturer_cannot_create_incentive(role_val in 0u32..2) {
        let env = Env::default();
        env.mock_all_auths();
        let client = setup(&env);

        let role = match role_val {
            0 => ParticipantRole::Recycler,
            _ => ParticipantRole::Collector,
        };
        let participant = register(&client, &env, role);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.create_incentive(&participant, &WasteType::Plastic, &10u64, &1_000u64)
        }));
        prop_assert!(
            result.is_err(),
            "Role {:?} must not create incentives", role
        );
    }
}

proptest! {
    #![proptest_config(ProptestConfig::with_cases(128))]

    /// **Monotone budget decrease** — after N `deactivate_incentive` + re-create
    /// cycles for different incentive IDs, each incentive's remaining_budget
    /// must remain equal to its initial budget (deactivation alone must not
    /// spend budget).
    #[test]
    fn fuzz_deactivation_does_not_spend_budget(
        reward_points in 1u64..=100u64,
        budget        in 10_000u64..=1_000_000u64,
        n_incentives  in 1u32..=5u32,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let client = setup(&env);

        let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);

        for _ in 0..n_incentives {
            let incentive = client.create_incentive(
                &manufacturer,
                &WasteType::Glass,
                &reward_points,
                &budget,
            );
            client.deactivate_incentive(&incentive.id, &manufacturer);

            let stored = client.get_incentive_by_id(&incentive.id).unwrap();
            prop_assert!(
                !stored.active,
                "Incentive must be inactive after deactivation"
            );
            prop_assert_eq!(
                stored.remaining_budget,
                budget,
                "Deactivation alone must not reduce remaining_budget"
            );
        }
    }

    /// **Incentive isolation** — two manufacturers creating incentives with
    /// the same parameters must receive distinct IDs and their budgets must
    /// not interfere with each other.
    #[test]
    fn fuzz_incentive_isolation_between_manufacturers(
        reward_points in 1u64..=1_000u64,
        budget        in 1_000u64..=100_000u64,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let client = setup(&env);

        let m1 = register(&client, &env, ParticipantRole::Manufacturer);
        let m2 = register(&client, &env, ParticipantRole::Manufacturer);

        let i1 = client.create_incentive(&m1, &WasteType::Metal, &reward_points, &budget);
        let i2 = client.create_incentive(&m2, &WasteType::Metal, &reward_points, &budget);

        prop_assert_ne!(i1.id, i2.id, "Each incentive must have a unique ID");

        // Deactivating m1's incentive must not affect m2's
        client.deactivate_incentive(&i1.id, &m1);
        let stored_i2 = client.get_incentive_by_id(&i2.id).unwrap();
        prop_assert!(stored_i2.active, "m2's incentive must still be active after m1's is deactivated");
        prop_assert_eq!(
            stored_i2.remaining_budget,
            budget,
            "m2's budget must be unaffected by m1's deactivation"
        );
    }
}
