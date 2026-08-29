#![cfg(test)]

use proptest::prelude::*;
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String as SorobanString};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}

// ─── Boundary value fuzzing ────────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(128))]

    #[test]
    fn fuzz_extreme_weights(weight in prop::sample::select(vec![
        0u64, 1, 99, 100, 101, 999, 1000, 10_000, 100_000, 1_000_000,
        u64::MAX / 2, u64::MAX - 1,
    ])) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let participant = Address::generate(&env);
        client.register_participant(
            &participant,
            &ParticipantRole::Recycler,
            &symbol_short!("Fuzz"),
            &0i128,
            &0i128,
        );
        let desc = SorobanString::from_str(&env, "fuzz");
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.submit_material(&WasteType::Paper, &weight, &participant, &desc);
        }));
        // Should either succeed or panic gracefully (no UB)
        let _ = result;
    }

    #[test]
    fn fuzz_all_waste_type_values(wt_val in 0u32..20) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let participant = Address::generate(&env);
        client.register_participant(
            &participant,
            &ParticipantRole::Recycler,
            &symbol_short!("Fuzz"),
            &0i128,
            &0i128,
        );
        let desc = SorobanString::from_str(&env, "fuzz");
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let wt = WasteType::from_u32(wt_val).expect("invalid waste type");
            client.submit_material(&wt, &1000u64, &participant, &desc);
        }));
        if wt_val < 7 {
            prop_assert!(result.is_ok(), "Valid waste type {} should work", wt_val);
        } else {
            prop_assert!(result.is_err(), "Invalid waste type {} should fail", wt_val);
        }
    }

    #[test]
    fn fuzz_all_role_values(role_val in 0u32..10) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let participant = Address::generate(&env);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let role = ParticipantRole::from_u32(role_val).expect("invalid role");
            client.register_participant(
                &participant,
                &role,
                &symbol_short!("Fuzz"),
                &0i128,
                &0i128,
            );
        }));
        if role_val < 3 {
            prop_assert!(result.is_ok(), "Valid role {} should work", role_val);
        } else {
            prop_assert!(result.is_err(), "Invalid role {} should fail", role_val);
        }
    }

    #[test]
    fn fuzz_coordinate_boundaries(
        lat in prop::sample::select(vec![
            -90_000_001i128, -90_000_000, -1, 0, 1, 90_000_000, 90_000_001,
        ]),
        lon in prop::sample::select(vec![
            -180_000_001i128, -180_000_000, -1, 0, 1, 180_000_000, 180_000_001,
        ]),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let participant = Address::generate(&env);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.register_participant(
                &participant,
                &ParticipantRole::Recycler,
                &symbol_short!("Coord"),
                &lat,
                &lon,
            );
        }));
        let lat_valid = lat >= -90_000_000 && lat <= 90_000_000;
        let lon_valid = lon >= -180_000_000 && lon <= 180_000_000;
        if lat_valid && lon_valid {
            prop_assert!(result.is_ok(), "Valid coords ({}, {}) should succeed", lat, lon);
        }
    }
}

// ─── State transition fuzzing ──────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    #[test]
    fn fuzz_submit_then_transfer_immediately(weight in 100u64..10_000) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);

        let recycler = Address::generate(&env);
        let collector = Address::generate(&env);
        client.register_participant(
            &recycler,
            &ParticipantRole::Recycler,
            &symbol_short!("From"),
            &0i128,
            &0i128,
        );
        client.register_participant(
            &collector,
            &ParticipantRole::Collector,
            &symbol_short!("To"),
            &0i128,
            &0i128,
        );

        let desc = SorobanString::from_str(&env, "fuzz");
        let material = client.submit_material(&WasteType::Plastic, &weight, &recycler, &desc);
        let note = SorobanString::from_str(&env, "xfer");
        let transferred = client.transfer_waste(&material.id, &recycler, &collector, &note);
        prop_assert_eq!(transferred.submitter, collector);
    }

    #[test]
    fn fuzz_double_transfer_fails(weight in 100u64..5_000) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);

        let recycler = Address::generate(&env);
        let collector1 = Address::generate(&env);
        let collector2 = Address::generate(&env);
        client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("R"), &0i128, &0i128);
        client.register_participant(&collector1, &ParticipantRole::Collector, &symbol_short!("C1"), &0i128, &0i128);
        client.register_participant(&collector2, &ParticipantRole::Collector, &symbol_short!("C2"), &0i128, &0i128);

        let desc = SorobanString::from_str(&env, "fuzz");
        let material = client.submit_material(&WasteType::Glass, &weight, &recycler, &desc);
        let note = SorobanString::from_str(&env, "t");
        client.transfer_waste(&material.id, &recycler, &collector1, &note);

        // Second transfer by original owner should fail
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.transfer_waste(&material.id, &recycler, &collector2, &note);
        }));
        prop_assert!(result.is_err(), "Double transfer by original owner should fail");
    }

    #[test]
    fn fuzz_transfer_nonexistent_waste(waste_id in 1000u64..9999) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);

        let recycler = Address::generate(&env);
        let collector = Address::generate(&env);
        client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("R"), &0i128, &0i128);
        client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("C"), &0i128, &0i128);

        let note = SorobanString::from_str(&env, "t");
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.transfer_waste(&waste_id, &recycler, &collector, &note);
        }));
        prop_assert!(result.is_err(), "Transfer of nonexistent waste should fail");
    }

    #[test]
    fn fuzz_operations_on_unregistered_participant(wt_val in 0u32..7) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let unregistered = Address::generate(&env);
        let wt = WasteType::from_u32(wt_val).unwrap();
        let desc = SorobanString::from_str(&env, "fuzz");

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.submit_material(&wt, &1000u64, &unregistered, &desc);
        }));
        prop_assert!(result.is_err(), "Unregistered participant should not submit");
    }

    #[test]
    fn fuzz_rapid_sequential_submissions(n in 1u32..15) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let participant = Address::generate(&env);
        client.register_participant(&participant, &ParticipantRole::Recycler, &symbol_short!("Seq"), &0i128, &0i128);

        let desc = SorobanString::from_str(&env, "fuzz");
        let mut ids = std::collections::HashSet::new();
        for _ in 0..n {
            let m = client.submit_material(&WasteType::Paper, &500u64, &participant, &desc);
            ids.insert(m.id);
        }
        prop_assert_eq!(ids.len() as u32, n, "All waste IDs should be unique");
    }
}

