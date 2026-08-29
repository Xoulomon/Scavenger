#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavngrContractClient, WasteType};

#[test]
fn smoke_test_participant_registration() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let participant = Address::generate(&env);

    client.initialize_admin(&admin);

    client.register_participant(
        &participant,
        &ParticipantRole::Recycler,
        &"Test Recycler".into(),
        &0i32,
        &0i32,
    );

    let result = client.is_participant_registered(&participant);
    assert!(result);
}

#[test]
fn smoke_test_waste_submission_flow() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &"Recycler".into(), &0i32, &0i32);

    let waste_id = client.submit_material(&recycler, &WasteType::Plastic, &100u128, &0i32, &0i32);

    assert!(waste_id > 0);
}

#[test]
fn smoke_test_waste_transfer_flow() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &"Recycler".into(), &0i32, &0i32);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &"Collector".into(),
        &0i32,
        &0i32,
    );

    let waste_id = client.submit_material(&recycler, &WasteType::Plastic, &100u128, &0i32, &0i32);

    client.transfer_waste(
        &waste_id,
        &recycler,
        &collector,
        &0i32,
        &0i32,
        &"Transfer to collector".into(),
    );

    let waste = client.get_waste(&waste_id);
    assert_eq!(waste.owner, collector);
}

#[test]
fn smoke_test_incentive_creation_and_distribution() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let manufacturer = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &"Manufacturer".into(),
        &0i32,
        &0i32,
    );

    let incentive_id = client.create_incentive(&manufacturer, &WasteType::Plastic, &50u128, &1000u128);

    assert!(incentive_id > 0);

    let incentive = client.get_incentive_by_id(&incentive_id);
    assert_eq!(incentive.reward_points, 50u128);
}

#[test]
fn smoke_test_metrics_retrieval() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    let metrics = client.get_metrics();
    assert_eq!(metrics.total_wastes, 0u128);
    assert_eq!(metrics.total_tokens_distributed, 0u128);
}
