use soroban_sdk::symbol_short;
#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{
    ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType,
};

fn create_test_contract(env: &Env) -> (ScavengerContractClient, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    client.initialize_admin(&admin);

    (client, admin)
}

#[test]
fn test_deactivate_waste() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = create_test_contract(&env);

    let owner = Address::generate(&env);

    // Register owner as collector
    client.register_participant(
        &owner,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("Collect"),
        &45_000_000,
        &-93_000_000,
    );

    // Register waste
    let waste_id = client.recycle_waste(
        &WasteType::Plastic,
        &1000,
        &owner,
        &45_000_000,
        &-93_000_000,
    );

    // Deactivate waste as admin
    let deactivated = client.deactivate_waste(&waste_id, &admin);

    // Verify waste is deactivated
    assert_eq!(deactivated.is_active, false);
    assert_eq!(deactivated.waste_id, waste_id);
}

#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn test_deactivate_waste_non_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = create_test_contract(&env);

    let owner = Address::generate(&env);
    let non_admin = Address::generate(&env);

    // Register owner as collector
    client.register_participant(
        &owner,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("Collect"),
        &45_000_000,
        &-93_000_000,
    );

    // Register waste
    let waste_id = client.recycle_waste(
        &WasteType::Plastic,
        &1000,
        &owner,
        &45_000_000,
        &-93_000_000,
    );

    // Try to deactivate as non-admin (should panic)
    client.deactivate_waste(&waste_id, &non_admin);
}

#[test]
#[should_panic(expected = "Waste already deactivated")]
fn test_deactivate_already_deactivated_waste() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = create_test_contract(&env);

    let owner = Address::generate(&env);

    // Register owner as collector
    client.register_participant(
        &owner,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("Collect"),
        &45_000_000,
        &-93_000_000,
    );

    // Register waste
    let waste_id = client.recycle_waste(
        &WasteType::Plastic,
        &1000,
        &owner,
        &45_000_000,
        &-93_000_000,
    );

    // Deactivate waste
    client.deactivate_waste(&waste_id, &admin);

    // Try to deactivate again (should panic)
    client.deactivate_waste(&waste_id, &admin);
}

#[test]
#[should_panic(expected = "Waste item not found")]
fn test_deactivate_nonexistent_waste() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = create_test_contract(&env);

    // Try to deactivate non-existent waste (should panic)
    client.deactivate_waste(&999, &admin);
}

#[test]
fn test_deactivated_waste_not_counted_in_totals() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = create_test_contract(&env);

    let owner = Address::generate(&env);

    // Register owner as collector
    client.register_participant(
        &owner,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("Collect"),
        &45_000_000,
        &-93_000_000,
    );

    // Register two waste items
    let waste1 = client.recycle_waste(
        &WasteType::Plastic,
        &1000,
        &owner,
        &45_000_000,
        &-93_000_000,
    );

    let waste2 = client.recycle_waste(&WasteType::Metal, &2000, &owner, &45_000_000, &-93_000_000);

    // Get initial stats
    let initial_stats = client.get_supply_chain_stats();
    let initial_weight = initial_stats.1;

    // Deactivate first waste
    client.deactivate_waste(&waste1, &admin);

    // Get updated stats
    let updated_stats = client.get_supply_chain_stats();
    let updated_weight = updated_stats.1;

    // Verify deactivated waste is not counted
    // The weight should decrease by waste1's weight
    assert!(updated_weight < initial_weight);

    // Verify waste2 is still counted
    assert!(updated_weight > 0);
}

#[test]
#[should_panic(expected = "Cannot transfer deactivated waste")]
fn test_deactivated_waste_cannot_be_transferred() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = create_test_contract(&env);

    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Register participants
    client.register_participant(
        &owner,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("Collect"),
        &45_000_000,
        &-93_000_000,
    );
    client.register_participant(
        &recipient,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("Manufac"),
        &45_000_000,
        &-93_000_000,
    );

    // Register waste
    let waste_id = client.recycle_waste(
        &WasteType::Plastic,
        &1000,
        &owner,
        &45_000_000,
        &-93_000_000,
    );

    // Deactivate waste
    client.deactivate_waste(&waste_id, &admin);

    // Try to transfer deactivated waste (should panic)
    client.transfer_waste_v2(&waste_id, &owner, &recipient, &45_000_000, &-93_000_000);
}

#[test]
#[should_panic(expected = "Cannot confirm deactivated waste")]
fn test_deactivated_waste_cannot_be_confirmed() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = create_test_contract(&env);

    let owner = Address::generate(&env);
    let confirmer = Address::generate(&env);

    // Register owner as collector
    client.register_participant(
        &owner,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("Collect"),
        &45_000_000,
        &-93_000_000,
    );

    // Register waste
    let waste_id = client.recycle_waste(
        &WasteType::Plastic,
        &1000,
        &owner,
        &45_000_000,
        &-93_000_000,
    );

    // Deactivate waste
    client.deactivate_waste(&waste_id, &admin);

    // Try to confirm deactivated waste (should panic)
    client.confirm_waste_details(&waste_id, &confirmer);
}
