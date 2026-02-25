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
fn test_reset_waste_confirmation() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = create_test_contract(&env);

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

    // Confirm the waste
    client.confirm_waste_details(&waste_id, &confirmer);

    // Reset confirmation
    let reset_waste = client.reset_waste_confirmation(&waste_id, &owner);

    // Verify confirmation is reset
    assert_eq!(reset_waste.is_confirmed, false);

    // Verify waste can be re-confirmed
    let reconfirmed = client.confirm_waste_details(&waste_id, &confirmer);
    assert_eq!(reconfirmed.is_confirmed, true);
}

#[test]
#[should_panic(expected = "Only owner can reset confirmation")]
fn test_reset_waste_confirmation_non_owner() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = create_test_contract(&env);

    let owner = Address::generate(&env);
    let confirmer = Address::generate(&env);
    let non_owner = Address::generate(&env);

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

    // Confirm the waste
    client.confirm_waste_details(&waste_id, &confirmer);

    // Try to reset as non-owner (should panic)
    client.reset_waste_confirmation(&waste_id, &non_owner);
}

#[test]
#[should_panic(expected = "Waste is not confirmed")]
fn test_reset_unconfirmed_waste() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = create_test_contract(&env);

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

    // Try to reset unconfirmed waste (should panic)
    client.reset_waste_confirmation(&waste_id, &owner);
}

#[test]
#[should_panic(expected = "Waste not found")]
fn test_reset_nonexistent_waste() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = create_test_contract(&env);

    let owner = Address::generate(&env);

    // Try to reset non-existent waste (should panic)
    client.reset_waste_confirmation(&999, &owner);
}
