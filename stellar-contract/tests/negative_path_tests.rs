//! Negative-path / error-condition test suite — closes #948.
//!
//! The contract previously had strong happy-path coverage but limited coverage
//! for error conditions. This file enumerates every documented error and adds
//! an assertion for each one.
//!
//! Each test is fully isolated (own `Env::default()`) and uses
//! `#[should_panic(expected = "...")]` to assert the exact panic message so
//! regressions in error text are also caught.

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};
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

// ── Participant error conditions ──────────────────────────────────────────────

/// Registering the same address twice must panic with "Participant already registered".
#[test]
#[should_panic(expected = "Participant already registered")]
fn neg_duplicate_participant_registration() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);
    let name = soroban_sdk::symbol_short!("test");
    // recycler was registered in setup — second call must panic
    client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &0i128, &0i128);
}

/// Getting a participant that was never registered returns None.
#[test]
fn neg_get_nonexistent_participant_returns_none() {
    let env = Env::default();
    let (client, _, _, _, _) = setup(&env);
    let stranger = Address::generate(&env);

    let result = client.get_participant(&stranger);
    assert!(result.is_none(), "Non-existent participant must return None");
}

/// is_participant_registered returns false for an unknown address.
#[test]
fn neg_is_registered_returns_false_for_unknown() {
    let env = Env::default();
    let (client, _, _, _, _) = setup(&env);
    let stranger = Address::generate(&env);

    assert!(!client.is_participant_registered(&stranger));
}

// ── Admin error conditions ────────────────────────────────────────────────────

/// Calling initialize_admin a second time must panic with "Admin already initialized".
#[test]
#[should_panic(expected = "Admin already initialized")]
fn neg_double_initialize_admin() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    // setup already called initialize_admin once
    client.initialize_admin(&admin);
}

/// Percentages that sum > 100 must panic.
#[test]
#[should_panic(expected = "Total percentages cannot exceed 100")]
fn neg_percentages_sum_exceeds_100() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    // 60 + 60 = 120 > 100
    client.set_percentages(&admin, &60u32, &60u32);
}

/// Percentages summing to exactly 100 are valid.
#[test]
fn neg_percentages_exactly_100_is_accepted() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    // Should NOT panic
    client.set_percentages(&admin, &50u32, &50u32);
}

/// Percentages of 0 + 0 are valid (no rewards split).
#[test]
fn neg_zero_percentages_are_accepted() {
    let env = Env::default();
    let (client, admin, _, _, _) = setup(&env);
    client.set_percentages(&admin, &0u32, &0u32);
}

// ── Waste error conditions ────────────────────────────────────────────────────

/// Submitting waste with zero weight must panic.
#[test]
#[should_panic(expected = "must be greater than zero")]
fn neg_zero_weight_waste_rejected() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);
    client.recycle_waste(&WasteType::Plastic, &0u128, &recycler, &0i128, &0i128);
}

/// Getting a waste ID that was never created returns None.
#[test]
fn neg_get_nonexistent_waste_returns_none() {
    let env = Env::default();
    let (client, _, _, _, _) = setup(&env);

    let result = client.get_waste_v2(&99_999u128);
    assert!(result.is_none(), "Non-existent waste must return None");
}

/// An unregistered address cannot submit waste.
#[test]
#[should_panic(expected = "Caller is not a registered participant")]
fn neg_unregistered_address_cannot_submit_waste() {
    let env = Env::default();
    let (client, _, _, _, _) = setup(&env);
    let stranger = Address::generate(&env);
    client.recycle_waste(&WasteType::Plastic, &1_000u128, &stranger, &0i128, &0i128);
}

/// A Collector (non-recycler) cannot submit waste via recycle_waste.
#[test]
#[should_panic]
fn neg_collector_cannot_submit_waste() {
    let env = Env::default();
    let (client, _, _, collector, _) = setup(&env);
    // recycle_waste is only for recyclers
    client.recycle_waste(&WasteType::Plastic, &1_000u128, &collector, &0i128, &0i128);
}

// ── Transfer error conditions ─────────────────────────────────────────────────

/// Self-transfer (from == to) must panic.
#[test]
#[should_panic(expected = "Self-transfer is not allowed")]
fn neg_self_transfer_rejected() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0i128, &0i128);
    client.transfer_waste_v2(&waste_id, &recycler, &recycler, &0i128, &0i128);
}

/// Transferring a waste item the caller does not own must panic.
#[test]
#[should_panic(expected = "Caller is not the owner")]
fn neg_non_owner_transfer_rejected() {
    let env = Env::default();
    let (client, _, recycler, collector, _) = setup(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000u128, &recycler, &0i128, &0i128);
    // collector is not the owner of this waste
    client.transfer_waste_v2(&waste_id, &collector, &recycler, &0i128, &0i128);
}

/// Transferring a non-existent waste must panic.
#[test]
#[should_panic]
fn neg_transfer_nonexistent_waste_panics() {
    let env = Env::default();
    let (client, _, recycler, collector, _) = setup(&env);
    client.transfer_waste_v2(&88_888u128, &recycler, &collector, &0i128, &0i128);
}

// ── Incentive error conditions ────────────────────────────────────────────────

/// Only manufacturers can create incentives — a recycler attempt must panic.
#[test]
#[should_panic(expected = "Caller is not a manufacturer")]
fn neg_recycler_cannot_create_incentive() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup(&env);
    client.create_incentive(&recycler, &WasteType::Plastic, &100u64, &1_000u64);
}

/// Only manufacturers can create incentives — a collector attempt must panic.
#[test]
#[should_panic(expected = "Caller is not a manufacturer")]
fn neg_collector_cannot_create_incentive() {
    let env = Env::default();
    let (client, _, _, collector, _) = setup(&env);
    client.create_incentive(&collector, &WasteType::Plastic, &100u64, &1_000u64);
}

/// Getting an incentive by a non-existent ID returns None.
#[test]
fn neg_get_nonexistent_incentive_returns_none() {
    let env = Env::default();
    let (client, _, _, _, _) = setup(&env);
    let result = client.get_incentive_by_id(&99_999u64);
    assert!(result.is_none(), "Non-existent incentive must return None");
}

/// Updating a non-existent incentive must panic.
#[test]
#[should_panic(expected = "Incentive not found")]
fn neg_update_nonexistent_incentive_panics() {
    let env = Env::default();
    let (client, _, _, _, _) = setup(&env);
    client.update_incentive(&99_999u64, &200u64, &2_000u64);
}

/// Deactivating a non-existent incentive must panic.
#[test]
#[should_panic(expected = "Incentive not found")]
fn neg_deactivate_nonexistent_incentive_panics() {
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup(&env);
    client.deactivate_incentive(&99_999u64, &manufacturer);
}

/// Creating an incentive with zero reward_points is accepted (no validation).
/// This documents the current contract behaviour as a regression guard.
#[test]
fn neg_zero_reward_incentive_is_accepted() {
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup(&env);
    // create_incentive does not currently validate reward > 0
    let inc = client.create_incentive(&manufacturer, &WasteType::Plastic, &0u64, &1_000u64);
    assert_eq!(inc.reward_points, 0);
}

/// Creating an incentive with zero budget is accepted (no validation).
/// This documents the current contract behaviour as a regression guard.
#[test]
fn neg_zero_budget_incentive_is_accepted() {
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup(&env);
    let inc = client.create_incentive(&manufacturer, &WasteType::Plastic, &100u64, &0u64);
    assert_eq!(inc.total_budget, 0);
}
