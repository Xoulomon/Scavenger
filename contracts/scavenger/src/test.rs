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
