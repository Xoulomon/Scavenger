#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String};

use crate::{ScavengerContract, ScavengerContractClient, types::{Role, WasteType}};

fn create_test_contract(env: &Env) -> (ScavengerContractClient, Address, Address, Address) {
    let contract_id = env.register(ScavengerContract, ());
    let client = ScavengerContractClient::new(env, &contract_id);
    
    let admin = Address::generate(env);
    let token_address = Address::generate(env);
    let charity_address = Address::generate(env);
    
    (client, admin, token_address, charity_address)
}

#[test]
fn test_recycler_to_collector_valid() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    client.initialize(&admin, &token_address, &charity_address, &5, &50);
    
    // Register recycler and collector
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    
    client.register_participant(
        &recycler,
        &Role::Recycler,
        &String::from_str(&env, "Recycler1"),
        &100,
        &200,
    );
    
    client.register_participant(
        &collector,
        &Role::Collector,
        &String::from_str(&env, "Collector1"),
        &300,
        &400,
    );
    
    // Submit material as recycler
    let material = client.submit_material(&recycler, &WasteType::Plastic, &1000);
    
    // Transfer from recycler to collector should succeed
    client.transfer_waste(&material.id, &recycler, &collector);
    
    // Verify transfer succeeded
    let updated_material = client.get_material(&material.id).unwrap();
    assert_eq!(updated_material.current_owner, collector);
}

#[test]
fn test_recycler_to_manufacturer_valid() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    client.initialize(&admin, &token_address, &charity_address, &5, &50);
    
    // Register recycler and manufacturer
    let recycler = Address::generate(&env);
    let manufacturer = Address::generate(&env);
    
    client.register_participant(
        &recycler,
        &Role::Recycler,
        &String::from_str(&env, "Recycler1"),
        &100,
        &200,
    );
    
    client.register_participant(
        &manufacturer,
        &Role::Manufacturer,
        &String::from_str(&env, "Manufacturer1"),
        &300,
        &400,
    );
    
    // Submit material as recycler
    let material = client.submit_material(&recycler, &WasteType::Plastic, &1000);
    
    // Transfer from recycler to manufacturer should succeed
    client.transfer_waste(&material.id, &recycler, &manufacturer);
    
    // Verify transfer succeeded
    let updated_material = client.get_material(&material.id).unwrap();
    assert_eq!(updated_material.current_owner, manufacturer);
}

#[test]
fn test_collector_to_manufacturer_valid() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    client.initialize(&admin, &token_address, &charity_address, &5, &50);
    
    // Register recycler, collector, and manufacturer
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let manufacturer = Address::generate(&env);
    
    client.register_participant(
        &recycler,
        &Role::Recycler,
        &String::from_str(&env, "Recycler1"),
        &100,
        &200,
    );
    
    client.register_participant(
        &collector,
        &Role::Collector,
        &String::from_str(&env, "Collector1"),
        &300,
        &400,
    );
    
    client.register_participant(
        &manufacturer,
        &Role::Manufacturer,
        &String::from_str(&env, "Manufacturer1"),
        &500,
        &600,
    );
    
    // Submit material as recycler
    let material = client.submit_material(&recycler, &WasteType::Plastic, &1000);
    
    // Transfer from recycler to collector
    client.transfer_waste(&material.id, &recycler, &collector);
    
    // Transfer from collector to manufacturer should succeed
    client.transfer_waste(&material.id, &collector, &manufacturer);
    
    // Verify transfer succeeded
    let updated_material = client.get_material(&material.id).unwrap();
    assert_eq!(updated_material.current_owner, manufacturer);
}

