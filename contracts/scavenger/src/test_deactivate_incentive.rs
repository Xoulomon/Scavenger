#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::contract::ScavengerContract;
use crate::types::{Role, WasteType};

fn setup(env: &Env) -> (crate::contract::ScavengerContractClient<'_>, Address) {
    let contract_id = env.register(ScavengerContract, ());
    let client = crate::contract::ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let token_address = env.register_stellar_asset_contract(admin.clone());
    let charity_address = Address::generate(env);

    client.initialize(&admin, &token_address, &charity_address, &5, &50);

    (client, admin)
}

fn register_manufacturer(
    env: &Env,
    client: &crate::contract::ScavengerContractClient<'_>,
) -> Address {
    let manufacturer = Address::generate(env);
    client.register_participant(
        &manufacturer,
        &Role::Manufacturer,
        &soroban_sdk::String::from_str(env, "Acme Corp"),
        &1000000,
        &2000000,
    );
    manufacturer
}

#[test]
fn test_deactivate_incentive_success() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = setup(&env);
    let manufacturer = register_manufacturer(&env, &client);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Paper, &100, &5000);
    assert!(incentive.active);

    client.deactivate_incentive(&manufacturer, &incentive.id);

    let updated = client.get_incentive_by_id(&incentive.id).unwrap();
    assert!(!updated.active);
}

#[test]
fn test_deactivate_incentive_preserves_other_fields() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = setup(&env);
    let manufacturer = register_manufacturer(&env, &client);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Metal, &200, &8000);

    client.deactivate_incentive(&manufacturer, &incentive.id);

    let updated = client.get_incentive_by_id(&incentive.id).unwrap();
    assert_eq!(updated.id, incentive.id);
    assert_eq!(updated.rewarder, incentive.rewarder);
    assert_eq!(updated.waste_type, incentive.waste_type);
    assert_eq!(updated.reward_points, incentive.reward_points);
    assert_eq!(updated.total_budget, incentive.total_budget);
    assert_eq!(updated.remaining_budget, incentive.remaining_budget);
    assert!(!updated.active);
}

#[test]
fn test_deactivated_incentive_excluded_from_active_query() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = setup(&env);
    let manufacturer = register_manufacturer(&env, &client);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Glass, &150, &3000);
    assert!(client.get_active_incentive(&manufacturer, &WasteType::Glass).is_some());

    client.deactivate_incentive(&manufacturer, &incentive.id);

    assert!(client.get_active_incentive(&manufacturer, &WasteType::Glass).is_none());
}

#[test]
#[should_panic(expected = "Only rewarder can deactivate")]
fn test_deactivate_incentive_wrong_owner() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = setup(&env);
    let manufacturer = register_manufacturer(&env, &client);
    let other = register_manufacturer(&env, &client);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Paper, &100, &5000);

    client.deactivate_incentive(&other, &incentive.id);
}

#[test]
#[should_panic(expected = "Incentive is already inactive")]
fn test_deactivate_incentive_twice() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = setup(&env);
    let manufacturer = register_manufacturer(&env, &client);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &50, &2000);

    client.deactivate_incentive(&manufacturer, &incentive.id);
    client.deactivate_incentive(&manufacturer, &incentive.id);
}

#[test]
#[should_panic(expected = "Incentive not found")]
fn test_deactivate_incentive_not_found() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = setup(&env);
    let manufacturer = register_manufacturer(&env, &client);

    client.deactivate_incentive(&manufacturer, &9999);
}

#[test]
#[should_panic(expected = "Incentive not active")]
fn test_deactivated_incentive_not_used_for_rewards() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = setup(&env);
    let manufacturer = register_manufacturer(&env, &client);

    let submitter = Address::generate(&env);
    client.register_participant(
        &submitter,
        &Role::Recycler,
        &soroban_sdk::String::from_str(&env, "Recycler One"),
        &500000,
        &600000,
    );

    let incentive = client.create_incentive(&manufacturer, &WasteType::Paper, &100, &50000);
    let material = client.submit_material(&submitter, &WasteType::Paper, &5000);

    client.confirm_waste(&material.id, &manufacturer);
    client.deactivate_incentive(&manufacturer, &incentive.id);

    client.distribute_rewards(&material.id, &incentive.id, &manufacturer);
}
