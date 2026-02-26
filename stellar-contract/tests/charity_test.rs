#![cfg(test)]

use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events},
    Address, Env, IntoVal, TryIntoVal, Vec,
};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient};

fn setup_admin_and_charity(env: &Env) -> (ScavengerContractClient<'_>, Address, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let charity = Address::generate(env);

    client.initialize_admin(&admin);
    client.set_charity_contract(&admin, &charity);

    (client, admin, charity)
}

fn register_and_fund_donor(client: &ScavengerContractClient<'_>, env: &Env, admin: &Address) -> Address {
    let token_address = Address::generate(env);
    let rewarder = Address::generate(env);
    let donor = Address::generate(env);

    client.set_token_address(admin, &token_address);
    client.register_participant(
        &donor,
        &ParticipantRole::Recycler,
        &symbol_short!("donor"),
        &100,
        &200,
    );
    client.reward_tokens(&rewarder, &donor, &1_000, &1);

    donor
}

#[test]
fn test_successful_donation() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin, _charity) = setup_admin_and_charity(&env);
    let donor = register_and_fund_donor(&client, &env, &admin);

    client.donate_to_charity(&donor, &300);

    let participant = client.get_participant(&donor).unwrap();
    assert_eq!(participant.total_tokens_earned, 700);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_insufficient_balance_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin, _charity) = setup_admin_and_charity(&env);
    let donor = register_and_fund_donor(&client, &env, &admin);

    client.donate_to_charity(&donor, &1_001);
}

#[test]
#[should_panic(expected = "Caller is not a registered participant")]
fn test_unregistered_user_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin, _charity) = setup_admin_and_charity(&env);
    let donor = Address::generate(&env);

    client.donate_to_charity(&donor, &100);
}

#[test]
#[should_panic(expected = "Charity contract not set")]
fn test_charity_not_set_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    let donor = register_and_fund_donor(&client, &env, &admin);
    client.donate_to_charity(&donor, &100);
}

#[test]
fn test_reentrancy_protection_allows_sequential_calls() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin, _charity) = setup_admin_and_charity(&env);
    let donor = register_and_fund_donor(&client, &env, &admin);

    client.donate_to_charity(&donor, &100);
    client.donate_to_charity(&donor, &200);

    let participant = client.get_participant(&donor).unwrap();
    assert_eq!(participant.total_tokens_earned, 700);
}

#[test]
fn test_donation_event_emission() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin, charity) = setup_admin_and_charity(&env);
    let donor = register_and_fund_donor(&client, &env, &admin);

    client.donate_to_charity(&donor, &250);

    let events = env.events().all();
    let event = events.last().unwrap();

    let expected_topics: Vec<soroban_sdk::Val> = (symbol_short!("donated"), donor.clone()).into_val(&env);
    assert_eq!(event.1, expected_topics);

    let event_data: (i128, Address) = event.2.try_into_val(&env).unwrap();
    assert_eq!(event_data.0, 250);
    assert_eq!(event_data.1, charity);
}
