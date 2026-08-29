#![cfg(test)]
//! Fuzz target — transfer path authorization and state integrity (Issue #1104)
//!
//! Extends coverage beyond `test_reward_fuzz.rs` (which only covers reward
//! math) to the high-risk transfer path.
//!
//! # Invariants verified
//! 1. **Auth invariant**: a non-owner can never successfully call
//!    `transfer_waste_v2`, regardless of their role.
//! 2. **Self-transfer invariant**: `from == to` is always rejected.
//! 3. **Route invariant**: invalid role combinations are always rejected and
//!    ownership is left unchanged.
//! 4. **State immutability on failure**: a failed transfer never mutates
//!    `current_owner`.
//! 5. **Sequential ownership**: a full Recycler → Collector → Manufacturer
//!    chain always succeeds and produces the correct final owner.
//!
//! # Fuzz-run cadence
//! Run locally before each release:
//! ```sh
//! cargo test --test fuzz_transfer_authorization -- --nocapture
//! ```
//! For extended sessions use `cargo test ... -- --proptest-cases 10000`.

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

fn create_waste(client: &ScavengerContractClient<'_>, recycler: &Address, weight: u64) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &weight, recycler, &0i128, &0i128)
}

// ── Fuzz 1: unauthorized sender ──────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    /// **Auth invariant** — for any random pair of participants, a non-owner
    /// that tries to transfer waste it does not own must be rejected.
    /// The `current_owner` must remain unchanged after the failed call.
    #[test]
    fn fuzz_non_owner_cannot_transfer(
        weight in 100u64..10_000,
        impostor_role_val in 0u32..3,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let client = setup(&env);

        let recycler = register(&client, &env, ParticipantRole::Recycler);
        let collector = register(&client, &env, ParticipantRole::Collector);

        let impostor_role = match impostor_role_val {
            0 => ParticipantRole::Recycler,
            1 => ParticipantRole::Collector,
            _ => ParticipantRole::Manufacturer,
        };
        let impostor = register(&client, &env, impostor_role);

        let waste_id = create_waste(&client, &recycler, weight);

        // Impostor attempts transfer — must fail
        let result = client.try_transfer_waste_v2(&waste_id, &impostor, &collector, &0i128, &0i128);
        prop_assert!(
            result.is_err(),
            "Non-owner impostor (role {:?}) must not transfer waste",
            impostor_role
        );

        // State must not change
        let waste = client.get_waste_v2(&waste_id);
        prop_assert!(waste.is_some());
        prop_assert_eq!(
            waste.unwrap().current_owner,
            recycler,
            "Owner must remain recycler after failed non-owner transfer"
        );
    }

    /// **Self-transfer invariant** — regardless of weight, a self-transfer
    /// must always be rejected and ownership must remain unchanged.
    #[test]
    fn fuzz_self_transfer_always_rejected(weight in 100u64..10_000) {
        let env = Env::default();
        env.mock_all_auths();
        let client = setup(&env);

        let recycler = register(&client, &env, ParticipantRole::Recycler);
        let waste_id = create_waste(&client, &recycler, weight);

        let result = client.try_transfer_waste_v2(&waste_id, &recycler, &recycler, &0i128, &0i128);
        prop_assert!(result.is_err(), "Self-transfer must always be rejected (weight={weight})");

        let waste = client.get_waste_v2(&waste_id);
        prop_assert!(waste.is_some());
        prop_assert_eq!(waste.unwrap().current_owner, recycler);
    }

    /// **Route invariant with state immutability** — all 6 invalid role
    /// pairs must fail and must leave `current_owner` unchanged, for any
    /// valid weight in the corpus range.
    #[test]
    fn fuzz_invalid_route_leaves_owner_unchanged(weight in 100u64..5_000) {
        // (from_role, to_role) pairs that are always invalid
        let invalid_pairs: &[(ParticipantRole, ParticipantRole)] = &[
            (ParticipantRole::Recycler, ParticipantRole::Recycler),
            (ParticipantRole::Collector, ParticipantRole::Recycler),
            (ParticipantRole::Collector, ParticipantRole::Collector),
            (ParticipantRole::Manufacturer, ParticipantRole::Recycler),
            (ParticipantRole::Manufacturer, ParticipantRole::Collector),
            (ParticipantRole::Manufacturer, ParticipantRole::Manufacturer),
        ];

        for (from_role, to_role) in invalid_pairs {
            let env = Env::default();
            env.mock_all_auths();
            let client = setup(&env);

            let recycler = register(&client, &env, ParticipantRole::Recycler);
            let from  = register(&client, &env, *from_role);
            let to    = register(&client, &env, *to_role);

            // We need waste owned by `from`.  For non-Recycler senders, chain valid
            // transfers first so `from` legally holds the waste item.
            let waste_id = create_waste(&client, &recycler, weight);

            match from_role {
                ParticipantRole::Recycler => {
                    // `from` IS the recycler here, so `from == recycler` is not guaranteed.
                    // Just use a fresh recycler-owned waste.
                    let own_waste = create_waste(&client, &from, weight);
                    let result = client.try_transfer_waste_v2(&own_waste, &from, &to, &0i128, &0i128);
                    prop_assert!(
                        result.is_err(),
                        "Route {:?}→{:?} must fail", from_role, to_role
                    );
                    prop_assert_eq!(
                        client.get_waste_v2(&own_waste).unwrap().current_owner,
                        from
                    );
                },
                ParticipantRole::Collector => {
                    // recycler → collector first (valid), then test invalid onwards
                    client.transfer_waste_v2(&waste_id, &recycler, &from, &0i128, &0i128).unwrap();
                    let result = client.try_transfer_waste_v2(&waste_id, &from, &to, &0i128, &0i128);
                    prop_assert!(result.is_err(), "Route {:?}→{:?} must fail", from_role, to_role);
                    prop_assert_eq!(
                        client.get_waste_v2(&waste_id).unwrap().current_owner,
                        from
                    );
                },
                ParticipantRole::Manufacturer => {
                    // recycler → manufacturer first (valid), then test invalid onwards
                    client.transfer_waste_v2(&waste_id, &recycler, &from, &0i128, &0i128).unwrap();
                    let result = client.try_transfer_waste_v2(&waste_id, &from, &to, &0i128, &0i128);
                    prop_assert!(result.is_err(), "Route {:?}→{:?} must fail", from_role, to_role);
                    prop_assert_eq!(
                        client.get_waste_v2(&waste_id).unwrap().current_owner,
                        from
                    );
                },
            }
        }
    }

    /// **Sequential ownership invariant** — a Recycler → Collector → Manufacturer
    /// chain must always succeed and the waste must end up owned by the
    /// manufacturer, with an accurate two-entry transfer history.
    #[test]
    fn fuzz_valid_chain_transfer_ownership_is_sequential(weight in 100u64..5_000) {
        let env = Env::default();
        env.mock_all_auths();
        let client = setup(&env);

        let recycler     = register(&client, &env, ParticipantRole::Recycler);
        let collector    = register(&client, &env, ParticipantRole::Collector);
        let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);

        let waste_id = create_waste(&client, &recycler, weight);

        client.transfer_waste_v2(&waste_id, &recycler, &collector, &0i128, &0i128).unwrap();
        prop_assert_eq!(client.get_waste_v2(&waste_id).unwrap().current_owner, collector);

        client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &0i128, &0i128).unwrap();
        let final_waste = client.get_waste_v2(&waste_id).unwrap();
        prop_assert_eq!(final_waste.current_owner, manufacturer);

        let history = client.get_transfer_path_data(&waste_id);
        prop_assert_eq!(history.len(), 2, "Expected exactly 2 history entries after R→C→M");
    }
}
