use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

#[test]
fn test_incentive_creation_by_manufacturer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &50, &10000);

    assert_eq!(incentive.rewarder, manufacturer);
    assert_eq!(incentive.waste_type, WasteType::Plastic);
    assert_eq!(incentive.reward_points, 50);
    assert_eq!(incentive.total_budget, 10000);
    assert_eq!(incentive.remaining_budget, 10000);
    assert_eq!(incentive.active, true);
}

#[test]
#[should_panic(expected = "Caller is not a manufacturer")]
fn test_non_manufacturer_creation_fails_recycler() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    client.create_incentive(&recycler, &WasteType::Plastic, &50, &10000);
}

#[test]
#[should_panic(expected = "Caller is not a manufacturer")]
fn test_non_manufacturer_creation_fails_collector() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("Col"), &100, &200);

    client.create_incentive(&collector, &WasteType::Metal, &30, &5000);
}

#[test]
#[should_panic(expected = "Caller is not a registered participant")]
fn test_unregistered_creation_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let unregistered = Address::generate(&env);
    env.mock_all_auths();

    client.create_incentive(&unregistered, &WasteType::Paper, &20, &3000);
}

#[test]
fn test_incentive_update() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Glass, &40, &8000);

    let updated = client.update_incentive(&incentive.id, &60, &12000);

    assert_eq!(updated.reward_points, 60);
    assert_eq!(updated.total_budget, 12000);
    assert_eq!(updated.remaining_budget, 12000);
    assert_eq!(updated.active, true);
}

#[test]
#[should_panic(expected = "Incentive not found")]
fn test_update_nonexistent_incentive_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    client.update_incentive(&999, &50, &10000);
}

#[test]
#[should_panic(expected = "Reward must be greater than zero")]
fn test_update_with_zero_reward_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Metal, &40, &8000);

    client.update_incentive(&incentive.id, &0, &8000);
}

#[test]
#[should_panic(expected = "Total budget must be greater than zero")]
fn test_update_with_zero_budget_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Paper, &30, &5000);

    client.update_incentive(&incentive.id, &30, &0);
}

#[test]
fn test_incentive_deactivation() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &50, &10000);

    assert_eq!(incentive.active, true);

    let deactivated = client.deactivate_incentive(&incentive.id, &manufacturer);

    assert_eq!(deactivated.active, false);
    assert_eq!(deactivated.id, incentive.id);
}

#[test]
#[should_panic(expected = "Only incentive creator can deactivate")]
fn test_deactivation_by_non_creator_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer1 = Address::generate(&env);
    let manufacturer2 = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer1, &ParticipantRole::Manufacturer, &symbol_short!("Mfr1"), &100, &200);
    client.register_participant(&manufacturer2, &ParticipantRole::Manufacturer, &symbol_short!("Mfr2"), &300, &400);

    let incentive = client.create_incentive(&manufacturer1, &WasteType::Metal, &40, &8000);

    client.deactivate_incentive(&incentive.id, &manufacturer2);
}

#[test]
#[should_panic(expected = "Incentive not found")]
fn test_deactivate_nonexistent_incentive_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    client.deactivate_incentive(&999, &manufacturer);
}

#[test]
fn test_multiple_incentives_per_manufacturer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    let incentive1 = client.create_incentive(&manufacturer, &WasteType::Plastic, &50, &10000);
    let incentive2 = client.create_incentive(&manufacturer, &WasteType::Metal, &40, &8000);
    let incentive3 = client.create_incentive(&manufacturer, &WasteType::Glass, &30, &6000);

    assert_eq!(incentive1.waste_type, WasteType::Plastic);
    assert_eq!(incentive2.waste_type, WasteType::Metal);
    assert_eq!(incentive3.waste_type, WasteType::Glass);

    assert!(incentive1.id != incentive2.id);
    assert!(incentive2.id != incentive3.id);
    assert!(incentive1.id != incentive3.id);
}

#[test]
fn test_multiple_manufacturers_same_waste_type() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer1 = Address::generate(&env);
    let manufacturer2 = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer1, &ParticipantRole::Manufacturer, &symbol_short!("Mfr1"), &100, &200);
    client.register_participant(&manufacturer2, &ParticipantRole::Manufacturer, &symbol_short!("Mfr2"), &300, &400);

    let incentive1 = client.create_incentive(&manufacturer1, &WasteType::Plastic, &50, &10000);
    let incentive2 = client.create_incentive(&manufacturer2, &WasteType::Plastic, &60, &12000);

    assert_eq!(incentive1.rewarder, manufacturer1);
    assert_eq!(incentive2.rewarder, manufacturer2);
    assert_eq!(incentive1.reward_points, 50);
    assert_eq!(incentive2.reward_points, 60);
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
fn test_get_nonexistent_incentive_returns_none() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    env.mock_all_auths();

    let result = client.get_incentive_by_id(&999);

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

    client.register_participant(&manufacturer1, &ParticipantRole::Manufacturer, &symbol_short!("Mfr1"), &100, &200);
    client.register_participant(&manufacturer2, &ParticipantRole::Manufacturer, &symbol_short!("Mfr2"), &300, &400);

    client.create_incentive(&manufacturer1, &WasteType::Plastic, &50, &10000);
    client.create_incentive(&manufacturer2, &WasteType::Plastic, &60, &12000);
    client.create_incentive(&manufacturer1, &WasteType::Metal, &40, &8000);

    let plastic_incentives = client.get_incentives_by_waste_type(&WasteType::Plastic);

    assert_eq!(plastic_incentives.len(), 2);
    assert!(plastic_incentives.iter().all(|i| i.waste_type == WasteType::Plastic));
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

    client.deactivate_incentive(&incentive1.id, &manufacturer);

    let active = client.get_active_incentives();

    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap().id, incentive2.id);
    assert_eq!(active.get(0).unwrap().active, true);
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

    let best = client.get_active_mfr_incentive(&manufacturer, &WasteType::Plastic).unwrap();

    assert_eq!(best.reward_points, 70);
    assert_eq!(best.waste_type, WasteType::Plastic);
}

#[test]
fn test_get_active_mfr_incentive_returns_none_when_no_match() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    client.create_incentive(&manufacturer, &WasteType::Plastic, &50, &10000);

    let result = client.get_active_mfr_incentive(&manufacturer, &WasteType::Metal);

    assert!(result.is_none());
}

#[test]
fn test_deactivated_incentive_not_in_active_query() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Glass, &45, &9000);

    client.deactivate_incentive(&incentive.id, &manufacturer);

    let result = client.get_active_mfr_incentive(&manufacturer, &WasteType::Glass);

    assert!(result.is_none());
}

#[test]
#[should_panic(expected = "Incentive is not active")]
fn test_update_deactivated_incentive_fails() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Paper, &30, &6000);

    client.deactivate_incentive(&incentive.id, &manufacturer);

    client.update_incentive(&incentive.id, &40, &8000);
}

#[test]
fn test_incentive_status_update() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &symbol_short!("Mfr"), &100, &200);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Metal, &55, &11000);

    assert_eq!(incentive.active, true);

    let deactivated = client.update_incentive_status(&incentive.id, &false);
    assert_eq!(deactivated.active, false);

    let reactivated = client.update_incentive_status(&incentive.id, &true);
    assert_eq!(reactivated.active, true);
}
