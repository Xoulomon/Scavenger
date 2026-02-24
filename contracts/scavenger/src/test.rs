#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{ScavengerContract, ScavengerContractClient};

fn create_test_contract(env: &Env) -> (ScavengerContractClient, Address, Address, Address) {
    let contract_id = env.register(ScavengerContract, ());
    let client = ScavengerContractClient::new(env, &contract_id);
    
    let admin = Address::generate(env);
    let token_address = Address::generate(env);
    let charity_address = Address::generate(env);
    
    (client, admin, token_address, charity_address)
}

#[test]
fn test_initialization() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_token_address(), token_address);
    assert_eq!(client.get_charity_address(), charity_address);
    assert_eq!(client.get_collector_percentage(), 30);
    assert_eq!(client.get_owner_percentage(), 20);
    assert_eq!(client.get_total_earned(), 0);
}

#[test]
#[should_panic(expected = "Total percentages cannot exceed 100")]
fn test_initialization_invalid_percentages() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    
    // This should panic because 60 + 50 = 110 > 100
    client.__constructor(&admin, &token_address, &charity_address, &60, &50);
}

#[test]
fn test_update_token_address() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let new_token_address = Address::generate(&env);
    client.update_token_address(&admin, &new_token_address);
    
    assert_eq!(client.get_token_address(), new_token_address);
}

#[test]
fn test_update_charity_address() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let new_charity_address = Address::generate(&env);
    client.update_charity_address(&admin, &new_charity_address);
    
    assert_eq!(client.get_charity_address(), new_charity_address);
}

#[test]
fn test_update_collector_percentage() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    client.update_collector_percentage(&admin, &40);
    
    assert_eq!(client.get_collector_percentage(), 40);
}

#[test]
#[should_panic(expected = "Total percentages cannot exceed 100")]
fn test_update_collector_percentage_invalid() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    // This should panic because 85 + 20 = 105 > 100
    client.update_collector_percentage(&admin, &85);
}

#[test]
fn test_update_owner_percentage() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    client.update_owner_percentage(&admin, &25);
    
    assert_eq!(client.get_owner_percentage(), 25);
}

#[test]
#[should_panic(expected = "Total percentages cannot exceed 100")]
fn test_update_owner_percentage_invalid() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    // This should panic because 30 + 75 = 105 > 100
    client.update_owner_percentage(&admin, &75);
}

#[test]
fn test_update_percentages() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    client.update_percentages(&admin, &35, &25);
    
    assert_eq!(client.get_collector_percentage(), 35);
    assert_eq!(client.get_owner_percentage(), 25);
}

#[test]
#[should_panic(expected = "Total percentages cannot exceed 100")]
fn test_update_percentages_invalid() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    // This should panic because 60 + 50 = 110 > 100
    client.update_percentages(&admin, &60, &50);
}

#[test]
fn test_transfer_admin() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let new_admin = Address::generate(&env);
    client.transfer_admin(&admin, &new_admin);
    
    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn test_configuration_persistence() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    // Verify all configuration persists correctly
    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_token_address(), token_address);
    assert_eq!(client.get_charity_address(), charity_address);
    assert_eq!(client.get_collector_percentage(), 30);
    assert_eq!(client.get_owner_percentage(), 20);
    assert_eq!(client.get_total_earned(), 0);
    
    // Update values
    let new_token = Address::generate(&env);
    let new_charity = Address::generate(&env);
    client.update_token_address(&admin, &new_token);
    client.update_charity_address(&admin, &new_charity);
    client.update_percentages(&admin, &40, &30);
    
    // Verify persistence after updates
    assert_eq!(client.get_token_address(), new_token);
    assert_eq!(client.get_charity_address(), new_charity);
    assert_eq!(client.get_collector_percentage(), 40);
    assert_eq!(client.get_owner_percentage(), 30);
}

// Incentive Creation Tests

use crate::types::{Role, WasteType};
use soroban_sdk::String;

#[test]
fn test_register_participant() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let manufacturer = Address::generate(&env);
    let name = String::from_str(&env, "Test Manufacturer");
    
    let participant = client.register_participant(&manufacturer, &Role::Manufacturer, &name, &100, &200);
    
    assert_eq!(participant.address, manufacturer);
    assert_eq!(participant.role, Role::Manufacturer);
    assert_eq!(participant.name, name);
    assert_eq!(participant.latitude, 100);
    assert_eq!(participant.longitude, 200);
}

