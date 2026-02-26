#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};
use stellar_scavngr_contract::{
    ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType,
};

fn setup_contract(env: &Env) -> (ScavengerContractClient, Address, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let manufacturer = Address::generate(env);

    let name = soroban_sdk::symbol_short!("test");

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &name, &0, &0);

    (client, admin, recycler, manufacturer)
}

// ========== Zero Amount Tests ==========

#[test]
#[should_panic(expected = "Reward amount must be greater than zero")]
fn test_zero_token_reward() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    client.reward_tokens(&recycler, &recycler, &0, &1);
}

#[test]
fn test_zero_weight_waste_registration() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let waste_id = client.recycle_waste(
        &WasteType::Plastic,
        &0,
        &recycler,
        &1000000,
        &2000000,
    );

    assert!(waste_id > 0);
}

#[test]
#[should_panic(expected = "Total percentages cannot exceed 100")]
fn test_zero_percentages_invalid_sum() {
    let env = Env::default();
    let (client, admin, _, _) = setup_contract(&env);

    client.set_percentages(&admin, &101, &0);
}

#[test]
fn test_zero_budget_incentive() {
    let env = Env::default();
    let (client, _, _, manufacturer) = setup_contract(&env);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &0);

    assert_eq!(incentive.total_budget, 0);
    assert_eq!(incentive.remaining_budget, 0);
}

// ========== Maximum Value Tests ==========

#[test]
fn test_max_u64_weight() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let desc = String::from_str(&env, "Max weight");
    let max_weight = u64::MAX;

    let material = client.submit_material(&WasteType::Metal, &max_weight, &recycler, &desc);

    assert_eq!(material.weight, max_weight);
}

#[test]
fn test_max_u128_waste_weight() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let max_weight = u128::MAX;
    let waste_id = client.recycle_waste(
        &WasteType::Glass,
        &max_weight,
        &recycler,
        &0,
        &0,
    );

    assert!(waste_id > 0);
}

#[test]
fn test_max_coordinates() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let max_lat = 90_000_000i128;
    let max_lon = 180_000_000i128;

    let waste_id = client.recycle_waste(
        &WasteType::Paper,
        &1000,
        &recycler,
        &max_lat,
        &max_lon,
    );

    assert!(waste_id > 0);
}

#[test]
fn test_percentage_boundary_values() {
    let env = Env::default();
    let (client, admin, _, _) = setup_contract(&env);

    client.set_percentages(&admin, &100, &0);
    assert_eq!(client.get_collector_percentage(), Some(100));

    client.set_percentages(&admin, &0, &100);
    assert_eq!(client.get_owner_percentage(), Some(100));

    client.set_percentages(&admin, &50, &50);
    assert_eq!(client.get_collector_percentage(), Some(50));
    assert_eq!(client.get_owner_percentage(), Some(50));
}

// ========== Non-Existent ID Tests ==========

#[test]
fn test_get_nonexistent_waste() {
    let env = Env::default();
    let (client, _, _, _) = setup_contract(&env);

    let result = client.get_waste(&99999);
    assert_eq!(result, None);
}

#[test]
fn test_get_nonexistent_incentive() {
    let env = Env::default();
    let (client, _, _, _) = setup_contract(&env);

    let result = client.get_incentive_by_id(&99999);
    assert_eq!(result, None);
}

#[test]
fn test_get_nonexistent_participant() {
    let env = Env::default();
    let (client, _, _, _) = setup_contract(&env);

    let fake_address = Address::generate(&env);
    let result = client.get_participant(&fake_address);
    assert_eq!(result, None);
}

#[test]
fn test_waste_exists_nonexistent() {
    let env = Env::default();
    let (client, _, _, _) = setup_contract(&env);

    assert!(!client.waste_exists(&99999));
}

#[test]
fn test_incentive_exists_nonexistent() {
    let env = Env::default();
    let (client, _, _, _) = setup_contract(&env);

    assert!(!client.incentive_exists(&99999));
}

#[test]
#[should_panic(expected = "Waste not found")]
fn test_transfer_nonexistent_waste() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let collector = Address::generate(&env);
    let name = soroban_sdk::symbol_short!("test");
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &0, &0);

    let note = String::from_str(&env, "Transfer");
    client.transfer_waste(&99999, &recycler, &collector, &note);
}

