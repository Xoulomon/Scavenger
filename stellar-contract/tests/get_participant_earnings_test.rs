#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

// ========== Basic Functionality Tests ==========

#[test]
fn test_get_participant_earnings_registered_participant() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    // Register participant
    client.register_participant(
        &user,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Get earnings (should be 0 initially)
    let earnings = client.get_participant_earnings(&user);
    assert_eq!(earnings, 0);
}

#[test]
fn test_get_participant_earnings_unregistered_returns_zero() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let unregistered_user = Address::generate(&env);

    // Get earnings for unregistered participant
    let earnings = client.get_participant_earnings(&unregistered_user);
    assert_eq!(earnings, 0);
}

#[test]
fn test_get_participant_earnings_after_material_submission() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let collector = Address::generate(&env);
    let recycler = Address::generate(&env);
    let desc = String::from_str(&env, "Test material");

    // Register participants
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit and verify material to earn tokens
    let material = client.submit_material(&WasteType::Metal, &5000, &collector, &desc);
    client.verify_material(&material.id, &recycler);

    // Get earnings
    let earnings = client.get_participant_earnings(&collector);
    assert!(earnings > 0, "Earnings should be greater than 0 after verification");
}

// ========== Multiple Submissions Tests ==========

#[test]
fn test_get_participant_earnings_accumulates_over_time() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let collector = Address::generate(&env);
    let recycler = Address::generate(&env);
    let desc = String::from_str(&env, "Test");

    // Register participants
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Initial earnings should be 0
    let earnings_initial = client.get_participant_earnings(&collector);
    assert_eq!(earnings_initial, 0);

    // Submit and verify first material
    let material1 = client.submit_material(&WasteType::Metal, &5000, &collector, &desc);
    client.verify_material(&material1.id, &recycler);
    let earnings_after_first = client.get_participant_earnings(&collector);
    assert!(earnings_after_first > 0);

    // Submit and verify second material
    let material2 = client.submit_material(&WasteType::Metal, &3000, &collector, &desc);
    client.verify_material(&material2.id, &recycler);
    let earnings_after_second = client.get_participant_earnings(&collector);

    // Earnings should accumulate
    assert!(earnings_after_second > earnings_after_first);
}

#[test]
fn test_get_participant_earnings_different_waste_types() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let collector = Address::generate(&env);
    let recycler = Address::generate(&env);
    let desc = String::from_str(&env, "Test");

    // Register participants
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit and verify different waste types
    let paper = client.submit_material(&WasteType::Paper, &5000, &collector, &desc);
    client.verify_material(&paper.id, &recycler);

    let plastic = client.submit_material(&WasteType::Plastic, &5000, &collector, &desc);
    client.verify_material(&plastic.id, &recycler);

    let metal = client.submit_material(&WasteType::Metal, &5000, &collector, &desc);
    client.verify_material(&metal.id, &recycler);

    // Get total earnings
    let total_earnings = client.get_participant_earnings(&collector);
    assert!(total_earnings > 0, "Should have earnings from multiple waste types");
}

// ========== Role-Specific Tests ==========

#[test]
fn test_get_participant_earnings_all_roles() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let manufacturer = Address::generate(&env);

    // Register participants with different roles
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Get earnings for each (should all be 0 initially)
    assert_eq!(client.get_participant_earnings(&recycler), 0);
    assert_eq!(client.get_participant_earnings(&collector), 0);
    assert_eq!(client.get_participant_earnings(&manufacturer), 0);
}

// ========== Data Consistency Tests ==========

#[test]
fn test_get_participant_earnings_matches_participant_field() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let collector = Address::generate(&env);
    let recycler = Address::generate(&env);
    let desc = String::from_str(&env, "Test");

    // Register participants
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit and verify material
    let material = client.submit_material(&WasteType::Metal, &5000, &collector, &desc);
    client.verify_material(&material.id, &recycler);

    // Get earnings via dedicated function
    let earnings = client.get_participant_earnings(&collector);

    // Get participant and check total_tokens_earned field
    let participant = client.get_participant(&collector).unwrap();

    // Should match
    assert_eq!(earnings, participant.total_tokens_earned as i128);
}

#[test]
fn test_get_participant_earnings_consistency_with_get_participant_info() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let collector = Address::generate(&env);
    let recycler = Address::generate(&env);
    let desc = String::from_str(&env, "Test");

    // Register participants
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit and verify material
    let material = client.submit_material(&WasteType::Paper, &3000, &collector, &desc);
    client.verify_material(&material.id, &recycler);

    // Get earnings via dedicated function
    let earnings = client.get_participant_earnings(&collector);

    // Get via participant info
    let info = client.get_participant_info(&collector).unwrap();

    // Should match
    assert_eq!(earnings, info.participant.total_tokens_earned as i128);
}

