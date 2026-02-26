#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{
    ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType,
};

fn setup_contract(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    client.initialize_admin(&admin);

    (client, admin)
}

#[test]
fn test_set_charity_contract_by_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_contract(&env);
    let charity = Address::generate(&env);

    client.set_charity_contract(&admin, &charity);

    assert_eq!(client.get_charity_contract(), Some(charity));
}

#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn test_set_charity_contract_by_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, _admin) = setup_contract(&env);
    let non_admin = Address::generate(&env);
    let charity = Address::generate(&env);

    client.set_charity_contract(&non_admin, &charity);
}

#[test]
fn test_set_percentage_by_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_contract(&env);

    client.set_percentages(&admin, &35, &25);

    assert_eq!(client.get_collector_percentage(), Some(35));
    assert_eq!(client.get_owner_percentage(), Some(25));
}

#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn test_set_percentage_by_non_admin_fails() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_contract(&env);
    let non_admin = Address::generate(&env);

    client.set_percentages(&admin, &30, &20);
    client.set_percentages(&non_admin, &40, &20);
}

#[test]
#[should_panic(expected = "Total percentages cannot exceed 100")]
fn test_invalid_percentages_fail() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_contract(&env);

    client.set_percentages(&admin, &90, &20);
}

#[test]
fn test_deactivate_waste_by_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let (client, admin) = setup_contract(&env);
    let collector = Address::generate(&env);

    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Collect"),
        &45_000_000,
        &-93_000_000,
    );

    let waste_id = client.recycle_waste(
        &WasteType::Plastic,
        &1_500,
        &collector,
        &45_000_000,
        &-93_000_000,
    );

    let deactivated = client.deactivate_waste(&waste_id, &admin);

    assert!(!deactivated.is_active);
    assert_eq!(deactivated.waste_id, waste_id);
}