#[test]
fn test_create_incentive() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    // Register manufacturer
    let manufacturer = Address::generate(&env);
    let name = String::from_str(&env, "Test Manufacturer");
    client.register_participant(&manufacturer, &Role::Manufacturer, &name, &100, &200);
    
    // Create incentive
    let incentive = client.create_incentive(&manufacturer, &WasteType::PetPlastic, &50, &10000);
    
    assert_eq!(incentive.id, 1);
    assert_eq!(incentive.rewarder, manufacturer);
    assert_eq!(incentive.waste_type, WasteType::PetPlastic);
    assert_eq!(incentive.reward_points, 50);
    assert_eq!(incentive.total_budget, 10000);
    assert_eq!(incentive.remaining_budget, 10000);
    assert!(incentive.active);
}

#[test]
#[should_panic(expected = "Rewarder not registered")]
fn test_create_incentive_unregistered() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let manufacturer = Address::generate(&env);
    
    // Try to create incentive without registration
    client.create_incentive(&manufacturer, &WasteType::Metal, &100, &5000);
}

#[test]
#[should_panic(expected = "Only manufacturers can create incentives")]
fn test_create_incentive_wrong_role() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    // Register as recycler
    let recycler = Address::generate(&env);
    let name = String::from_str(&env, "Test Recycler");
    client.register_participant(&recycler, &Role::Recycler, &name, &100, &200);
    
    // Try to create incentive - should fail
    client.create_incentive(&recycler, &WasteType::Plastic, &30, &8000);
}

#[test]
fn test_get_incentive_by_id() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let manufacturer = Address::generate(&env);
    let name = String::from_str(&env, "Test Manufacturer");
    client.register_participant(&manufacturer, &Role::Manufacturer, &name, &100, &200);
    
    let created = client.create_incentive(&manufacturer, &WasteType::Glass, &40, &7000);
    
    let retrieved = client.get_incentive_by_id(&created.id);
    assert!(retrieved.is_some());
    let retrieved = retrieved.unwrap();
    assert_eq!(retrieved.id, created.id);
    assert_eq!(retrieved.waste_type, WasteType::Glass);
    assert_eq!(retrieved.reward_points, 40);
}

#[test]
fn test_incentive_exists() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let manufacturer = Address::generate(&env);
    let name = String::from_str(&env, "Test Manufacturer");
    client.register_participant(&manufacturer, &Role::Manufacturer, &name, &100, &200);
    
    assert!(!client.incentive_exists(&1));
    
    client.create_incentive(&manufacturer, &WasteType::Paper, &20, &5000);
    
    assert!(client.incentive_exists(&1));
    assert!(!client.incentive_exists(&2));
}

#[test]
fn test_multiple_incentives_per_manufacturer() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let manufacturer = Address::generate(&env);
    let name = String::from_str(&env, "Test Manufacturer");
    client.register_participant(&manufacturer, &Role::Manufacturer, &name, &100, &200);
    
    // Create multiple incentives
    let i1 = client.create_incentive(&manufacturer, &WasteType::PetPlastic, &50, &10000);
    let i2 = client.create_incentive(&manufacturer, &WasteType::Metal, &100, &15000);
    let i3 = client.create_incentive(&manufacturer, &WasteType::Glass, &30, &8000);
    
    assert_eq!(i1.id, 1);
    assert_eq!(i2.id, 2);
    assert_eq!(i3.id, 3);
    
    // Verify all exist
    assert!(client.incentive_exists(&1));
    assert!(client.incentive_exists(&2));
    assert!(client.incentive_exists(&3));
}

#[test]
fn test_get_incentives_by_rewarder() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let manufacturer1 = Address::generate(&env);
    let manufacturer2 = Address::generate(&env);
    let name1 = String::from_str(&env, "Manufacturer 1");
    let name2 = String::from_str(&env, "Manufacturer 2");
    
    client.register_participant(&manufacturer1, &Role::Manufacturer, &name1, &100, &200);
    client.register_participant(&manufacturer2, &Role::Manufacturer, &name2, &300, &400);
    
    // Manufacturer1 creates 3 incentives
    client.create_incentive(&manufacturer1, &WasteType::Paper, &20, &5000);
    client.create_incentive(&manufacturer1, &WasteType::Plastic, &30, &6000);
    client.create_incentive(&manufacturer1, &WasteType::Metal, &50, &8000);
    
    // Manufacturer2 creates 2 incentives
    client.create_incentive(&manufacturer2, &WasteType::Glass, &40, &7000);
    client.create_incentive(&manufacturer2, &WasteType::PetPlastic, &60, &9000);
    
    // Check manufacturer1's incentives
    let m1_incentives = client.get_incentives_by_rewarder(&manufacturer1);
    assert_eq!(m1_incentives.len(), 3);
    assert_eq!(m1_incentives.get(0).unwrap(), 1);
    assert_eq!(m1_incentives.get(1).unwrap(), 2);
    assert_eq!(m1_incentives.get(2).unwrap(), 3);
    
    // Check manufacturer2's incentives
    let m2_incentives = client.get_incentives_by_rewarder(&manufacturer2);
    assert_eq!(m2_incentives.len(), 2);
    assert_eq!(m2_incentives.get(0).unwrap(), 4);
    assert_eq!(m2_incentives.get(1).unwrap(), 5);
}

