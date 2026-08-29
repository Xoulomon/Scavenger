use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

proptest! {
    #[test]
    fn fuzz_waste_submission_valid_weights(weight in 1u128..=u128::MAX) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let submitter = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&submitter, &0i32, &"Recycler".to_string(), &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.submit_material(&submitter, &0i32, &weight, &40i32, &-74i32)
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_waste_submission_all_waste_types(waste_type in 0i32..=4i32) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let submitter = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&submitter, &0i32, &"Recycler".to_string(), &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.submit_material(&submitter, &waste_type, &100u128, &40i32, &-74i32)
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_waste_submission_boundary_coordinates(
        lat in -90i32..=90i32,
        lon in -180i32..=180i32,
    ) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let submitter = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&submitter, &0i32, &"Recycler".to_string(), &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.submit_material(&submitter, &0i32, &100u128, &lat, &lon)
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_batch_waste_submission(batch_size in 1usize..=100usize) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let submitter = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&submitter, &0i32, &"Recycler".to_string(), &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            for _ in 0..batch_size {
                client.submit_material(&submitter, &0i32, &100u128, &40i32, &-74i32);
            }
        }));

        prop_assert!(result.is_ok());
    }
}
