#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{
    ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType,
};

// ========== Address Validation Tests ==========

#[test]
#[should_panic(expected = "Charity setup: addresses must be different")]
fn test_charity_address_same_as_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    // Try to set charity to same address as admin
    client.set_charity_contract(&admin, &admin);
}

#[test]
#[should_panic(expected = "Address cannot be the contract itself")]
fn test_charity_address_is_contract() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    // Try to set charity to contract address
    client.set_charity_contract(&admin, &contract_id);
}

#[test]
#[should_panic(expected = "Address cannot be the contract itself")]
fn test_register_participant_as_contract() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    // Try to register contract as participant
    client.register_participant(
        &contract_id,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("Contract"),
        &0,
        &0,
    );
}

// ========== Amount Validation Tests ==========

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
#[should_panic(expected = "Donation amount must be positive")]
fn test_donate_negative_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let charity = Address::generate(&env);
    let donor = Address::generate(&env);

    client.initialize_admin(&admin);
    client.set_charity_contract(&admin, &charity);

    client.donate_to_charity(&donor, &-100);
}

#[test]
#[should_panic(expected = "Reward amount must be positive")]
fn test_reward_zero_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let rewarder = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.initialize_admin(&admin);
    client.set_token_address(&admin, &token);

    client.register_participant(
        &recipient,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("Recycler"),
        &0,
        &0,
    );

    client.reward_tokens(&rewarder, &recipient, &0, &1);
}

#[test]
#[should_panic(expected = "Waste weight must be greater than zero")]
fn test_recycle_zero_weight() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);

    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("Recycler"),
        &0,
        &0,
    );

    client.recycle_waste(&WasteType::Plastic, &0, &recycler, &0, &0);
}

// ========== Percentage Validation Tests ==========

#[test]
#[should_panic(expected = "Collector percentage must be <= 100")]
fn test_collector_percentage_over_100() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    client.set_percentages(&admin, &101, &0);
}

#[test]
#[should_panic(expected = "Owner percentage must be <= 100")]
fn test_owner_percentage_over_100() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    client.set_percentages(&admin, &0, &150);
}

#[test]
fn test_percentage_exactly_100() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    // Should succeed
    client.set_percentages(&admin, &100, &0);
    assert_eq!(client.get_collector_percentage(), Some(100));
}

// ========== Coordinate Validation Tests ==========

#[test]
#[should_panic(expected = "Latitude must be between -90 and +90 degrees")]
fn test_register_invalid_latitude_high() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    // Latitude > 90 degrees (90_000_001 microdegrees)
    client.register_participant(
        &user,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("User"),
        &90_000_001,
        &0,
    );
}

#[test]
#[should_panic(expected = "Latitude must be between -90 and +90 degrees")]
fn test_register_invalid_latitude_low() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    // Latitude < -90 degrees
    client.register_participant(
        &user,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("User"),
        &-90_000_001,
        &0,
    );
}

#[test]
#[should_panic(expected = "Longitude must be between -180 and +180 degrees")]
fn test_register_invalid_longitude_high() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    // Longitude > 180 degrees
    client.register_participant(
        &user,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("User"),
        &0,
        &180_000_001,
    );
}

#[test]
#[should_panic(expected = "Longitude must be between -180 and +180 degrees")]
fn test_register_invalid_longitude_low() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    // Longitude < -180 degrees
    client.register_participant(
        &user,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("User"),
        &0,
        &-180_000_001,
    );
}

#[test]
fn test_register_valid_coordinates() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    // Valid coordinates at boundaries
    let participant = client.register_participant(
        &user,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("User"),
        &90_000_000,  // Max latitude
        &180_000_000, // Max longitude
    );

    assert_eq!(participant.latitude, 90_000_000);
    assert_eq!(participant.longitude, 180_000_000);
}

#[test]
#[should_panic(expected = "Latitude must be between -90 and +90 degrees")]
fn test_update_location_invalid_latitude() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    client.register_participant(
        &user,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("User"),
        &0,
        &0,
    );

    // Try to update with invalid latitude
    client.update_location(&user, &91_000_000, &0);
}

#[test]
#[should_panic(expected = "Latitude must be between -90 and +90 degrees")]
fn test_recycle_waste_invalid_coordinates() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);

    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("Recycler"),
        &0,
        &0,
    );

    // Try to recycle with invalid coordinates
    client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &100_000_000, &0);
}

// ========== Waste ID Validation Tests ==========

#[test]
#[should_panic(expected = "Waste ID does not exist")]
fn test_reward_tokens_invalid_waste_id() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let rewarder = Address::generate(&env);
    let recipient = Address::generate(&env);

    client.initialize_admin(&admin);
    client.set_token_address(&admin, &token);

    client.register_participant(
        &recipient,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("Recycler"),
        &0,
        &0,
    );

    // Try to reward with non-existent waste ID
    client.reward_tokens(&rewarder, &recipient, &100, &999);
}

// ========== Address Difference Validation Tests ==========

#[test]
#[should_panic(expected = "Token reward: addresses must be different")]
fn test_reward_tokens_same_address() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token = Address::generate(&env);
    let user = Address::generate(&env);

    client.initialize_admin(&admin);
    client.set_token_address(&admin, &token);

    client.register_participant(
        &user,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("User"),
        &0,
        &0,
    );

    // Try to reward self
    client.reward_tokens(&user, &user, &100, &0);
}

// ========== Edge Case Tests ==========

#[test]
fn test_valid_inputs_succeed() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let charity = Address::generate(&env);
    let donor = Address::generate(&env);

    client.initialize_admin(&admin);
    client.set_charity_contract(&admin, &charity);

    // All valid inputs should succeed
    client.donate_to_charity(&donor, &1);
    client.set_percentages(&admin, &50, &50);
}
