//! Auth-failure coverage — issue #1754.
//!
//! Admin-gated entry points must refuse callers that are not in the admin set:
//!   - `transfer_admin` for a non-admin caller
//!   - `set_percentages` for a non-admin caller
//!
//! Success-path coverage lives in the other `contracts/scavenger/src/test_*.rs`
//! files; negative-path coverage lives in `test_negative_paths.rs`.
#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{ScavengerContract, ScavengerContractClient};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    env.mock_all_auths();
    client.initialize_admin(&admin);
    (client, admin)
}

#[test]
#[should_panic(expected = "UNAUTHORIZED")]
fn transfer_admin_fails_for_non_admin() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    client.transfer_admin(&non_admin, &vec![Address::generate(&env)]);
}

#[test]
#[should_panic(expected = "UNAUTHORIZED")]
fn set_percentages_fails_for_non_admin() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    client.set_percentages(&non_admin, &60, &50);
}
