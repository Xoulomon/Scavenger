use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

proptest! {
    #[test]
    fn fuzz_incentive_creation_valid_rewards(reward_points in 1u128..=u128::MAX) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let manufacturer = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&manufacturer, &2i32, &"Manufacturer".to_string(), &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.create_incentive(&manufacturer, &0i32, &reward_points, &1000u128)
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_incentive_creation_valid_budgets(budget in 1u128..=u128::MAX) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let manufacturer = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&manufacturer, &2i32, &"Manufacturer".to_string(), &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.create_incentive(&manufacturer, &0i32, &100u128, &budget)
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_incentive_creation_all_waste_types(waste_type in 0i32..=4i32) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let manufacturer = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&manufacturer, &2i32, &"Manufacturer".to_string(), &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.create_incentive(&manufacturer, &waste_type, &100u128, &1000u128)
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_incentive_update_valid_values(
        reward_points in 1u128..=u128::MAX,
        budget in 1u128..=u128::MAX,
    ) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let manufacturer = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&manufacturer, &2i32, &"Manufacturer".to_string(), &40i32, &-74i32);

        client.create_incentive(&manufacturer, &0i32, &100u128, &1000u128);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.update_incentive(&0u64, &manufacturer, &reward_points, &budget)
        }));

        prop_assert!(result.is_ok());
    }

    #[test]
    fn fuzz_multiple_incentives_per_manufacturer(count in 1usize..=50usize) {
        let env = Env::default();
        let contract_id = env.register_contract(None, stellar_scavngr_contract::Contract);
        let client = stellar_scavngr_contract::Client::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let manufacturer = Address::generate(&env);

        client.initialize_admin(&admin);
        client.register_participant(&manufacturer, &2i32, &"Manufacturer".to_string(), &40i32, &-74i32);

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            for i in 0..count {
                client.create_incentive(&manufacturer, &(i as i32 % 5), &100u128, &1000u128);
            }
        }));

        prop_assert!(result.is_ok());
    }
}
