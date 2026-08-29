#![cfg(test)]

mod common;
use common::event_helpers::*;

use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events},
    Address, Env, IntoVal, String,
};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    env.mock_all_auths();
    client.initialize_admin(&admin);
    (client, admin)
}

#[test]
fn test_contract_not_paused_by_default() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Unauthorized: caller is not admin")]
fn test_non_admin_cannot_pause() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    client.pause(&non_admin);
}

#[test]
#[should_panic(expected = "Unauthorized: caller is not admin")]
fn test_non_admin_cannot_unpause() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.pause(&admin);
    let non_admin = Address::generate(&env);
    client.unpause(&non_admin);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_register_participant() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.pause(&admin);
    let user = Address::generate(&env);
    client.register_participant(&user, &ParticipantRole::Recycler, &symbol_short!("Alice"), &0, &0);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_submit_material() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);
    client.register_participant(&user, &ParticipantRole::Recycler, &symbol_short!("Alice"), &0, &0);
    client.pause(&admin);
    client.submit_material(&WasteType::Plastic, &5000, &user, &String::from_str(&env, ""));
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_transfer_waste() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("R"), &0, &0);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("C"), &0, &0);
    let material = client.submit_material(&WasteType::Plastic, &5000, &recycler, &String::from_str(&env, ""));
    client.pause(&admin);
    client.transfer_waste(&material.id, &recycler, &collector, &String::from_str(&env, ""));
}

#[test]
fn test_unpause_restores_register_participant() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.pause(&admin);
    client.unpause(&admin);
    let user = Address::generate(&env);
    client.register_participant(&user, &ParticipantRole::Recycler, &symbol_short!("Alice"), &0, &0);
    assert!(client.is_participant_registered(&user));
}

#[test]
#[should_panic(expected = "Contract is already paused")]
fn test_cannot_pause_when_already_paused() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.pause(&admin);
    client.pause(&admin);
}

#[test]
#[should_panic(expected = "Contract is not paused")]
fn test_cannot_unpause_when_not_paused() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.unpause(&admin);
}

#[test]
fn test_pause_emits_event() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.pause(&admin);
    assert_event_emitted_with_symbol(&env, symbol_short!("paused"));
}

#[test]
fn test_unpause_emits_event() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.pause(&admin);
    client.unpause(&admin);
    assert_event_emitted_with_symbol(&env, symbol_short!("unpaused"));
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_recycle_waste() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let recycler = Address::generate(&env);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("R"), &0, &0);
    client.pause(&admin);
    client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_transfer_waste_v2() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("R"), &0, &0);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("C"), &0, &0);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    client.pause(&admin);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_confirm_waste_details() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("R"), &0, &0);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("C"), &0, &0);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    client.pause(&admin);
    client.confirm_waste_details(&waste_id, &recycler);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_create_incentive() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let mfr = Address::generate(&env);
    client.register_participant(&mfr, &ParticipantRole::Manufacturer, &symbol_short!("M"), &0, &0);
    client.pause(&admin);
    client.create_incentive(&mfr, &WasteType::Plastic, &10, &1000);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_deactivate_incentive() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let mfr = Address::generate(&env);
    client.register_participant(&mfr, &ParticipantRole::Manufacturer, &symbol_short!("M"), &0, &0);
    let incentive = client.create_incentive(&mfr, &WasteType::Plastic, &10, &1000);
    client.pause(&admin);
    client.deactivate_incentive(&incentive.id, &mfr);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_update_role() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);
    client.register_participant(&user, &ParticipantRole::Recycler, &symbol_short!("U"), &0, &0);
    client.pause(&admin);
    client.update_role(&user, &ParticipantRole::Collector);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_deregister_participant() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);
    client.register_participant(&user, &ParticipantRole::Recycler, &symbol_short!("U"), &0, &0);
    client.pause(&admin);
    client.deregister_participant(&user);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_donate_to_charity() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let charity = Address::generate(&env);
    let donor = Address::generate(&env);
    client.set_charity_contract(&admin, &charity);
    client.register_participant(&donor, &ParticipantRole::Recycler, &symbol_short!("D"), &0, &0);
    client.pause(&admin);
    client.donate_to_charity(&donor, &10);
}

#[test]
fn test_read_functions_work_while_paused() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let user = Address::generate(&env);
    client.register_participant(&user, &ParticipantRole::Recycler, &symbol_short!("U"), &0, &0);
    client.pause(&admin);
    // Read-only functions must still work
    assert!(client.is_paused());
    assert!(client.is_participant_registered(&user));
    assert!(client.get_participant(&user).is_some());
}
