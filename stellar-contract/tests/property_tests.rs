#![cfg(test)]

use proptest::prelude::*;
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String as SorobanString};
use stellar_scavngr_contract::{
    calculate_carbon_credits, CertificationLevel, ParticipantRole, ScavengerContract, ScavengerContractClient,
    WasteType,
};

fn setup_env() -> (Env, ScavengerContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);
    (env, client, admin)
}

// ─── Type system roundtrip properties ───────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(256))]

    #[test]
    fn waste_type_roundtrip(v in 0u32..7) {
        let wt = WasteType::from_u32(v).unwrap();
        prop_assert_eq!(wt.to_u32(), v);
    }

    #[test]
    fn waste_type_invalid_rejected(v in 7u32..100) {
        prop_assert!(WasteType::from_u32(v).is_none());
    }

    #[test]
    fn participant_role_roundtrip(v in 0u32..3) {
        let role = ParticipantRole::from_u32(v).unwrap();
        prop_assert_eq!(role.to_u32(), v);
    }

    #[test]
    fn participant_role_invalid_rejected(v in 3u32..100) {
        prop_assert!(ParticipantRole::from_u32(v).is_none());
    }

    #[test]
    fn certification_level_monotonic(a in 0u128..500, b in 0u128..500) {
        let cert_a = CertificationLevel::from_waste_count(a);
        let cert_b = CertificationLevel::from_waste_count(b);
        if a <= b {
            prop_assert!((cert_a as u32) <= (cert_b as u32));
        }
    }

    #[test]
    fn carbon_credits_proportional_to_weight(
        wt_val in 0u32..7,
        w1 in 1u128..100_000,
        w2 in 1u128..100_000,
    ) {
        let wt = WasteType::from_u32(wt_val).unwrap();
        let c1 = calculate_carbon_credits(wt, w1);
        let c2 = calculate_carbon_credits(wt, w2);
        if w1 <= w2 {
            prop_assert!(c1 <= c2, "credits should increase with weight");
        }
    }

    #[test]
    fn carbon_credits_zero_for_zero_weight(wt_val in 0u32..7) {
        let wt = WasteType::from_u32(wt_val).unwrap();
        prop_assert_eq!(calculate_carbon_credits(wt, 0), 0);
    }

    #[test]
    fn waste_type_valid_range(v in 0u32..7) {
        prop_assert!(WasteType::is_valid(v));
    }

    #[test]
    fn certification_from_waste_count_covers_all_levels(count in 0u128..1000) {
        let cert = CertificationLevel::from_waste_count(count);
        let expected = match count {
            0..=10 => CertificationLevel::Beginner,
            11..=50 => CertificationLevel::Intermediate,
            51..=200 => CertificationLevel::Advanced,
            _ => CertificationLevel::Expert,
        };
        prop_assert_eq!(cert, expected);
    }
}

// ─── Waste submission count invariant ───────────────────────────────────────

