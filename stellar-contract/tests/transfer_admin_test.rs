#![cfg(test)]

use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events},
    vec, Address, Env, IntoVal,
};
use stellar_scavngr_contract::{ScavengerContract, ScavengerContractClient};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    env.mock_all_auths();
    let client = ScavengerContractClient::new(env, &env.register_contract(None, ScavengerContract));
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}

#[test]
fn test_transfer_admin_success() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let new_admin = Address::generate(&env);
    client.transfer_admin(&admin, &vec![&env, new_admin.clone()]);
    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn test_transfer_admin_old_admin_loses_privileges() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let new_admin = Address::generate(&env);
    client.transfer_admin(&admin, &vec![&env, new_admin.clone()]);
    // new admin can transfer again
    let another = Address::generate(&env);
    client.transfer_admin(&new_admin, &vec![&env, another.clone()]);
    assert_eq!(client.get_admin(), another);
}

#[test]
#[should_panic(expected = "Unauthorized: caller is not admin")]
fn test_transfer_admin_non_admin_cannot_transfer() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    client.transfer_admin(&non_admin, &vec![&env, Address::generate(&env)]);
}

#[test]
#[should_panic(expected = "Admin list cannot be empty")]
fn test_transfer_admin_empty_list_rejected() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.transfer_admin(&admin, &vec![&env]);
}

#[test]
fn test_transfer_admin_emits_event() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.transfer_admin(&admin, &vec![&env, Address::generate(&env)]);
    let found = env
        .events()
        .all()
        .iter()
        .any(|(_, topics, _)| topics == soroban_sdk::vec![&env, symbol_short!("adm_xfr").into_val(&env)]);
    assert!(found, "AdminTransferred event not emitted");
}
