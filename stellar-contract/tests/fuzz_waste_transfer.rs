use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

proptest! {
    #[test]
    fn fuzz_waste_transfer_valid_ids(waste_id in 0u64..=1000u64) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let from = Address::generate(&env);
        let to = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&from, &0i32, &"Recycler".to_string(), &40i32, &-74i32);
        client.register_participant(&to, &1i32, &"Collector".to_string(), &40i32, &-74i32);

        // Submit waste first
        client.submit_material(&from, &0i32, &100u128, &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.transfer_waste(&waste_id, &from, &to, &40i32, &-74i32, &"Transfer".to_string())
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_waste_transfer_boundary_coordinates(
        lat in -90i32..=90i32,
        lon in -180i32..=180i32,
    ) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let from = Address::generate(&env);
        let to = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&from, &0i32, &"Recycler".to_string(), &40i32, &-74i32);
        client.register_participant(&to, &1i32, &"Collector".to_string(), &40i32, &-74i32);

        client.submit_material(&from, &0i32, &100u128, &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.transfer_waste(&0u64, &from, &to, &lat, &lon, &"Transfer".to_string())
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_waste_transfer_note_lengths(note_len in 0usize..=1000usize) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let from = Address::generate(&env);
        let to = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&from, &0i32, &"Recycler".to_string(), &40i32, &-74i32);
        client.register_participant(&to, &1i32, &"Collector".to_string(), &40i32, &-74i32);

        client.submit_material(&from, &0i32, &100u128, &40i32, &-74i32);

        let note = "x".repeat(note_len);
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.transfer_waste(&0u64, &from, &to, &40i32, &-74i32, &note)
        }));

        prop_assert!(result.is_ok());
    }
}
