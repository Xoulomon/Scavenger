use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

#[test]
fn test_get_waste_v2() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);

    let waste = client.get_waste_v2(&waste_id).unwrap();

    assert_eq!(waste.waste_id, waste_id);
    assert_eq!(waste.waste_type, WasteType::Plastic);
    assert_eq!(waste.weight, 2500);
    assert_eq!(waste.current_owner, recycler);
    assert_eq!(waste.is_active, true);
}

#[test]
fn test_get_waste_nonexistent() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    let result = client.get_waste_v2(&999);

    assert!(result.is_none());
}

#[test]
fn test_get_participant_wastes() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    let waste1 = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);
    let waste2 = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &41_000_000, &-75_000_000);
    let waste3 = client.recycle_waste(&WasteType::Glass, &1500, &recycler, &42_000_000, &-76_000_000);

    let wastes = client.get_participant_wastes_v2(&recycler);

    assert_eq!(wastes.len(), 3);
    assert!(wastes.contains(&waste1));
    assert!(wastes.contains(&waste2));
    assert!(wastes.contains(&waste3));
}

#[test]
fn test_get_participant_wastes_empty() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    let wastes = client.get_participant_wastes_v2(&recycler);

    assert_eq!(wastes.len(), 0);
}

#[test]
fn test_get_waste_transfer_history() {
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
fn test_get_waste_transfer_history_empty() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    let waste_id = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    let history = client.get_waste_transfer_history(&(waste_id as u64));

    assert_eq!(history.len(), 0);
}

#[test]
fn test_get_participant_info() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    let material = client.submit_material(&WasteType::Plastic, &3000, &recycler, &soroban_sdk::String::from_str(&env, "test"));
    client.verify_material(&material.id, &recycler);

    let info = client.get_participant_info(&recycler).unwrap();

    assert_eq!(info.participant.address, recycler);
    assert_eq!(info.participant.role, ParticipantRole::Recycler);
    assert!(info.participant.total_tokens_earned > 0);
    assert_eq!(info.stats.total_submissions, 1);
}

#[test]
fn test_get_participant_info_nonexistent() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let nonexistent = Address::generate(&env);
    env.mock_all_auths();

    let result = client.get_participant_info(&nonexistent);

    assert!(result.is_none());
}

#[test]
fn test_get_incentives_by_waste_type() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer1 = Address::generate(&env);
    let manufacturer2 = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer1, &ParticipantRole::Manufacturer, &symbol_short!("M1"), &100, &200);
    client.register_participant(&manufacturer2, &ParticipantRole::Manufacturer, &symbol_short!("M2"), &300, &400);

    client.create_incentive(&manufacturer1, &WasteType::Plastic, &50, &10000);
    client.create_incentive(&manufacturer2, &WasteType::Plastic, &60, &12000);
    client.create_incentive(&manufacturer1, &WasteType::Metal, &40, &8000);

    let plastic_incentives = client.get_incentives_by_waste_type(&WasteType::Plastic);

    assert_eq!(plastic_incentives.len(), 2);
    assert!(plastic_incentives.iter().all(|i| i.waste_type == WasteType::Plastic));
}

#[test]
fn test_get_incentives_by_waste_type_empty() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    let incentives = client.get_incentives_by_waste_type(&WasteType::Glass);

    assert_eq!(incentives.len(), 0);
}

#[test]
fn test_get_incentive_by_id() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    let created = client.create_incentive(&manufacturer, &WasteType::Paper, &35, &7000);

    let retrieved = client.get_incentive_by_id(&created.id).unwrap();

    assert_eq!(retrieved.id, created.id);
    assert_eq!(retrieved.rewarder, manufacturer);
    assert_eq!(retrieved.waste_type, WasteType::Paper);
    assert_eq!(retrieved.reward_points, 35);
    assert_eq!(retrieved.total_budget, 7000);
}

#[test]
fn test_get_incentive_by_id_nonexistent() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    let result = client.get_incentive_by_id(&999);

    assert!(result.is_none());
}

#[test]
fn test_get_active_mfr_incentive() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    client.create_incentive(&manufacturer, &WasteType::Plastic, &50, &10000);
    client.create_incentive(&manufacturer, &WasteType::Plastic, &70, &15000);
    client.create_incentive(&manufacturer, &WasteType::Plastic, &60, &12000);

    let best = client.get_active_mfr_incentive(&manufacturer, &WasteType::Plastic).unwrap();

    assert_eq!(best.reward_points, 70);
    assert_eq!(best.waste_type, WasteType::Plastic);
}

#[test]
fn test_get_active_mfr_incentive_none() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    let result = client.get_active_mfr_incentive(&manufacturer, &WasteType::Metal);

    assert!(result.is_none());
}

