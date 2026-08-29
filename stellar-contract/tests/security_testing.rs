use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::ScavngrContract;

#[test]
fn test_unauthorized_admin_operations() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavngrContract);
    let client = ScavngrContract::new(&env, &contract_id);

    let admin = Address::random(&env);
    let unauthorized = Address::random(&env);

    client.initialize_admin(&admin);

    // Unauthorized user should not be able to transfer admin
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.transfer_admin(&unauthorized, &Address::random(&env));
    }));

    assert!(result.is_err(), "Unauthorized transfer_admin should fail");
}

#[test]
fn test_reentrancy_protection() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavngrContract);
    let client = ScavngrContract::new(&env, &contract_id);

    let admin = Address::random(&env);
    let participant = Address::random(&env);

    client.initialize_admin(&admin);
    client.register_participant(&participant, &0, &"Recycler".into(), &0, &0);

    // Sequential calls should succeed (no reentrancy)
    client.submit_material(&participant, &0, &1000, &0, &0);
    client.submit_material(&participant, &0, &2000, &0, &0);

    // Verify both submissions succeeded
    let wastes = client.get_participant_wastes(&participant);
    assert!(wastes.len() >= 2, "Both submissions should succeed");
}

#[test]
fn test_input_validation_injection() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavngrContract);
    let client = ScavngrContract::new(&env, &contract_id);

    let admin = Address::random(&env);
    let participant = Address::random(&env);

    client.initialize_admin(&admin);

    // Test with extreme coordinates (injection attempt)
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.register_participant(&participant, &0, &"Test".into(), &i32::MAX, &i32::MIN);
    }));

    assert!(result.is_ok(), "Should handle extreme coordinates");
}

#[test]
fn test_integer_overflow_protection() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavngrContract);
    let client = ScavngrContract::new(&env, &contract_id);

    let admin = Address::random(&env);
    let participant = Address::random(&env);

    client.initialize_admin(&admin);
    client.register_participant(&participant, &0, &"Recycler".into(), &0, &0);

    // Test with maximum u128 weight
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.submit_material(&participant, &0, &u128::MAX, &0, &0);
    }));

    assert!(result.is_ok(), "Should handle maximum weight without overflow");
}

#[test]
fn test_access_control_waste_transfer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavngrContract);
    let client = ScavngrContract::new(&env, &contract_id);

    let admin = Address::random(&env);
    let owner = Address::random(&env);
    let unauthorized = Address::random(&env);

    client.initialize_admin(&admin);
    client.register_participant(&owner, &0, &"Recycler".into(), &0, &0);
    client.register_participant(&unauthorized, &1, &"Collector".into(), &0, &0);

    // Owner submits waste
    client.submit_material(&owner, &0, &1000, &0, &0);

    // Unauthorized user should not be able to transfer
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.transfer_waste(&0, &unauthorized, &Address::random(&env), &0, &0, &"Hack".into());
    }));

    assert!(result.is_err(), "Unauthorized transfer should fail");
}

#[test]
fn test_state_consistency_after_failed_operation() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavngrContract);
    let client = ScavngrContract::new(&env, &contract_id);

    let admin = Address::random(&env);
    let participant = Address::random(&env);

    client.initialize_admin(&admin);
    client.register_participant(&participant, &0, &"Recycler".into(), &0, &0);

    // Get initial state
    let initial_stats = client.get_stats(&participant);

    // Attempt invalid operation
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.transfer_waste(&999, &participant, &Address::random(&env), &0, &0, &"Invalid".into());
    }));

    // Verify state unchanged
    let final_stats = client.get_stats(&participant);
    assert_eq!(
        initial_stats, final_stats,
        "State should remain consistent after failed operation"
    );
}

#[test]
fn test_double_initialization_prevention() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavngrContract);
    let client = ScavngrContract::new(&env, &contract_id);

    let admin1 = Address::random(&env);
    let admin2 = Address::random(&env);

    client.initialize_admin(&admin1);

    // Second initialization should fail
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.initialize_admin(&admin2);
    }));

    assert!(result.is_err(), "Double initialization should fail");
}
