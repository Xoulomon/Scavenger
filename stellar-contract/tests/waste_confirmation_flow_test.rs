use soroban_sdk::{symbol_short, testutils::{Address as _, Events}, Address, Env, IntoVal, Vec};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

#[test]
fn test_successful_confirmation() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let confirmer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&confirmer, &ParticipantRole::Collector, &symbol_short!("Con"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);

    let waste_before = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste_before.is_confirmed, false);

    let confirmed_waste = client.confirm_waste_details(&waste_id, &confirmer);

    assert_eq!(confirmed_waste.is_confirmed, true);
    assert_eq!(confirmed_waste.confirmer, confirmer);
}

#[test]
#[should_panic(expected = "Owner cannot confirm own waste")]
fn test_owner_cannot_confirm() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    let waste_id = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    client.confirm_waste_details(&waste_id, &recycler);
}

#[test]
#[should_panic(expected = "Waste already confirmed")]
fn test_double_confirmation_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let confirmer1 = Address::generate(&env);
    let confirmer2 = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&confirmer1, &ParticipantRole::Collector, &symbol_short!("C1"), &300, &400);
    client.register_participant(&confirmer2, &ParticipantRole::Collector, &symbol_short!("C2"), &500, &600);

    let waste_id = client.recycle_waste(&WasteType::Glass, &1500, &recycler, &40_000_000, &-74_000_000);

    client.confirm_waste_details(&waste_id, &confirmer1);
    client.confirm_waste_details(&waste_id, &confirmer2);
}

#[test]
fn test_reset_by_owner() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let confirmer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&confirmer, &ParticipantRole::Collector, &symbol_short!("Con"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Paper, &2000, &recycler, &40_000_000, &-74_000_000);

    client.confirm_waste_details(&waste_id, &confirmer);

    let waste_confirmed = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste_confirmed.is_confirmed, true);

    let reset_waste = client.reset_waste_confirmation(&waste_id, &recycler);

    assert_eq!(reset_waste.is_confirmed, false);
    assert_eq!(reset_waste.confirmer, recycler);
}

#[test]
#[should_panic(expected = "Caller is not the owner of this waste item")]
fn test_reset_by_non_owner_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let confirmer = Address::generate(&env);
    let attacker = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&confirmer, &ParticipantRole::Collector, &symbol_short!("Con"), &300, &400);
    client.register_participant(&attacker, &ParticipantRole::Recycler, &symbol_short!("Att"), &500, &600);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);

    client.confirm_waste_details(&waste_id, &confirmer);

    client.reset_waste_confirmation(&waste_id, &attacker);
}

#[test]
fn test_reconfirmation_after_reset() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let confirmer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&confirmer, &ParticipantRole::Collector, &symbol_short!("Con"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    // First confirmation
    client.confirm_waste_details(&waste_id, &confirmer);
    let waste_after_confirm = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste_after_confirm.is_confirmed, true);

    // Reset
    client.reset_waste_confirmation(&waste_id, &recycler);
    let waste_after_reset = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste_after_reset.is_confirmed, false);

    // Re-confirm
    let reconfirmed_waste = client.confirm_waste_details(&waste_id, &confirmer);
    assert_eq!(reconfirmed_waste.is_confirmed, true);
    assert_eq!(reconfirmed_waste.confirmer, confirmer);
}

#[test]
#[should_panic(expected = "Waste is not confirmed")]
fn test_reset_unconfirmed_waste_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    let waste_id = client.recycle_waste(&WasteType::Glass, &1500, &recycler, &40_000_000, &-74_000_000);

    client.reset_waste_confirmation(&waste_id, &recycler);
}

#[test]
#[should_panic(expected = "Cannot confirm deactivated waste")]
fn test_confirm_deactivated_waste_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let confirmer = Address::generate(&env);
    env.mock_all_auths();

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&confirmer, &ParticipantRole::Collector, &symbol_short!("Con"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Paper, &2000, &recycler, &40_000_000, &-74_000_000);

    client.deactivate_waste(&waste_id, &admin);

    client.confirm_waste_details(&waste_id, &confirmer);
}

#[test]
fn test_confirmation_event_emission() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let confirmer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&confirmer, &ParticipantRole::Collector, &symbol_short!("Con"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);

    client.confirm_waste_details(&waste_id, &confirmer);

    let events = env.events().all();
    let event = events.last().unwrap();

    let expected_topics: Vec<soroban_sdk::Val> = (
        symbol_short!("confirmed"),
        waste_id,
    ).into_val(&env);

    assert_eq!(event.0, contract_id);
    assert_eq!(event.1, expected_topics);
}

#[test]
fn test_reset_event_emission() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let confirmer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&confirmer, &ParticipantRole::Collector, &symbol_short!("Con"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    client.confirm_waste_details(&waste_id, &confirmer);
    client.reset_waste_confirmation(&waste_id, &recycler);

    let events = env.events().all();
    let event = events.last().unwrap();

    let expected_topics: Vec<soroban_sdk::Val> = (
        symbol_short!("reset"),
        waste_id,
    ).into_val(&env);

    assert_eq!(event.0, contract_id);
    assert_eq!(event.1, expected_topics);
}

#[test]
fn test_multiple_reset_confirm_cycles() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let confirmer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&confirmer, &ParticipantRole::Collector, &symbol_short!("Con"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Glass, &1500, &recycler, &40_000_000, &-74_000_000);

    // Cycle 1
    client.confirm_waste_details(&waste_id, &confirmer);
    assert_eq!(client.get_waste_v2(&waste_id).unwrap().is_confirmed, true);
    
    client.reset_waste_confirmation(&waste_id, &recycler);
    assert_eq!(client.get_waste_v2(&waste_id).unwrap().is_confirmed, false);

    // Cycle 2
    client.confirm_waste_details(&waste_id, &confirmer);
    assert_eq!(client.get_waste_v2(&waste_id).unwrap().is_confirmed, true);
    
    client.reset_waste_confirmation(&waste_id, &recycler);
    assert_eq!(client.get_waste_v2(&waste_id).unwrap().is_confirmed, false);

    // Cycle 3
    client.confirm_waste_details(&waste_id, &confirmer);
    assert_eq!(client.get_waste_v2(&waste_id).unwrap().is_confirmed, true);
}

#[test]
fn test_confirmer_updates_correctly() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let confirmer1 = Address::generate(&env);
    let confirmer2 = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&confirmer1, &ParticipantRole::Collector, &symbol_short!("C1"), &300, &400);
    client.register_participant(&confirmer2, &ParticipantRole::Collector, &symbol_short!("C2"), &500, &600);

    let waste_id = client.recycle_waste(&WasteType::Paper, &2000, &recycler, &40_000_000, &-74_000_000);

    // First confirmation
    client.confirm_waste_details(&waste_id, &confirmer1);
    assert_eq!(client.get_waste_v2(&waste_id).unwrap().confirmer, confirmer1);

    // Reset and re-confirm with different confirmer
    client.reset_waste_confirmation(&waste_id, &recycler);
    client.confirm_waste_details(&waste_id, &confirmer2);
    assert_eq!(client.get_waste_v2(&waste_id).unwrap().confirmer, confirmer2);
}

#[test]
#[should_panic(expected = "Waste not found")]
fn test_confirm_nonexistent_waste_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let confirmer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&confirmer, &ParticipantRole::Collector, &symbol_short!("Con"), &300, &400);

    client.confirm_waste_details(&999, &confirmer);
}

#[test]
#[should_panic(expected = "Waste item not found")]
fn test_reset_nonexistent_waste_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    client.reset_waste_confirmation(&999, &recycler);
}