#[test]
#[should_panic(expected = "Incentive not found")]
fn test_deactivate_nonexistent_incentive() {
    let env = Env::default();
    let (client, _, _, manufacturer) = setup_contract(&env);

    client.deactivate_incentive(&99999, &manufacturer);
}

// ========== Empty Vector Tests ==========

#[test]
fn test_empty_batch_submit() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let empty_vec: Vec<(WasteType, u64, String)> = Vec::new(&env);
    let results = client.submit_materials_batch(&empty_vec, &recycler);

    assert_eq!(results.len(), 0);
}

#[test]
fn test_empty_batch_get_wastes() {
    let env = Env::default();
    let (client, _, _, _) = setup_contract(&env);

    let empty_vec: Vec<u64> = Vec::new(&env);
    let results = client.get_wastes_batch(&empty_vec);

    assert_eq!(results.len(), 0);
}

#[test]
fn test_empty_batch_verify() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let empty_vec: Vec<u64> = Vec::new(&env);
    let results = client.verify_materials_batch(&empty_vec, &recycler);

    assert_eq!(results.len(), 0);
}

#[test]
fn test_get_participant_wastes_empty() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let wastes = client.get_participant_wastes(&recycler);
    assert_eq!(wastes.len(), 0);
}

#[test]
fn test_get_transfer_history_empty() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let desc = String::from_str(&env, "Test");
    let material = client.submit_material(&WasteType::Plastic, &1000, &recycler, &desc);

    let history = client.get_transfer_history(&material.id);
    assert_eq!(history.len(), 0);
}

#[test]
fn test_get_active_incentives_empty() {
    let env = Env::default();
    let (client, _, _, _) = setup_contract(&env);

    let incentives = client.get_active_incentives();
    assert_eq!(incentives.len(), 0);
}

// ========== Concurrent Operations Tests ==========

#[test]
fn test_multiple_participants_same_waste_type() {
    let env = Env::default();
    let (client, _, _, _) = setup_contract(&env);

    let recycler1 = Address::generate(&env);
    let recycler2 = Address::generate(&env);
    let recycler3 = Address::generate(&env);

    let name = soroban_sdk::symbol_short!("test");

    client.register_participant(&recycler1, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&recycler2, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&recycler3, &ParticipantRole::Recycler, &name, &0, &0);

    let desc = String::from_str(&env, "Concurrent");

    let m1 = client.submit_material(&WasteType::Plastic, &1000, &recycler1, &desc);
    let m2 = client.submit_material(&WasteType::Plastic, &2000, &recycler2, &desc);
    let m3 = client.submit_material(&WasteType::Plastic, &3000, &recycler3, &desc);

    assert_ne!(m1.id, m2.id);
    assert_ne!(m2.id, m3.id);
    assert_ne!(m1.id, m3.id);
}

#[test]
fn test_multiple_incentives_same_manufacturer() {
    let env = Env::default();
    let (client, _, _, manufacturer) = setup_contract(&env);

    let i1 = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &1000);
    let i2 = client.create_incentive(&manufacturer, &WasteType::Metal, &200, &2000);
    let i3 = client.create_incentive(&manufacturer, &WasteType::Glass, &150, &1500);

    assert_ne!(i1.id, i2.id);
    assert_ne!(i2.id, i3.id);
    assert_ne!(i1.id, i3.id);
}

#[test]
fn test_sequential_waste_id_generation() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let desc = String::from_str(&env, "Sequential");

    let m1 = client.submit_material(&WasteType::Paper, &1000, &recycler, &desc);
    let m2 = client.submit_material(&WasteType::Plastic, &2000, &recycler, &desc);
    let m3 = client.submit_material(&WasteType::Metal, &3000, &recycler, &desc);

    assert_eq!(m2.id, m1.id + 1);
    assert_eq!(m3.id, m2.id + 1);
}

// ========== Error Message Tests ==========

#[test]
#[should_panic(expected = "Caller is not a registered participant")]
fn test_unregistered_participant_error() {
    let env = Env::default();
    let (client, _, _, _) = setup_contract(&env);

    let unregistered = Address::generate(&env);
    let desc = String::from_str(&env, "Test");

    client.submit_material(&WasteType::Plastic, &1000, &unregistered, &desc);
}

#[test]
#[should_panic(expected = "Caller is not a manufacturer")]
fn test_non_manufacturer_create_incentive() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    client.create_incentive(&recycler, &WasteType::Plastic, &100, &1000);
}