// ========== Edge Cases Tests ==========

#[test]
fn test_get_participant_earnings_multiple_participants_independent() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let collector1 = Address::generate(&env);
    let collector2 = Address::generate(&env);
    let recycler = Address::generate(&env);
    let desc = String::from_str(&env, "Test");

    // Register participants
    client.register_participant(
        &collector1,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &collector2,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Only collector1 submits and gets verified
    let material = client.submit_material(&WasteType::Metal, &5000, &collector1, &desc);
    client.verify_material(&material.id, &recycler);

    // Check earnings
    let earnings1 = client.get_participant_earnings(&collector1);
    let earnings2 = client.get_participant_earnings(&collector2);

    // collector1 should have earnings, collector2 should not
    assert!(earnings1 > 0);
    assert_eq!(earnings2, 0);
}

#[test]
fn test_get_participant_earnings_no_side_effects() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let collector = Address::generate(&env);
    let recycler = Address::generate(&env);
    let desc = String::from_str(&env, "Test");

    // Register participants
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit and verify material
    let material = client.submit_material(&WasteType::Metal, &5000, &collector, &desc);
    client.verify_material(&material.id, &recycler);

    // Get earnings multiple times
    let earnings1 = client.get_participant_earnings(&collector);
    let earnings2 = client.get_participant_earnings(&collector);
    let earnings3 = client.get_participant_earnings(&collector);

    // All should be identical (read-only operation)
    assert_eq!(earnings1, earnings2);
    assert_eq!(earnings2, earnings3);
}

#[test]
fn test_get_participant_earnings_read_only() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    // Register participant
    client.register_participant(
        &user,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Get earnings before
    let earnings_before = client.get_participant_earnings(&user);

    // Get participant to verify no changes
    let participant_before = client.get_participant(&user).unwrap();

    // Get earnings again
    let earnings_after = client.get_participant_earnings(&user);

    // Get participant again
    let participant_after = client.get_participant(&user).unwrap();

    // Should be identical (read-only)
    assert_eq!(earnings_before, earnings_after);
    assert_eq!(
        participant_before.total_tokens_earned,
        participant_after.total_tokens_earned
    );
}

// ========== Return Type Tests ==========

#[test]
fn test_get_participant_earnings_returns_i128() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    // Register participant
    client.register_participant(
        &user,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Get earnings
    let earnings: i128 = client.get_participant_earnings(&user);

    // Verify it's a valid i128
    assert!(earnings >= 0);
}

#[test]
fn test_get_participant_earnings_zero_for_no_activity() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    // Register participant but don't submit anything
    client.register_participant(
        &user,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Get earnings
    let earnings = client.get_participant_earnings(&user);

    // Should be 0
    assert_eq!(earnings, 0);
}

// ========== Integration Tests ==========

#[test]
fn test_get_participant_earnings_full_workflow() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let collector = Address::generate(&env);
    let recycler = Address::generate(&env);
    let desc = String::from_str(&env, "Test material");

    // Register participants
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Check initial earnings
    assert_eq!(client.get_participant_earnings(&collector), 0);

    // Submit material
    let material = client.submit_material(&WasteType::Metal, &5000, &collector, &desc);

    // Earnings still 0 before verification
    assert_eq!(client.get_participant_earnings(&collector), 0);

    // Verify material
    client.verify_material(&material.id, &recycler);

    // Now should have earnings
    let final_earnings = client.get_participant_earnings(&collector);
    assert!(final_earnings > 0);
}

#[test]
fn test_get_participant_earnings_batch_submissions() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let collector = Address::generate(&env);
    let recycler = Address::generate(&env);
    let desc = String::from_str(&env, "Test");

    // Register participants
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit multiple materials
    let material1 = client.submit_material(&WasteType::Paper, &1000, &collector, &desc);
    let material2 = client.submit_material(&WasteType::Plastic, &2000, &collector, &desc);
    let material3 = client.submit_material(&WasteType::Metal, &3000, &collector, &desc);

    // Verify all
    client.verify_material(&material1.id, &recycler);
    client.verify_material(&material2.id, &recycler);
    client.verify_material(&material3.id, &recycler);

    // Get total earnings
    let total_earnings = client.get_participant_earnings(&collector);
    assert!(total_earnings > 0);
}
