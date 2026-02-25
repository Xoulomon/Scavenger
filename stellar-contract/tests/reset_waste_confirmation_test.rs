#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ScavengerContract, ScavengerContractClient, ParticipantRole, WasteType};

fn create_test_contract(env: &Env) -> (ScavengerContractClient, Address, Address, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let token_address = Address::generate(env);
    let charity_address = Address::generate(env);

    client.initialize_admin(&admin);
    client.set_percentages(&admin, &5, &50);

    (client, admin, token_address, charity_address)
}

#[test]
fn test_reset_waste_confirmation() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _token, _charity) = create_test_contract(&env);

    let owner = Address::generate(&env);
    let confirmer = Address::generate(&env);

    // Register owner as recycler
    client.register_participant(
        &owner,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("owner"),
        &0,
        &0,
    );

    // Register waste using recycle_waste (v2 API)
    let waste_id = client.recycle_waste(
        &WasteType::Plastic,
        &1000,
        &owner,
        &0,
        &0,
    );

    // Confirm the waste
    let confirmed_waste = client.confirm_waste_details(&waste_id, &confirmer);
    assert_eq!(confirmed_waste.is_confirmed, true);
    assert_eq!(confirmed_waste.confirmer, confirmer);

    // Reset confirmation
    let reset_waste = client.reset_waste_confirmation(&waste_id, &owner);

    // Verify confirmation is reset
    assert_eq!(reset_waste.is_confirmed, false);
    assert_eq!(reset_waste.confirmer, owner);

    // Verify waste can be re-confirmed
    let reconfirmed = client.confirm_waste_details(&waste_id, &confirmer);
    assert_eq!(reconfirmed.is_confirmed, true);
    assert_eq!(reconfirmed.confirmer, confirmer);
}

#[test]
#[should_panic(expected = "Caller is not the owner of this waste item")]
fn test_reset_waste_confirmation_non_owner() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _token, _charity) = create_test_contract(&env);

    let owner = Address::generate(&env);
    let confirmer = Address::generate(&env);
    let non_owner = Address::generate(&env);

    // Register owner as recycler
    client.register_participant(
        &owner,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("owner"),
        &0,
        &0,
    );

    // Register waste using recycle_waste (v2 API)
    let waste_id = client.recycle_waste(
        &WasteType::Plastic,
        &1000,
        &owner,
        &0,
        &0,
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

    let (client, _admin, _token, _charity) = create_test_contract(&env);

    let owner = Address::generate(&env);

    // Register owner as recycler
    client.register_participant(
        &owner,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("owner"),
        &0,
        &0,
    );

    // Register waste using recycle_waste (v2 API)
    let waste_id = client.recycle_waste(
        &WasteType::Plastic,
        &1000,
        &owner,
        &0,
        &0,
    );

    // Try to reset unconfirmed waste (should panic)
    client.reset_waste_confirmation(&waste_id, &owner);
}

#[test]
#[should_panic(expected = "Waste item not found")]
fn test_reset_nonexistent_waste() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _token, _charity) = create_test_contract(&env);

    let owner = Address::generate(&env);

    // Try to reset non-existent waste (should panic)
    client.reset_waste_confirmation(&999, &owner);
}