#[test]
#[should_panic(expected = "Only waste owner can transfer")]
fn test_non_owner_transfer_error() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let collector = Address::generate(&env);
    let name = soroban_sdk::symbol_short!("test");
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &0, &0);

    let desc = String::from_str(&env, "Test");
    let material = client.submit_material(&WasteType::Plastic, &1000, &recycler, &desc);

    let note = String::from_str(&env, "Transfer");
    client.transfer_waste(&material.id, &collector, &recycler, &note);
}

#[test]
#[should_panic(expected = "Participant not found")]
fn test_update_nonexistent_participant_role() {
    let env = Env::default();
    let (client, _, _, _) = setup_contract(&env);

    let fake_address = Address::generate(&env);
    client.update_role(&fake_address, &ParticipantRole::Collector);
}

#[test]
#[should_panic(expected = "Admin already initialized")]
fn test_double_admin_initialization() {
    let env = Env::default();
    let (client, admin, _, _) = setup_contract(&env);

    let new_admin = Address::generate(&env);
    client.initialize_admin(&new_admin);
}

#[test]
#[should_panic(expected = "Total percentages cannot exceed 100")]
fn test_invalid_percentage_sum() {
    let env = Env::default();
    let (client, admin, _, _) = setup_contract(&env);

    client.set_percentages(&admin, &60, &50);
}

#[test]
#[should_panic(expected = "Only incentive creator can deactivate")]
fn test_non_creator_deactivate_incentive() {
    let env = Env::default();
    let (client, _, _, manufacturer) = setup_contract(&env);

    let other_manufacturer = Address::generate(&env);
    let name = soroban_sdk::symbol_short!("test");
    client.register_participant(&other_manufacturer, &ParticipantRole::Manufacturer, &name, &0, &0);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &1000);

    client.deactivate_incentive(&incentive.id, &other_manufacturer);
}

// ========== Boundary Condition Tests ==========

#[test]
fn test_single_item_batch_operations() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let desc = String::from_str(&env, "Single");
    let mut batch = Vec::new(&env);
    batch.push_back((WasteType::Plastic, 1000u64, desc));

    let results = client.submit_materials_batch(&batch, &recycler);
    assert_eq!(results.len(), 1);
}

#[test]
fn test_large_batch_operations() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let mut batch = Vec::new(&env);
    for i in 0..50 {
        let desc = String::from_str(&env, "Batch");
        batch.push_back((WasteType::Plastic, (i + 1) * 100, desc));
    }

    let results = client.submit_materials_batch(&batch, &recycler);
    assert_eq!(results.len(), 50);
}

#[test]
fn test_minimum_weight_material() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let desc = String::from_str(&env, "Min weight");
    let material = client.submit_material(&WasteType::Paper, &1, &recycler, &desc);

    assert_eq!(material.weight, 1);
    assert!(!material.meets_minimum_weight());
}

#[test]
fn test_exact_minimum_weight() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let desc = String::from_str(&env, "Exact min");
    let material = client.submit_material(&WasteType::Paper, &100, &recycler, &desc);

    assert_eq!(material.weight, 100);
    assert!(material.meets_minimum_weight());
}

#[test]
fn test_extreme_coordinates() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    let min_lat = -90_000_000i128;
    let min_lon = -180_000_000i128;

    let waste_id = client.recycle_waste(
        &WasteType::Metal,
        &1000,
        &recycler,
        &min_lat,
        &min_lon,
    );

    assert!(waste_id > 0);
}

#[test]
fn test_is_participant_registered_false() {
    let env = Env::default();
    let (client, _, _, _) = setup_contract(&env);

    let unregistered = Address::generate(&env);
    assert!(!client.is_participant_registered(&unregistered));
}

#[test]
fn test_is_participant_registered_true() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    assert!(client.is_participant_registered(&recycler));
}

#[test]
fn test_deregistered_participant() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    client.deregister_participant(&recycler);
    
    let participant = client.get_participant(&recycler).unwrap();
    assert!(!participant.is_registered);
}

#[test]
#[should_panic(expected = "Caller is not a registered participant")]
fn test_deregistered_cannot_submit() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);

    client.deregister_participant(&recycler);

    let desc = String::from_str(&env, "Test");
    client.submit_material(&WasteType::Plastic, &1000, &recycler, &desc);
}
