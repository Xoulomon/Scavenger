//! Security / authorization test suite — closes #949.
//!
//! Validates that every protected contract function:
//!   1. Rejects callers that lack the required role/permission.
//!   2. Accepts callers that hold the correct role/permission.
//!   3. Rejects structural tampering (percentage overflow, token manipulation).
//!
//! # Strategy
//!
//! Soroban's test environment enforces contract-level authorization checks
//! (`require_auth`, admin/role guards) even when `mock_all_auths()` is active.
//! `mock_all_auths()` only satisfies the cryptographic signature check; it
//! does NOT bypass the contract's own `if caller != admin { panic!(...) }`
//! guards.
//!
//! Therefore:
//! - Happy-path tests call `mock_all_auths()` and use the correct caller.
//! - Negative-path tests call `mock_all_auths()` but pass a *wrong* caller —
//!   the contract's logic guard fires and panics regardless of auth mocking.

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, vec, Address, Env, Vec};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

// ── Shared setup ──────────────────────────────────────────────────────────────

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address, Address, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let collector = Address::generate(env);
    let manufacturer = Address::generate(env);
    let name = soroban_sdk::symbol_short!("test");
    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &0i128, &0i128);
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &0i128, &0i128);
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &name, &0i128, &0i128);
    (client, admin, recycler, collector, manufacturer)
}

// ── transfer_admin ────────────────────────────────────────────────────────────

/// Admin can transfer admin rights to a new address.
#[test]
fn authz_admin_can_transfer_admin() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    let new_admin = Address::generate(&env);
    let new_admins: Vec<Address> = vec![&env, new_admin.clone()];
    // Should NOT panic
    client.transfer_admin(&admin, &new_admins);
}

/// Non-admin calling transfer_admin must panic.
#[test]
#[should_panic(expected = "Unauthorized: caller is not admin")]
fn authz_non_admin_cannot_transfer_admin() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);
    let new_admin = Address::generate(&env);
    let new_admins: Vec<Address> = vec![&env, new_admin.clone()];
    // recycler is not admin — must panic
    client.transfer_admin(&recycler, &new_admins);
}

/// Passing an empty admin list to transfer_admin must panic.
#[test]
#[should_panic(expected = "Admin list cannot be empty")]
fn authz_transfer_admin_empty_list_rejected() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    let empty: Vec<Address> = Vec::new(&env);
    client.transfer_admin(&admin, &empty);
}

/// After transfer_admin, the old admin no longer has privileges.
#[test]
#[should_panic(expected = "Unauthorized: caller is not admin")]
fn authz_old_admin_loses_privileges_after_transfer() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    let new_admin = Address::generate(&env);
    let new_admins: Vec<Address> = vec![&env, new_admin.clone()];
    client.transfer_admin(&admin, &new_admins);
    // old admin tries to transfer again — must panic
    let another: Vec<Address> = vec![&env, Address::generate(&env)];
    client.transfer_admin(&admin, &another);
}

// ── set_percentages ───────────────────────────────────────────────────────────

/// Admin can set reward percentages.
#[test]
fn authz_admin_can_set_percentages() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    client.set_percentages(&admin, &30u32, &40u32);
}

/// Non-admin calling set_percentages must panic.
#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn authz_non_admin_cannot_set_percentages() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);
    client.set_percentages(&recycler, &30u32, &40u32);
}

/// Token tampering via percentage overflow is rejected.
#[test]
#[should_panic(expected = "Total percentages cannot exceed 100")]
fn authz_percentage_overflow_is_token_tampering() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    // Attacker tries to set >100% to extract more tokens
    client.set_percentages(&admin, &80u32, &80u32);
}

// ── set_charity_contract ──────────────────────────────────────────────────────

/// Admin can set the charity contract address.
#[test]
fn authz_admin_can_set_charity() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    let charity = Address::generate(&env);
    // Should NOT panic
    client.set_charity_contract(&admin, &charity);
}

/// Non-admin setting charity address must panic.
#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn authz_non_admin_cannot_set_charity() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);
    let charity = Address::generate(&env);
    client.set_charity_contract(&recycler, &charity);
}

