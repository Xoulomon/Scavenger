//! Negative-path coverage — issue #1754.
//!
//! Happy-path coverage lives in the other `contracts/scavenger/src/test_*.rs`
//! files. These tests pin the refusal paths:
//!   - `register_participant` while the contract is paused
//!   - `register_participant` for an already-registered address
//!   - `set_percentages` when the collector + owner sum exceeds 100
//!   - (auth refusals: see `test_auth_failures.rs`)
#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};

use crate::{ParticipantRole, ScavengerContract, ScavengerContractClient};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    env.mock_all_auths();
    client.initialize_admin(&admin);
    (client, admin)
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn register_participant_fails_while_paused() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let recycler = Address::generate(&env);
    client.pause(&admin);
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &symbol_short!("R"),
        &0i128,
        &0i128,
    );
}

#[test]
#[should_panic(expected = "ALREADY_REGISTERED")]
fn register_participant_rejects_duplicate_address() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let recycler = Address::generate(&env);
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &symbol_short!("R"),
        &0i128,
        &0i128,
    );
    client.register_participant(
        &recycler,
        &ParticipantRole::Collector,
        &symbol_short!("C"),
        &0i128,
        &0i128,
    );
}

#[test]
#[should_panic(expected = "INVALID_PERCENTAGE")]
fn set_percentages_rejects_sum_over_100() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.set_percentages(&admin, &60, &50);
}
