#![cfg(test)]

use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env,
};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient};

#[test]
fn test_reentrancy_guard_donate_to_charity() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let charity = Address::generate(&env);
    let donor = Address::generate(&env);

    // Initialize admin and set charity
    client.initialize_admin(&admin);
    client.set_charity_contract(&admin, &charity);

    // First donation should succeed
    client.donate_to_charity(&donor, &1000);

    // Verify event was emitted
    let events = env.events().all();
    assert!(events.len() > 0);
}

#[test]
fn test_reentrancy_guard_reward_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_address = Address::generate(&env);
    let rewarder = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Initialize admin
    client.initialize_admin(&admin);

    // Set token address
    client.set_token_address(&admin, &token_address);

    // Register recipient
    client.register_participant(
        &recipient,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("Recycler"),
        &100,
        &200,
    );

    // Reward tokens should succeed
    client.reward_tokens(&rewarder, &recipient, &500, &1);

    // Verify recipient's tokens were updated
    let participant = client.get_participant(&recipient).unwrap();
    assert_eq!(participant.total_tokens_earned, 500);
}

#[test]
#[should_panic(expected = "Reward amount must be greater than zero")]
fn test_reward_tokens_zero_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_address = Address::generate(&env);
    let rewarder = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Initialize admin
    client.initialize_admin(&admin);

    // Set token address
    client.set_token_address(&admin, &token_address);

    // Register recipient
    client.register_participant(
        &recipient,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("Recycler"),
        &100,
        &200,
    );

    // Try to reward zero tokens (should panic)
    client.reward_tokens(&rewarder, &recipient, &0, &1);
}

#[test]
#[should_panic(expected = "Recipient not registered")]
fn test_reward_tokens_unregistered_recipient() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_address = Address::generate(&env);
    let rewarder = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Initialize admin
    client.initialize_admin(&admin);

    // Set token address
    client.set_token_address(&admin, &token_address);

    // Try to reward tokens to unregistered recipient (should panic)
    client.reward_tokens(&rewarder, &recipient, &500, &1);
}

#[test]
#[should_panic(expected = "Token address not set")]
fn test_reward_tokens_no_token_address() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let rewarder = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Initialize admin
    client.initialize_admin(&admin);

    // Register recipient
    client.register_participant(
        &recipient,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("Recycler"),
        &100,
        &200,
    );

    // Try to reward tokens without setting token address (should panic)
    client.reward_tokens(&rewarder, &recipient, &500, &1);
}

#[test]
fn test_reward_tokens_event_emission() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_address = Address::generate(&env);
    let rewarder = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Initialize admin
    client.initialize_admin(&admin);

    // Set token address
    client.set_token_address(&admin, &token_address);

    // Register recipient
    client.register_participant(
        &recipient,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("Recycler"),
        &100,
        &200,
    );

    // Clear any existing events
    let events_before = env.events().all().len();

    // Reward tokens
    client.reward_tokens(&rewarder, &recipient, &1000, &1);

    // Verify a new event was emitted
    let events_after = env.events().all();
    assert!(events_after.len() > events_before);
}

#[test]
fn test_multiple_rewards() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_address = Address::generate(&env);
    let rewarder = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    // Initialize admin
    client.initialize_admin(&admin);

    // Set token address
    client.set_token_address(&admin, &token_address);

    // Register recipients
    client.register_participant(
        &recipient1,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("Rec1"),
        &100,
        &200,
    );

    client.register_participant(
        &recipient2,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("Col1"),
        &300,
        &400,
    );

    // Reward multiple times
    client.reward_tokens(&rewarder, &recipient1, &500, &1);
    client.reward_tokens(&rewarder, &recipient2, &300, &2);
    client.reward_tokens(&rewarder, &recipient1, &200, &3);

    // Verify cumulative tokens
    let participant1 = client.get_participant(&recipient1).unwrap();
    assert_eq!(participant1.total_tokens_earned, 700);

    let participant2 = client.get_participant(&recipient2).unwrap();
    assert_eq!(participant2.total_tokens_earned, 300);
}

#[test]
fn test_token_address_management() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let token_address1 = Address::generate(&env);
    let token_address2 = Address::generate(&env);

    // Initialize admin
    client.initialize_admin(&admin);

    // Initially no token address
    assert!(client.get_token_address().is_none());

    // Set token address
    client.set_token_address(&admin, &token_address1);
    assert_eq!(client.get_token_address().unwrap(), token_address1);

    // Update token address
    client.set_token_address(&admin, &token_address2);
    assert_eq!(client.get_token_address().unwrap(), token_address2);
}

#[test]
#[should_panic(expected = "Unauthorized: caller is not admin")]
fn test_set_token_address_non_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let token_address = Address::generate(&env);

    // Initialize admin
    client.initialize_admin(&admin);

    // Try to set token address as non-admin (should panic)
    client.set_token_address(&non_admin, &token_address);
}
