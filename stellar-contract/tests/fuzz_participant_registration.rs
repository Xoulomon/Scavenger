use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

proptest! {
    #[test]
    fn fuzz_participant_registration_valid_inputs(
        name in ".*",
        lat in -90.0f64..=90.0f64,
        lon in -180.0f64..=180.0f64,
    ) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let participant = Address::generate(&env);

        client.initialize_admin(&admin);

        // Should not panic with valid inputs
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.register_participant(
                &participant,
                &0i32,
                &name,
                &(lat as i32),
                &(lon as i32),
            )
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_participant_registration_boundary_coordinates(
        lat in -90i32..=90i32,
        lon in -180i32..=180i32,
    ) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let participant = Address::generate(&env);

        client.initialize_admin(&admin);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.register_participant(
                &participant,
                &0i32,
                &"Test".to_string(),
                &lat,
                &lon,
            )
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_participant_registration_all_roles(role in 0i32..=2i32) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let participant = Address::generate(&env);

        client.initialize_admin(&admin);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.register_participant(
                &participant,
                &role,
                &"Test".to_string(),
                &40i32,
                &-74i32,
            )
        }));

        prop_assert!(result.is_ok());
    }
}