#[test]
fn test_get_incentives_by_waste_type() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let manufacturer1 = Address::generate(&env);
    let manufacturer2 = Address::generate(&env);
    let name1 = String::from_str(&env, "Manufacturer 1");
    let name2 = String::from_str(&env, "Manufacturer 2");
    
    client.register_participant(&manufacturer1, &Role::Manufacturer, &name1, &100, &200);
    client.register_participant(&manufacturer2, &Role::Manufacturer, &name2, &300, &400);
    
    // Create incentives for different waste types
    client.create_incentive(&manufacturer1, &WasteType::PetPlastic, &50, &10000);
    client.create_incentive(&manufacturer2, &WasteType::PetPlastic, &60, &12000);
    client.create_incentive(&manufacturer1, &WasteType::Metal, &100, &15000);
    client.create_incentive(&manufacturer2, &WasteType::Glass, &40, &8000);
    
    // Check PetPlastic incentives
    let pet_incentives = client.get_incentives_by_waste_type(&WasteType::PetPlastic);
    assert_eq!(pet_incentives.len(), 2);
    assert_eq!(pet_incentives.get(0).unwrap(), 1);
    assert_eq!(pet_incentives.get(1).unwrap(), 2);
    
    // Check Metal incentives
    let metal_incentives = client.get_incentives_by_waste_type(&WasteType::Metal);
    assert_eq!(metal_incentives.len(), 1);
    assert_eq!(metal_incentives.get(0).unwrap(), 3);
    
    // Check Glass incentives
    let glass_incentives = client.get_incentives_by_waste_type(&WasteType::Glass);
    assert_eq!(glass_incentives.len(), 1);
    assert_eq!(glass_incentives.get(0).unwrap(), 4);
    
    // Check Paper incentives (none created)
    let paper_incentives = client.get_incentives_by_waste_type(&WasteType::Paper);
    assert_eq!(paper_incentives.len(), 0);
}

#[test]
fn test_incentive_id_counter_increments() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let manufacturer = Address::generate(&env);
    let name = String::from_str(&env, "Test Manufacturer");
    client.register_participant(&manufacturer, &Role::Manufacturer, &name, &100, &200);
    
    // Create multiple incentives and verify IDs increment
    let i1 = client.create_incentive(&manufacturer, &WasteType::Paper, &20, &5000);
    let i2 = client.create_incentive(&manufacturer, &WasteType::Plastic, &30, &6000);
    let i3 = client.create_incentive(&manufacturer, &WasteType::Metal, &50, &8000);
    
    assert_eq!(i1.id, 1);
    assert_eq!(i2.id, 2);
    assert_eq!(i3.id, 3);
}

#[test]
fn test_all_waste_types() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let manufacturer = Address::generate(&env);
    let name = String::from_str(&env, "Test Manufacturer");
    client.register_participant(&manufacturer, &Role::Manufacturer, &name, &100, &200);
    
    // Create incentives for all waste types
    let paper = client.create_incentive(&manufacturer, &WasteType::Paper, &20, &5000);
    let pet = client.create_incentive(&manufacturer, &WasteType::PetPlastic, &50, &10000);
    let plastic = client.create_incentive(&manufacturer, &WasteType::Plastic, &30, &7000);
    let metal = client.create_incentive(&manufacturer, &WasteType::Metal, &100, &15000);
    let glass = client.create_incentive(&manufacturer, &WasteType::Glass, &40, &8000);
    
    assert_eq!(paper.waste_type, WasteType::Paper);
    assert_eq!(pet.waste_type, WasteType::PetPlastic);
    assert_eq!(plastic.waste_type, WasteType::Plastic);
    assert_eq!(metal.waste_type, WasteType::Metal);
    assert_eq!(glass.waste_type, WasteType::Glass);
}

#[test]
fn test_all_role_types() {
    let env = Env::default();
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    
    env.mock_all_auths();
    client.__constructor(&admin, &token_address, &charity_address, &30, &20);
    
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let manufacturer = Address::generate(&env);
    
    let name1 = String::from_str(&env, "Recycler");
    let name2 = String::from_str(&env, "Collector");
    let name3 = String::from_str(&env, "Manufacturer");
    
    let p1 = client.register_participant(&recycler, &Role::Recycler, &name1, &100, &200);
    let p2 = client.register_participant(&collector, &Role::Collector, &name2, &300, &400);
    let p3 = client.register_participant(&manufacturer, &Role::Manufacturer, &name3, &500, &600);
    
    assert_eq!(p1.role, Role::Recycler);
    assert_eq!(p2.role, Role::Collector);
    assert_eq!(p3.role, Role::Manufacturer);
}