#[test]
fn test_get_active_incentives() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    let incentive1 = client.create_incentive(&manufacturer, &WasteType::Plastic, &50, &10000);
    let incentive2 = client.create_incentive(&manufacturer, &WasteType::Metal, &40, &8000);
    let incentive3 = client.create_incentive(&manufacturer, &WasteType::Glass, &30, &6000);

    client.deactivate_incentive(&incentive1.id, &manufacturer);

    let active = client.get_active_incentives();

    assert_eq!(active.len(), 2);
    assert!(active.iter().all(|i| i.active));
    assert!(active.iter().any(|i| i.id == incentive2.id));
    assert!(active.iter().any(|i| i.id == incentive3.id));
}

#[test]
fn test_get_supply_chain_stats() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);

    client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);
    client.recycle_waste(&WasteType::Metal, &3000, &recycler, &41_000_000, &-75_000_000);

    let material = client.submit_material(&WasteType::Glass, &4000, &submitter, &soroban_sdk::String::from_str(&env, "test"));
    client.verify_material(&material.id, &recycler);

    let (total_wastes, total_weight, total_tokens) = client.get_supply_chain_stats();

    assert_eq!(total_wastes, 3);
    assert!(total_weight > 0);
    assert!(total_tokens > 0);
}

#[test]
fn test_get_supply_chain_stats_empty() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    let (total_wastes, total_weight, total_tokens) = client.get_supply_chain_stats();

    assert_eq!(total_wastes, 0);
    assert_eq!(total_weight, 0);
    assert_eq!(total_tokens, 0);
}

#[test]
fn test_get_participant() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    let participant = client.get_participant(&recycler).unwrap();

    assert_eq!(participant.address, recycler);
    assert_eq!(participant.role, ParticipantRole::Recycler);
    assert_eq!(participant.name, symbol_short!("Rec"));
    assert_eq!(participant.latitude, 100);
    assert_eq!(participant.longitude, 200);
    assert_eq!(participant.is_registered, true);
}

#[test]
fn test_get_participant_nonexistent() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let nonexistent = Address::generate(&env);
    env.mock_all_auths();

    let result = client.get_participant(&nonexistent);

    assert!(result.is_none());
}

#[test]
fn test_get_stats() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let submitter = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&submitter, &ParticipantRole::Recycler, &symbol_short!("Sub"), &300, &400);

    let material1 = client.submit_material(&WasteType::Plastic, &3000, &submitter, &soroban_sdk::String::from_str(&env, "test1"));
    let material2 = client.submit_material(&WasteType::Metal, &2000, &submitter, &soroban_sdk::String::from_str(&env, "test2"));

    client.verify_material(&material1.id, &recycler);

    let stats = client.get_stats(&submitter).unwrap();

    assert_eq!(stats.participant, submitter);
    assert_eq!(stats.total_submissions, 2);
    assert_eq!(stats.verified_submissions, 1);
    assert!(stats.total_weight > 0);
    assert!(stats.total_points > 0);
}

#[test]
fn test_get_stats_nonexistent() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let nonexistent = Address::generate(&env);
    env.mock_all_auths();

    let result = client.get_stats(&nonexistent);

    assert!(result.is_none());
}

#[test]
fn test_query_performance_multiple_wastes() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    // Create 10 wastes
    for i in 0..10 {
        client.recycle_waste(&WasteType::Plastic, &(2500 + i * 100), &recycler, &40_000_000, &-74_000_000);
    }

    let wastes = client.get_participant_wastes_v2(&recycler);

    assert_eq!(wastes.len(), 10);
}

#[test]
fn test_query_after_transfer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &300, &400);

    let waste_id = client.recycle_waste(&WasteType::Paper, &2000, &recycler, &40_000_000, &-74_000_000);

    client.transfer_waste_v2(&waste_id, &recycler, &collector, &41_000_000, &-75_000_000);

    let recycler_wastes = client.get_participant_wastes_v2(&recycler);
    let collector_wastes = client.get_participant_wastes_v2(&collector);

    assert_eq!(recycler_wastes.len(), 0);
    assert_eq!(collector_wastes.len(), 1);
    assert_eq!(collector_wastes.get(0).unwrap(), waste_id);
}

#[test]
fn test_get_waste_by_id_v1() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    let material = client.submit_material(&WasteType::Metal, &3000, &recycler, &soroban_sdk::String::from_str(&env, "test"));

    let retrieved = client.get_waste_by_id(&material.id).unwrap();

    assert_eq!(retrieved.id, material.id);
    assert_eq!(retrieved.waste_type, WasteType::Metal);
    assert_eq!(retrieved.weight, 3000);
    assert_eq!(retrieved.submitter, recycler);
}

#[test]
fn test_is_participant_registered() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let unregistered = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    assert_eq!(client.is_participant_registered(&recycler), true);
    assert_eq!(client.is_participant_registered(&unregistered), false);
}
