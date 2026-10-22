//! Shared contract/account setup helpers for integration tests.
//!
//! Audit finding: many files under `stellar-contract/tests/*.rs` hand-roll the
//! same boilerplate — register the contract, generate an admin address, call
//! `initialize_admin`, then register one or more participants by role. That
//! logic was duplicated (with minor variations) across dozens of test files
//! instead of living in `tests/common`. This module centralizes it so new and
//! existing tests can share one implementation.
//!
//! ```rust,ignore
//! mod common;
//! use common::setup::*;
//!
//! #[test]
//! fn my_test() {
//!     let env = Env::default();
//!     let (client, admin, recycler) = setup_with_recycler(&env);
//! }
//! ```

#![allow(dead_code)]

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{
    ParticipantRole, ScavengerContract, ScavengerContractClient,
};

/// Register a fresh contract instance and return a client for it.
pub fn make_client(env: &Env) -> ScavengerContractClient<'_> {
    let contract_id = env.register_contract(None, ScavengerContract);
    ScavengerContractClient::new(env, &contract_id)
}

/// Register a fresh contract, mock all auths, and initialize an admin.
///
/// Returns `(client, admin)`.
pub fn setup_admin(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    env.mock_all_auths();
    let client = make_client(env);
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}

/// Register a participant with the given role using a short, deterministic name.
pub fn register_participant_with_role(
    env: &Env,
    client: &ScavengerContractClient,
    role: ParticipantRole,
    name: &str,
) -> Address {
    let participant = Address::generate(env);
    client.register_participant(
        &participant,
        &role,
        &soroban_sdk::Symbol::short(name),
        &0,
        &0,
    );
    participant
}

/// `setup_admin` plus a single registered recycler participant.
///
/// Returns `(client, admin, recycler)`.
pub fn setup_with_recycler(env: &Env) -> (ScavengerContractClient<'_>, Address, Address) {
    let (client, admin) = setup_admin(env);
    let recycler = register_participant_with_role(env, &client, ParticipantRole::Recycler, "recycler");
    (client, admin, recycler)
}

/// `setup_admin` plus one registered participant of each common role.
///
/// Returns `(client, admin, recycler, collector, manufacturer)`.
pub fn setup_full_env(
    env: &Env,
) -> (ScavengerContractClient<'_>, Address, Address, Address, Address) {
    let (client, admin) = setup_admin(env);
    let recycler = register_participant_with_role(env, &client, ParticipantRole::Recycler, "recycler");
    let collector = register_participant_with_role(env, &client, ParticipantRole::Collector, "col");
    let manufacturer =
        register_participant_with_role(env, &client, ParticipantRole::Manufacturer, "mfg");
    (client, admin, recycler, collector, manufacturer)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn setup_admin_initializes_a_distinct_admin_address() {
        let env = Env::default();
        let (_, admin) = setup_admin(&env);
        assert_ne!(admin, Address::generate(&env));
    }

    #[test]
    fn setup_full_env_registers_three_distinct_participants() {
        let env = Env::default();
        let (_, admin, recycler, collector, manufacturer) = setup_full_env(&env);
        assert_ne!(recycler, collector);
        assert_ne!(collector, manufacturer);
        assert_ne!(recycler, admin);
    }
}