// ── deactivate_waste ──────────────────────────────────────────────────────────

/// Admin can deactivate a waste item.
#[test]
fn authz_admin_can_deactivate_waste() {
    let env = Env::default();
    let (client, admin, recycler, _, _) = setup(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0i128, &0i128);
    // Should NOT panic
    client.deactivate_waste(&waste_id, &admin);
}

/// Non-admin deactivating waste must panic.
#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn authz_non_admin_cannot_deactivate_waste() {
    let env = Env::default();
    let (client, _, recycler, collector, _) = setup(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0i128, &0i128);
    // collector is not admin
    client.deactivate_waste(&waste_id, &collector);
}

/// Deactivating an already-deactivated waste must panic.
#[test]
#[should_panic(expected = "Waste already deactivated")]
fn authz_double_deactivate_waste_rejected() {
    let env = Env::default();
    let (client, admin, recycler, _, _) = setup(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0i128, &0i128);
    client.deactivate_waste(&waste_id, &admin);
    // Second deactivation must panic
    client.deactivate_waste(&waste_id, &admin);
}

// ── deactivate_incentive ──────────────────────────────────────────────────────

/// Rewarder (manufacturer) can deactivate their own incentive.
#[test]
fn authz_rewarder_can_deactivate_incentive() {
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup(&env);
    let inc = client.create_incentive(&manufacturer, &WasteType::Plastic, &100u64, &1_000u64);
    // Should NOT panic
    client.deactivate_incentive(&inc.id, &manufacturer);
}

/// A different manufacturer cannot deactivate another's incentive.
#[test]
#[should_panic(expected = "Only incentive creator can deactivate")]
fn authz_non_rewarder_cannot_deactivate_incentive() {
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup(&env);
    let inc = client.create_incentive(&manufacturer, &WasteType::Plastic, &100u64, &1_000u64);

    // Register a second manufacturer
    let mfr2 = Address::generate(&env);
    let name = soroban_sdk::symbol_short!("test");
    client.register_participant(&mfr2, &ParticipantRole::Manufacturer, &name, &0i128, &0i128);
    // mfr2 did not create this incentive — must panic
    client.deactivate_incentive(&inc.id, &mfr2);
}

// ── Waste transfer ownership ──────────────────────────────────────────────────

/// Waste owner can transfer to another registered participant.
#[test]
fn authz_owner_can_transfer_waste() {
    let env = Env::default();
    let (client, _, recycler, collector, _) = setup(&env);
    let waste_id = client.recycle_waste(&WasteType::Metal, &1_000u128, &recycler, &0i128, &0i128);
    // Should NOT panic
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0i128, &0i128);
}

/// Non-owner attempting to transfer waste must panic.
#[test]
#[should_panic(expected = "Caller is not the owner")]
fn authz_non_owner_cannot_transfer_waste() {
    let env = Env::default();
    let (client, _, recycler, collector, _) = setup(&env);
    let waste_id = client.recycle_waste(&WasteType::Metal, &1_000u128, &recycler, &0i128, &0i128);
    // collector does not own this waste
    client.transfer_waste_v2(&waste_id, &collector, &recycler, &0i128, &0i128);
}

// ── Double initialize_admin ───────────────────────────────────────────────────

/// A second call to initialize_admin must panic — admin cannot be re-initialized.
#[test]
#[should_panic(expected = "Admin already initialized")]
fn authz_double_initialize_admin_rejected() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    // setup already called initialize_admin
    client.initialize_admin(&admin);
}

// ── set_token_address ─────────────────────────────────────────────────────────

/// Admin can set the reward token address.
#[test]
fn authz_admin_can_set_token_address() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    let token = Address::generate(&env);
    client.set_token_address(&admin, &token);
}

/// Non-admin setting the token address must panic.
#[test]
#[should_panic(expected = "Unauthorized: caller is not admin")]
fn authz_non_admin_cannot_set_token_address() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);
    let token = Address::generate(&env);
    client.set_token_address(&recycler, &token);
}