// ─── Multi-participant fuzzing ─────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(32))]

    #[test]
    fn fuzz_chain_transfer(weight in 100u64..5_000) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);

        let recycler = Address::generate(&env);
        let collector = Address::generate(&env);
        let manufacturer = Address::generate(&env);
        client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("R"), &0i128, &0i128);
        client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("C"), &0i128, &0i128);
        client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("M"), &0i128, &0i128);

        let desc = SorobanString::from_str(&env, "chain");
        let m = client.submit_material(&WasteType::Metal, &weight, &recycler, &desc);

        let note = SorobanString::from_str(&env, "t");
        let m = client.transfer_waste(&m.id, &recycler, &collector, &note);
        prop_assert_eq!(m.submitter, collector.clone());

        let m = client.transfer_waste(&m.id, &collector, &manufacturer, &note);
        prop_assert_eq!(m.submitter, manufacturer);
        prop_assert_eq!(m.weight, weight);
    }

    #[test]
    fn fuzz_self_transfer_fails(weight in 100u64..5_000) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);

        let participant = Address::generate(&env);
        client.register_participant(&participant, &ParticipantRole::Recycler, &symbol_short!("Self"), &0i128, &0i128);

        let desc = SorobanString::from_str(&env, "self");
        let m = client.submit_material(&WasteType::Paper, &weight, &participant, &desc);
        let note = SorobanString::from_str(&env, "t");
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.transfer_waste(&m.id, &participant, &participant, &note);
        }));
        prop_assert!(result.is_err(), "Self-transfer should fail");
    }

    #[test]
    fn fuzz_multiple_participants_submit_independently(n_participants in 2u32..5) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);

        let mut participants = Vec::new();
        for i in 0..n_participants {
            let p = Address::generate(&env);
            let name_str = if i == 0 { "P0" } else if i == 1 { "P1" } else if i == 2 { "P2" } else { "P3" };
            client.register_participant(
                &p,
                &ParticipantRole::Recycler,
                &soroban_sdk::Symbol::new(&env, name_str),
                &0i128,
                &0i128,
            );
            participants.push(p);
        }

        let desc = SorobanString::from_str(&env, "multi");
        for p in &participants {
            client.submit_material(&WasteType::Organic, &1000u64, p, &desc);
            client.submit_material(&WasteType::Glass, &500u64, p, &desc);
        }

        for p in &participants {
            let wastes = client.get_participant_wastes(p);
            prop_assert_eq!(wastes.len(), 2);
        }
    }
}

// ─── Incentive system fuzzing ──────────────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    #[test]
    fn fuzz_incentive_extreme_values(
        reward in prop::sample::select(vec![1u64, 100, u64::MAX / 2, u64::MAX]),
        budget in prop::sample::select(vec![1u64, 1000, u64::MAX / 2, u64::MAX]),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let manufacturer = Address::generate(&env);
        client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &0i128, &0i128);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.create_incentive(&manufacturer, &WasteType::Paper, &reward, &budget);
        }));
        let _ = result; // Should not cause UB regardless
    }

    #[test]
    fn fuzz_incentive_non_manufacturer_fails(role_val in 0u32..2) {
        let env = Env::default();
        env.mock_all_auths();
        let (client, _admin) = setup(&env);
        let role = ParticipantRole::from_u32(role_val).unwrap();
        let participant = Address::generate(&env);
        client.register_participant(&participant, &role, &symbol_short!("NonM"), &0i128, &0i128);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.create_incentive(&participant, &WasteType::Paper, &10u64, &1000u64);
        }));
        prop_assert!(result.is_err(), "Non-manufacturer should not create incentives");
    }
}
