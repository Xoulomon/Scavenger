#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{
    ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType,
};

#[test]
#[should_panic(expected = "Donation amount must be positive")]
fn test_donate_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    let charity = Address::generate(&env);
    let donor = Address::generate(&env);
    client.initialize_admin(&admin);
    client.set_charity_contract(&admin, &charity);
    client.donate_to_charity(&donor, &0);
}

#[test]
#[should_panic(expected = "Collector percentage must be <= 100")]
fn test_percentage_over_100() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);
    client.set_percentages(&admin, &101, &0);
}

#[test]
#[should_panic(expected = "Latitude must be between -90 and +90 degrees")]
fn test_invalid_latitude() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);
    client.register_participant(
        &user,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("User"),
        &91_000_000,
        &0,
    );
}

#[test]
#[should_panic(expected = "Waste weight must be greater than zero")]
fn test_zero_weight() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let recycler = Address::generate(&env);
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("R"),
        &0,
        &0,
    );
    client.recycle_waste(&WasteType::Plastic, &0, &recycler, &0, &0);
}

#[test]
fn test_valid_inputs() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);
    client.set_percentages(&admin, &50, &50);
}
