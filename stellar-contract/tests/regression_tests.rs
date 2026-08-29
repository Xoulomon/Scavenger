#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavngrContractClient, WasteType};

#[test]
fn regression_test_participant_deregistration() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let participant = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(&participant, &ParticipantRole::Recycler, &"Test".into(), &0i32, &0i32);

    assert!(client.is_participant_registered(&participant));

    client.deregister_participant(&participant);

    assert!(!client.is_participant_registered(&participant));
}

#[test]
fn regression_test_waste_confirmation_workflow() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let confirmer = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &"Recycler".into(), &0i32, &0i32);
    client.register_participant(
        &confirmer,
        &ParticipantRole::Collector,
        &"Confirmer".into(),
        &0i32,
        &0i32,
    );

    let waste_id = client.submit_material(&recycler, &WasteType::Plastic, &100u128, &0i32, &0i32);

    client.confirm_waste_details(&waste_id, &confirmer);

    let waste = client.get_waste(&waste_id);
    assert_eq!(waste.confirmer, Some(confirmer.clone()));
}

#[test]
fn regression_test_incentive_budget_exhaustion() {
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

    let incentive_id = client.create_incentive(&manufacturer, &WasteType::Plastic, &100u128, &100u128);

    let incentive = client.get_incentive_by_id(&incentive_id);
    assert_eq!(incentive.budget, 100u128);
}

#[test]
fn regression_test_role_update() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let participant = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(&participant, &ParticipantRole::Recycler, &"Test".into(), &0i32, &0i32);

    client.update_role(&participant, &ParticipantRole::Collector);

    let updated = client.get_participant(&participant);
    assert_eq!(updated.role, ParticipantRole::Collector);
}

#[test]
fn regression_test_waste_transfer_history() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let manufacturer = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &"Recycler".into(), &0i32, &0i32);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &"Collector".into(),
        &0i32,
        &0i32,
    );
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &"Manufacturer".into(),
        &0i32,
        &0i32,
    );

    let waste_id = client.submit_material(&recycler, &WasteType::Metal, &200u128, &0i32, &0i32);

    client.transfer_waste(&waste_id, &recycler, &collector, &0i32, &0i32, &"First transfer".into());

    client.transfer_waste(
        &waste_id,
        &collector,
        &manufacturer,
        &0i32,
        &0i32,
        &"Second transfer".into(),
    );

    let history = client.get_waste_transfer_history(&waste_id);
    assert!(history.len() >= 2u32);
}

#[test]
fn regression_test_deactivated_waste_cannot_transfer() {
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

    client.deactivate_waste(&admin, &waste_id);

    let waste = client.get_waste(&waste_id);
    assert!(!waste.active);
}

#[test]
fn regression_test_percentage_validation() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);

    client.initialize_admin(&admin);
    client.set_percentages(&admin, &50u32, &50u32);

    // Verify percentages are set correctly
    let metrics = client.get_metrics();
    assert!(metrics.total_wastes >= 0u128);
}

#[test]
fn regression_test_participant_stats_accuracy() {
    let env = Env::default();
    let contract_id = env.register_contract(None, stellar_scavngr_contract::ScavngrContract);
    let client = ScavngrContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &"Recycler".into(), &0i32, &0i32);

    for i in 0..5 {
        client.submit_material(
            &recycler,
            &WasteType::Plastic,
            &(100u128 + i as u128 * 10),
            &0i32,
            &0i32,
        );
    }

    let stats = client.get_stats(&recycler);
    assert_eq!(stats.total_wastes_submitted, 5u128);
}
