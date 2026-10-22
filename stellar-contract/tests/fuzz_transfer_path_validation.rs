use proptest::prelude::*;
use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{Contract, ContractClient};
use stellar_scavngr_contract::types::ParticipantRole;

// Strategy for generating valid participant roles
fn valid_role_strategy() -> impl Strategy<Value = i32> {
    prop_oneof![
        Just(0i32), // Recycler
        Just(1i32), // Collector
        Just(2i32), // Manufacturer
    ]
}

// Strategy for generating valid coordinate ranges
fn coordinate_strategy() -> impl Strategy<Value = i32> {
    -180i32..=180i32
}

// Strategy for latitude coordinate ranges
fn latitude_strategy() -> impl Strategy<Value = i32> {
    -90i32..=90i32
}

proptest! {
    /// Fuzz test: Valid transfer paths (Recycler→Collector, Recycler→Manufacturer, Collector→Manufacturer)
    /// This validates that all documented valid routes return true for is_valid_transfer
    #[test]
    fn fuzz_transfer_path_valid_routes(
        from_role in prop_oneof![Just(0i32), Just(1i32)], // Recycler or Collector
        to_role in Just(1i32..=2i32),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, Contract);
        let client = ContractClient::new(&env, &contract_id);

        let from = Address::generate(&env);
        let to = Address::generate(&env);

        // Register participants
        client.register_participant(&from, &from_role, &"from".to_string(), &40i32, &-74i32);
        client.register_participant(&to, &to_role, &to_role.to_string(), &40i32, &-74i32);

        // Valid pairs:
        // Recycler (0) -> Collector (1): valid
        // Recycler (0) -> Manufacturer (2): valid
        // Collector (1) -> Manufacturer (2): valid
        let is_valid = (from_role == 0 && (to_role == 1 || to_role == 2)) || 
                      (from_role == 1 && to_role == 2);

        if is_valid {
            prop_assert!(client.is_valid_transfer(&from, &to));
        }
    }

    /// Fuzz test: Invalid transfer paths with all role combinations
    /// This validates that all invalid routes are correctly rejected
    #[test]
    fn fuzz_transfer_path_invalid_routes(
        from_role in valid_role_strategy(),
        to_role in valid_role_strategy(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, Contract);
        let client = ContractClient::new(&env, &contract_id);

        let from = Address::generate(&env);
        let to = Address::generate(&env);

        // Register participants
        client.register_participant(&from, &from_role, &"from".to_string(), &40i32, &-74i32);
        client.register_participant(&to, &to_role, &to_role.to_string(), &40i32, &-74i32);

        // Valid pairs: (0→1), (0→2), (1→2)
        let is_valid = (from_role == 0 && (to_role == 1 || to_role == 2)) || 
                      (from_role == 1 && to_role == 2);

        let result = client.is_valid_transfer(&from, &to);
        prop_assert_eq!(result, is_valid);
    }

    /// Fuzz test: Unregistered participants in transfer path validation
    /// This validates that unregistered addresses cause is_valid_transfer to return false
    #[test]
    fn fuzz_transfer_path_unregistered_participants(
        from_registered in (0i32..=2i32, any::<bool>()),
        to_registered in (0i32..=2i32, any::<bool>()),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, Contract);
        let client = ContractClient::new(&env, &contract_id);

        let from = Address::generate(&env);
        let to = Address::generate(&env);

        let (from_role, from_reg) = from_registered;
        let (to_role, to_reg) = to_registered;

        if from_reg {
            client.register_participant(&from, &from_role, &"from".to_string(), &40i32, &-74i32);
        }
        if to_reg {
            client.register_participant(&to, &to_role, &to_role.to_string(), &40i32, &-74i32);
        }

        let result = client.is_valid_transfer(&from, &to);

        // Valid only if both are registered AND route is valid
        let is_valid_route = (from_role == 0 && (to_role == 1 || to_role == 2)) || 
                            (from_role == 1 && to_role == 2);
        let should_be_valid = from_reg && to_reg && is_valid_route;

        prop_assert_eq!(result, should_be_valid);
    }

    /// Fuzz test: Transfer path validation with coordinate variations
    /// This ensures transfer path validation is independent of coordinate data
    #[test]
    fn fuzz_transfer_path_with_coordinates(
        lat in latitude_strategy(),
        lon in coordinate_strategy(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, Contract);
        let client = ContractClient::new(&env, &contract_id);

        let recycler = Address::generate(&env);
        let collector = Address::generate(&env);

        // Register participants with variable coordinates
        client.register_participant(&recycler, &0i32, &"recycler".to_string(), &lat, &lon);
        client.register_participant(&collector, &1i32, &"collector".to_string(), &lat, &lon);

        // Recycler->Collector should always be valid regardless of coordinates
        prop_assert!(client.is_valid_transfer(&recycler, &collector));
    }

    /// Fuzz test: Waste transfer with valid paths and various coordinates
    /// This validates that transfers succeed over valid paths regardless of coordinates
    #[test]
    fn fuzz_waste_transfer_valid_path(
        lat in latitude_strategy(),
        lon in coordinate_strategy(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, Contract);
        let client = ContractClient::new(&env, &contract_id);

        let recycler = Address::generate(&env);
        let collector = Address::generate(&env);

        client.register_participant(&recycler, &0i32, &"recycler".to_string(), &40i32, &-74i32);
        client.register_participant(&collector, &1i32, &"collector".to_string(), &lat, &lon);

        // Create waste as recycler
        let waste_id = client.recycle_waste(&0i32, &1000u128, &recycler, &40i32, &-74i32);

        // Transfer should succeed for valid path
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.transfer_waste_v2(&waste_id, &recycler, &collector, &lat, &lon)
        }));

        prop_assert!(result.is_ok(), "Valid transfer path should not panic");
    }

    /// Fuzz test: Deregistered participants in transfer validation
    /// This validates that deregistered participants cause validation to fail
    #[test]
    fn fuzz_transfer_path_deregistered_participants(
        deregister_from in any::<bool>(),
        deregister_to in any::<bool>(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, Contract);
        let client = ContractClient::new(&env, &contract_id);

        let recycler = Address::generate(&env);
        let collector = Address::generate(&env);

        // Register both
        client.register_participant(&recycler, &0i32, &"recycler".to_string(), &40i32, &-74i32);
        client.register_participant(&collector, &1i32, &"collector".to_string(), &40i32, &-74i32);

        // Deregister as specified
        if deregister_from {
            client.deregister_participant(&recycler);
        }
        if deregister_to {
            client.deregister_participant(&collector);
        }

        let result = client.is_valid_transfer(&recycler, &collector);

        // Should only be valid if neither was deregistered
        let should_be_valid = !deregister_from && !deregister_to;
        prop_assert_eq!(result, should_be_valid);
    }

    /// Fuzz test: Multi-hop transfer path validation (Recycler→Collector→Manufacturer)
    /// This validates that valid sequential transfers maintain state correctly
    #[test]
    fn fuzz_transfer_path_multi_hop(
        lat in latitude_strategy(),
        lon in coordinate_strategy(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, Contract);
        let client = ContractClient::new(&env, &contract_id);

        let recycler = Address::generate(&env);
        let collector = Address::generate(&env);
        let manufacturer = Address::generate(&env);

        client.register_participant(&recycler, &0i32, &"recycler".to_string(), &40i32, &-74i32);
        client.register_participant(&collector, &1i32, &"collector".to_string(), &40i32, &-74i32);
        client.register_participant(&manufacturer, &2i32, &"manufacturer".to_string(), &lat, &lon);

        // Create waste
        let waste_id = client.recycle_waste(&0i32, &1000u128, &recycler, &40i32, &-74i32);

        // Verify paths are valid
        prop_assert!(client.is_valid_transfer(&recycler, &collector));
        prop_assert!(client.is_valid_transfer(&collector, &manufacturer));

        // First hop: recycler -> collector
        client.transfer_waste_v2(&waste_id, &recycler, &collector, &40i32, &-74i32);
        let waste = client.get_waste_v2(&waste_id).unwrap();
        prop_assert_eq!(waste.current_owner, collector);

        // Second hop: collector -> manufacturer
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &lat, &lon)
        }));

        prop_assert!(result.is_ok(), "Multi-hop transfer on valid paths should succeed");
    }

    /// Fuzz test: Waste transfer fails on invalid paths
    /// This validates that transfers are rejected for invalid role combinations
    #[test]
    fn fuzz_waste_transfer_invalid_path(
        from_role in valid_role_strategy(),
        to_role in valid_role_strategy(),
    ) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register_contract(None, Contract);
        let client = ContractClient::new(&env, &contract_id);

        let from = Address::generate(&env);
        let to = Address::generate(&env);

        client.register_participant(&from, &from_role, &"from".to_string(), &40i32, &-74i32);
        client.register_participant(&to, &to_role, &to_role.to_string(), &40i32, &-74i32);

        // Only recycler can create waste
        if from_role == 0 {
            let waste_id = client.recycle_waste(&0i32, &1000u128, &from, &40i32, &-74i32);

            let is_valid_path = (from_role == 0 && (to_role == 1 || to_role == 2)) || 
                               (from_role == 1 && to_role == 2);

            let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                client.transfer_waste_v2(&waste_id, &from, &to, &40i32, &-74i32)
            }));

            if !is_valid_path {
                // Invalid path should fail
                prop_assert!(result.is_err() || !result.unwrap(), 
                            "Invalid transfer path should fail");
            }
        }
    }
}
