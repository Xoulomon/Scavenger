use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

proptest! {
    #[test]
    fn fuzz_participant_role_updates(new_role in 0i32..=2i32) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let participant = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&participant, &0i32, &"Test".to_string(), &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.update_role(&participant, &new_role)
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_waste_confirmation_state(waste_id in 0u64..=100u64) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let submitter = Address::generate(&env);
        let confirmer = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&submitter, &0i32, &"Recycler".to_string(), &40i32, &-74i32);
        client.register_participant(&confirmer, &1i32, &"Collector".to_string(), &40i32, &-74i32);

        client.submit_material(&submitter, &0i32, &100u128, &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.confirm_waste_details(&waste_id, &confirmer)
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_waste_reset_confirmation(waste_id in 0u64..=100u64) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let owner = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&owner, &0i32, &"Recycler".to_string(), &40i32, &-74i32);

        client.submit_material(&owner, &0i32, &100u128, &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.reset_waste_confirmation(&waste_id, &owner)
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_waste_deactivation(waste_id in 0u64..=100u64) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);

        client.initialize_admin(&admin);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.deactivate_waste(&admin, &waste_id)
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_incentive_deactivation(incentive_id in 0u64..=100u64) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let manufacturer = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&manufacturer, &2i32, &"Manufacturer".to_string(), &40i32, &-74i32);

        client.create_incentive(&manufacturer, &0i32, &100u128, &1000u128);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.deactivate_incentive(&incentive_id, &manufacturer)
        }));

        prop_assert!(result.is_ok());
    }
}
