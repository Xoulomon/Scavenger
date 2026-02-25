#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

#[test]
fn test_update_incentive_success() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    // Register manufacturer
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer);

    // Create incentive using the correct signature: (waste_type, reward, max_waste_amount, rewarder)
    let incentive = client.create_incentive(&WasteType::Paper, &100, &5000, &manufacturer);
    assert_eq!(incentive.reward, 100);
    assert_eq!(incentive.max_waste_amount, 5000);

    // Update incentive
    let updated = client.update_incentive(&incentive.id, &200, &10000);
    assert_eq!(updated.reward, 200);
    assert_eq!(updated.max_waste_amount, 10000);

    // Verify immutable fields unchanged
    assert_eq!(updated.id, incentive.id);
    assert_eq!(updated.waste_type, incentive.waste_type);
    assert_eq!(updated.rewarder, incentive.rewarder);
    assert_eq!(updated.is_active, incentive.is_active);
    assert_eq!(updated.created_at, incentive.created_at);

    // Verify persistence
    let retrieved = client.get_incentive_by_id(&incentive.id).unwrap();
    assert_eq!(retrieved.reward, 200);
    assert_eq!(retrieved.max_waste_amount, 10000);
}

#[test]
#[should_panic(expected = "Incentive not found")]
fn test_update_incentive_not_found() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer);

    // Try to update non-existent incentive
    client.update_incentive(&999, &100, &5000);
}

#[test]
#[should_panic(expected = "Incentive is not active")]
fn test_update_incentive_inactive() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer);

    // Create and deactivate incentive
    let incentive = client.create_incentive(&WasteType::Paper, &100, &5000, &manufacturer);
    client.update_incentive_status(&incentive.id, &false);

    // Try to update inactive incentive
    client.update_incentive(&incentive.id, &200, &10000);
}

#[test]
#[should_panic(expected = "Reward must be greater than zero")]
fn test_update_incentive_zero_reward() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer);

    let incentive = client.create_incentive(&WasteType::Paper, &100, &5000, &manufacturer);

    // Try to update with zero reward
    client.update_incentive(&incentive.id, &0, &5000);
}

#[test]
#[should_panic(expected = "Max waste amount must be greater than zero")]
fn test_update_incentive_zero_max_waste() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer);

    let incentive = client.create_incentive(&WasteType::Paper, &100, &5000, &manufacturer);

    // Try to update with zero max_waste_amount
    client.update_incentive(&incentive.id, &100, &0);
}

#[test]
fn test_update_incentive_minimum_values() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer);

    let incentive = client.create_incentive(&WasteType::Paper, &100, &5000, &manufacturer);

    // Update with minimum valid values
    let updated = client.update_incentive(&incentive.id, &1, &1);
    assert_eq!(updated.reward, 1);
    assert_eq!(updated.max_waste_amount, 1);
}

#[test]
fn test_update_incentive_multiple_times() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer);

    let incentive = client.create_incentive(&WasteType::Paper, &100, &5000, &manufacturer);

    // First update
    let updated1 = client.update_incentive(&incentive.id, &200, &10000);
    assert_eq!(updated1.reward, 200);
    assert_eq!(updated1.max_waste_amount, 10000);

    // Second update
    let updated2 = client.update_incentive(&incentive.id, &300, &15000);
    assert_eq!(updated2.reward, 300);
    assert_eq!(updated2.max_waste_amount, 15000);

    // Third update
    let updated3 = client.update_incentive(&incentive.id, &400, &20000);
    assert_eq!(updated3.reward, 400);
    assert_eq!(updated3.max_waste_amount, 20000);
}
