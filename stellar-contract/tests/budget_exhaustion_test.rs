#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{Error, ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup_test(env: &Env) -> (ScavengerContractClient<'_>, Address, Address, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    client.initialize_admin(&admin);

    let manufacturer = Address::generate(env);
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("MANUF"),
        &0,
        &0,
    );

    let collector = Address::generate(env);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("COLL"),
        &0,
        &0,
    );

    let recycler = Address::generate(env);
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("RECY"),
        &0,
        &0,
    );

    (client, manufacturer, collector, recycler)
}

#[test]
fn test_exact_budget_exhaustion() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, manufacturer, collector, recycler) = setup_test(&env);

    // Create incentive: 100 points per kg, budget 500
    // 5kg = 500 points (EXACT BUDGET)
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &500);

    // Submit 5kg of plastic
    let desc = soroban_sdk::String::from_str(&env, "Test");
    let material = client.submit_material(&WasteType::Plastic, &5000, &collector, &desc);
    client.verify_material(&material.id, &recycler);

    // Claim reward - should succeed and deactivate incentive
    let reward = client.claim_incentive_reward(&incentive.id, &material.id, &collector);
    assert_eq!(reward, 500);

    // Verify incentive is deactivated
    let updated_incentive = client.get_incentive_by_id(&incentive.id).unwrap();
    assert_eq!(updated_incentive.remaining_budget, 0);
    assert!(!updated_incentive.active);
}

#[test]
fn test_insufficient_budget_error() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, manufacturer, collector, recycler) = setup_test(&env);

    // Create incentive: 100 points per kg, budget 400
    // 5kg = 500 points (OVER BUDGET)
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &400);

    // Submit 5kg of plastic
    let desc = soroban_sdk::String::from_str(&env, "Test");
    let material = client.submit_material(&WasteType::Plastic, &5000, &collector, &desc);
    client.verify_material(&material.id, &recycler);

    // Try to claim reward - should fail with InsufficientBudget
    let result = client.try_claim_incentive_reward(&incentive.id, &material.id, &collector);

    assert_eq!(result, Err(Ok(Error::InsufficientBudget)));

    // Verify budget remains unchanged and active
    let updated_incentive = client.get_incentive_by_id(&incentive.id).unwrap();
    assert_eq!(updated_incentive.remaining_budget, 400);
    assert!(updated_incentive.active);
}
