use soroban_sdk::{
    symbol_short, testutils::{Address as _, Events}, Address, Env, IntoVal, String, Vec,
};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

#[test]
fn test_valid_transfer_recycler_to_collector() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);

    let transfer = client.transfer_waste_v2(&waste_id, &recycler, &collector, &41_000_000, &-75_000_000);

    assert_eq!(transfer.from, recycler);
    assert_eq!(transfer.to, collector);
    assert_eq!(transfer.waste_id, waste_id);
}

#[test]
fn test_valid_transfer_recycler_to_manufacturer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    let transfer = client.transfer_waste_v2(&waste_id, &recycler, &manufacturer, &41_000_000, &-75_000_000);

    assert_eq!(transfer.from, recycler);
    assert_eq!(transfer.to, manufacturer);
}

#[test]
fn test_valid_transfer_collector_to_manufacturer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &300, &400);
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &500, &600);

    let waste_id = client.recycle_waste(&WasteType::Glass, &1500, &recycler, &40_000_000, &-74_000_000);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &41_000_000, &-75_000_000);

    let transfer = client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &42_000_000, &-76_000_000);

    assert_eq!(transfer.from, collector);
    assert_eq!(transfer.to, manufacturer);
}

#[test]
#[should_panic(expected = "Invalid transfer")]
fn test_invalid_transfer_collector_to_recycler() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let recycler2 = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec1"), &100, &200);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &300, &400);
    client.register_participant(&recycler2, &ParticipantRole::Recycler, &symbol_short!("Rec2"), &500, &600);

    let waste_id = client.recycle_waste(&WasteType::Paper, &2000, &recycler, &40_000_000, &-74_000_000);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &41_000_000, &-75_000_000);

    client.transfer_waste_v2(&waste_id, &collector, &recycler2, &42_000_000, &-76_000_000);
}

#[test]
#[should_panic(expected = "Invalid transfer")]
fn test_invalid_transfer_manufacturer_to_collector() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let manufacturer = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &300, &400);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &500, &600);

    let waste_id = client.recycle_waste(&WasteType::Paper, &1800, &recycler, &40_000_000, &-74_000_000);
    client.transfer_waste_v2(&waste_id, &recycler, &manufacturer, &41_000_000, &-75_000_000);

    client.transfer_waste_v2(&waste_id, &manufacturer, &collector, &42_000_000, &-76_000_000);
}

#[test]
#[should_panic(expected = "Caller is not the owner of this waste item")]
fn test_non_owner_transfer_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let attacker = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &300, &400);
    client.register_participant(&attacker, &ParticipantRole::Recycler, &symbol_short!("Att"), &500, &600);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);

    client.transfer_waste_v2(&waste_id, &attacker, &collector, &41_000_000, &-75_000_000);
}

#[test]
#[should_panic(expected = "Sender not registered")]
fn test_transfer_from_unregistered_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let unregistered = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    client.transfer_waste(&(waste_id as u64), &unregistered, &collector, &String::from_str(&env, "note"));
}

#[test]
#[should_panic(expected = "Receiver not registered")]
fn test_transfer_to_unregistered_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let unregistered = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    let waste_id = client.recycle_waste(&WasteType::Glass, &1500, &recycler, &40_000_000, &-74_000_000);

    client.transfer_waste(&(waste_id as u64), &recycler, &unregistered, &String::from_str(&env, "note"));
}

#[test]
fn test_transfer_history_updates() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &300, &400);
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &500, &600);

    let waste_id = client.recycle_waste(&WasteType::Paper, &2000, &recycler, &40_000_000, &-74_000_000);

    client.transfer_waste_v2(&waste_id, &recycler, &collector, &41_000_000, &-75_000_000);
    client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &42_000_000, &-76_000_000);

    let history = client.get_waste_transfer_history(&(waste_id as u64));

    assert_eq!(history.len(), 2);
    assert_eq!(history.get(0).unwrap().from, recycler);
    assert_eq!(history.get(0).unwrap().to, collector);
    assert_eq!(history.get(1).unwrap().from, collector);
    assert_eq!(history.get(1).unwrap().to, manufacturer);
}

#[test]
fn test_ownership_updates_after_transfer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);

    client.transfer_waste_v2(&waste_id, &recycler, &collector, &41_000_000, &-75_000_000);

    // Verify transfer was recorded in history
    let history = client.get_waste_transfer_history(&(waste_id as u64));
    assert_eq!(history.len(), 1);
    assert_eq!(history.get(0).unwrap().from, recycler);
    assert_eq!(history.get(0).unwrap().to, collector);
}

#[test]
fn test_transfer_event_emission() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    client.transfer_waste_v2(&waste_id, &recycler, &collector, &41_000_000, &-75_000_000);

    let events = env.events().all();
    let event = events.last().unwrap();

    let expected_topics: Vec<soroban_sdk::Val> = (
        symbol_short!("transfer"),
        waste_id,
    ).into_val(&env);
    
    assert_eq!(event.0, contract_id);
    assert_eq!(event.1, expected_topics);
}