#[test]
#[should_panic(expected = "Invalid transfer path")]
fn test_recycler_to_recycler_invalid() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    client.initialize(&admin, &token_address, &charity_address, &5, &50);
    
    // Register two recyclers
    let recycler1 = Address::generate(&env);
    let recycler2 = Address::generate(&env);
    
    client.register_participant(
        &recycler1,
        &Role::Recycler,
        &String::from_str(&env, "Recycler1"),
        &100,
        &200,
    );
    
    client.register_participant(
        &recycler2,
        &Role::Recycler,
        &String::from_str(&env, "Recycler2"),
        &300,
        &400,
    );
    
    // Submit material as recycler1
    let material = client.submit_material(&recycler1, &WasteType::Plastic, &1000);
    
    // Transfer from recycler to recycler should fail
    client.transfer_waste(&material.id, &recycler1, &recycler2);
}

#[test]
#[should_panic(expected = "Invalid transfer path")]
fn test_collector_to_recycler_invalid() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    client.initialize(&admin, &token_address, &charity_address, &5, &50);
    
    // Register recycler and collector
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    
    client.register_participant(
        &recycler,
        &Role::Recycler,
        &String::from_str(&env, "Recycler1"),
        &100,
        &200,
    );
    
    client.register_participant(
        &collector,
        &Role::Collector,
        &String::from_str(&env, "Collector1"),
        &300,
        &400,
    );
    
    // Submit material as recycler
    let material = client.submit_material(&recycler, &WasteType::Plastic, &1000);
    
    // Transfer from recycler to collector
    client.transfer_waste(&material.id, &recycler, &collector);
    
    // Transfer from collector back to recycler should fail
    client.transfer_waste(&material.id, &collector, &recycler);
}

#[test]
#[should_panic(expected = "Invalid transfer path")]
fn test_collector_to_collector_invalid() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    client.initialize(&admin, &token_address, &charity_address, &5, &50);
    
    // Register recycler and two collectors
    let recycler = Address::generate(&env);
    let collector1 = Address::generate(&env);
    let collector2 = Address::generate(&env);
    
    client.register_participant(
        &recycler,
        &Role::Recycler,
        &String::from_str(&env, "Recycler1"),
        &100,
        &200,
    );
    
    client.register_participant(
        &collector1,
        &Role::Collector,
        &String::from_str(&env, "Collector1"),
        &300,
        &400,
    );
    
    client.register_participant(
        &collector2,
        &Role::Collector,
        &String::from_str(&env, "Collector2"),
        &500,
        &600,
    );
    
    // Submit material as recycler
    let material = client.submit_material(&recycler, &WasteType::Plastic, &1000);
    
    // Transfer from recycler to collector1
    client.transfer_waste(&material.id, &recycler, &collector1);
    
    // Transfer from collector1 to collector2 should fail
    client.transfer_waste(&material.id, &collector1, &collector2);
}

#[test]
#[should_panic(expected = "Invalid transfer path")]
fn test_manufacturer_to_any_invalid() {
    let env = Env::default();
    env.mock_all_auths();
    
    let (client, admin, token_address, charity_address) = create_test_contract(&env);
    client.initialize(&admin, &token_address, &charity_address, &5, &50);
    
    // Register recycler, manufacturer, and collector
    let recycler = Address::generate(&env);
    let manufacturer = Address::generate(&env);
    let collector = Address::generate(&env);
    
    client.register_participant(
        &recycler,
        &Role::Recycler,
        &String::from_str(&env, "Recycler1"),
        &100,
        &200,
    );
    
    client.register_participant(
        &manufacturer,
        &Role::Manufacturer,
        &String::from_str(&env, "Manufacturer1"),
        &300,
        &400,
    );
    
    client.register_participant(
        &collector,
        &Role::Collector,
        &String::from_str(&env, "Collector1"),
        &500,
        &600,
    );
    
    // Submit material as recycler
    let material = client.submit_material(&recycler, &WasteType::Plastic, &1000);
    
    // Transfer from recycler to manufacturer
    client.transfer_waste(&material.id, &recycler, &manufacturer);
    
    // Transfer from manufacturer to collector should fail (manufacturer is terminal)
    client.transfer_waste(&material.id, &manufacturer, &collector);
}