proptest! {
    #![proptest_config(ProptestConfig::with_cases(64))]

    #[test]
    fn waste_count_matches_submissions(n in 1u32..8) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ScavengerContract);
        let client = ScavengerContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize_admin(&admin);

        let participant = Address::generate(&env);
        client.register_participant(
            &participant,
            &ParticipantRole::Recycler,
            &symbol_short!("Test"),
            &0i128,
            &0i128,
        );

        let desc = SorobanString::from_str(&env, "prop");
        for _ in 0..n {
            client.submit_material(&WasteType::Paper, &1000u64, &participant, &desc);
        }

        let wastes = client.get_participant_wastes(&participant);
        prop_assert_eq!(wastes.len(), n);
    }

    #[test]
    fn submitted_waste_preserves_type_and_weight(
        wt_val in 0u32..7,
        weight in 100u64..100_000,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ScavengerContract);
        let client = ScavengerContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize_admin(&admin);

        let participant = Address::generate(&env);
        client.register_participant(
            &participant,
            &ParticipantRole::Recycler,
            &symbol_short!("Test"),
            &0i128,
            &0i128,
        );

        let wt = WasteType::from_u32(wt_val).unwrap();
        let desc = SorobanString::from_str(&env, "prop");
        let material = client.submit_material(&wt, &weight, &participant, &desc);

        prop_assert_eq!(material.waste_type, wt);
        prop_assert_eq!(material.weight, weight);
        prop_assert_eq!(material.submitter, participant);
    }

    #[test]
    fn transfer_preserves_waste_properties(weight in 100u64..50_000) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ScavengerContract);
        let client = ScavengerContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize_admin(&admin);

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

        let desc = SorobanString::from_str(&env, "prop");
        let material = client.submit_material(&WasteType::Metal, &weight, &recycler, &desc);
        let note = SorobanString::from_str(&env, "xfer");
        let transferred = client.transfer_waste(&material.id, &recycler, &collector, &note);

        prop_assert_eq!(transferred.waste_type, WasteType::Metal);
        prop_assert_eq!(transferred.weight, weight);
        prop_assert_eq!(transferred.submitter, collector);
    }

    #[test]
    fn registration_with_valid_coordinates(
        lat in -90_000_000i128..=90_000_000i128,
        lon in -180_000_000i128..=180_000_000i128,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ScavengerContract);
        let client = ScavengerContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize_admin(&admin);

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
        prop_assert!(result.is_ok(), "Valid coordinates should be accepted");
    }

    #[test]
    fn incentive_budget_preserved_on_creation(
        reward_points in 1u64..1000,
        budget in 1u64..1_000_000,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ScavengerContract);
        let client = ScavengerContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize_admin(&admin);

        let manufacturer = Address::generate(&env);
        client.register_participant(
            &manufacturer,
            &ParticipantRole::Manufacturer,
            &symbol_short!("Mfr"),
            &0i128,
            &0i128,
        );

        let incentive = client.create_incentive(
            &manufacturer,
            &WasteType::Paper,
            &reward_points,
            &budget,
        );

        prop_assert_eq!(incentive.remaining_budget, incentive.total_budget);
        prop_assert_eq!(incentive.total_budget, budget);
        prop_assert!(incentive.active);
    }

    #[test]
    fn metrics_waste_count_increments(n in 1u32..6) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ScavengerContract);
        let client = ScavengerContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize_admin(&admin);

        let participant = Address::generate(&env);
        client.register_participant(
            &participant,
            &ParticipantRole::Recycler,
            &symbol_short!("Test"),
            &0i128,
            &0i128,
        );

        let desc = SorobanString::from_str(&env, "prop");
        for _ in 0..n {
            client.submit_material(&WasteType::Glass, &500u64, &participant, &desc);
        }

        let metrics = client.get_metrics();
        prop_assert!(metrics.total_wastes_count >= n as u64);
    }

    #[test]
    fn double_registration_panics(role in 0u32..3) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ScavengerContract);
        let client = ScavengerContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize_admin(&admin);

        let participant = Address::generate(&env);
        let pr = ParticipantRole::from_u32(role).unwrap();
        client.register_participant(
            &participant,
            &pr,
            &symbol_short!("First"),
            &0i128,
            &0i128,
        );

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.register_participant(
                &participant,
                &pr,
                &symbol_short!("Again"),
                &0i128,
                &0i128,
            );
        }));
        prop_assert!(result.is_err(), "Double registration should panic");
    }

    #[test]
    fn multiple_waste_types_tracked_independently(
        wt1_val in 0u32..7,
        wt2_val in 0u32..7,
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, ScavengerContract);
        let client = ScavengerContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize_admin(&admin);

        let participant = Address::generate(&env);
        client.register_participant(
            &participant,
            &ParticipantRole::Recycler,
            &symbol_short!("Multi"),
            &0i128,
            &0i128,
        );

        let wt1 = WasteType::from_u32(wt1_val).unwrap();
        let wt2 = WasteType::from_u32(wt2_val).unwrap();
        let desc = SorobanString::from_str(&env, "prop");

        let m1 = client.submit_material(&wt1, &1000u64, &participant, &desc);
        let m2 = client.submit_material(&wt2, &2000u64, &participant, &desc);

        prop_assert_eq!(m1.waste_type, wt1);
        prop_assert_eq!(m2.waste_type, wt2);
        prop_assert_ne!(m1.id, m2.id);

        let wastes = client.get_participant_wastes(&participant);
        prop_assert_eq!(wastes.len(), 2);
    }
}
