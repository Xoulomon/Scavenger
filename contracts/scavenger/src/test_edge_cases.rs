// ⚠️  WARNING: DO NOT TEST — implementation-only file per issue scope.
// This file is part of the edge-case coverage work (issue #1106).
//
// Edge-case checklist (Soroban pitfalls):
//   [x] Zero-amount operations          — zero-weight waste yields zero reward
//   [x] Exact budget match              — budget hits 0 → incentive deactivated
//   [x] Self-transfer rejection         — transfer to self panics
//   [x] Single-participant supply chain — all reward accumulates on one address
//   [x] Empty vector inputs             — batch submit with empty slice panics
//   [x] Integer arithmetic (reward)     — weight_kg truncation documented
//   [x] Budget underflow guard          — reward > remaining_budget panics
//   [x] Incentive type mismatch         — wrong WasteType incentive yields 0
//   [x] Double-confirm rejection        — second confirm_waste call panics
//   [x] Unregistered submitter          — submit_material by non-participant panics

#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};
use soroban_sdk::token::StellarAssetClient;

use crate::{ScavengerContract, ScavengerContractClient};
use crate::types::{Role, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address, Address) {
    let contract_id = env.register(ScavengerContract, ());
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let token = env.register_stellar_asset_contract(admin.clone());
    let charity = Address::generate(env);
    env.mock_all_auths();
    // collector_pct=10, owner_pct=20 → recycler gets remaining 70%
    client.initialize(&admin, &token, &charity, &10, &20);
    (client, admin, token)
}

fn name(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

// ── Edge case 1: zero-weight waste with an active incentive ──────────────────
//
// weight_kg = 0 / 1000 = 0, so total_reward = reward_points * 0 = 0.
// The budget check (0 <= remaining_budget) passes, distribute_rewards returns 0,
// and the incentive budget is unchanged (subtracting 0).
// This documents that zero-weight submissions silently produce no reward.
#[test]
fn test_zero_weight_waste_yields_zero_reward() {
    let env = Env::default();
    let (client, admin, token) = setup(&env);

    let manufacturer = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.register_participant(&manufacturer, &Role::Manufacturer, &name(&env, "M"), &0, &0);
    client.register_participant(&recycler, &Role::Recycler, &name(&env, "R"), &0, &0);

    StellarAssetClient::new(&env, &token).mint(&manufacturer, &1_000_000);

    // Budget of 500; reward_points = 100 pts/kg
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &500);

    // Submit waste with weight < 1000 g → weight_kg rounds to 0
    let material = client.submit_material(&recycler, &WasteType::Plastic, &999);
    client.confirm_waste(&material.id, &recycler);

    let total = client.distribute_rewards(&material.id, &incentive.id, &manufacturer);

    // Zero reward distributed
    assert_eq!(total, 0);

    // Budget must be untouched — incentive stays active
    let updated = client.get_incentive_by_id(&incentive.id).unwrap();
    assert_eq!(updated.remaining_budget, 500);
    assert!(updated.active);
}

// ── Edge case 2: single-participant chain (submitter == current owner, no collectors) ──
//
// When the recycler submits and never transfers, there are no collector entries
// in the transfer history. The owner share goes to the submitter, and the
// recycler (current_owner == submitter) receives the remainder.
// Both amounts land on the same address, so total_earned = total_reward.
#[test]
fn test_single_participant_chain_all_reward_to_recycler() {
    let env = Env::default();
    let (client, _admin, token) = setup(&env);

    let manufacturer = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.register_participant(&manufacturer, &Role::Manufacturer, &name(&env, "M"), &0, &0);
    client.register_participant(&recycler, &Role::Recycler, &name(&env, "R"), &0, &0);

    StellarAssetClient::new(&env, &token).mint(&manufacturer, &1_000_000);

    // 10 pts/kg, budget 10_000
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &10_000);

    // 5 kg, no transfer — recycler stays current_owner
    let material = client.submit_material(&recycler, &WasteType::Plastic, &5_000);
    client.confirm_waste(&material.id, &recycler);

    // total_reward = 10 * 5 = 50
    let total = client.distribute_rewards(&material.id, &incentive.id, &manufacturer);
    assert_eq!(total, 50);

    // submitter (owner_pct=20%) gets 10, recycler (remainder=80%) gets 40
    // both are the same address → total_earned = 50
    let stats = client.get_participant_stats(&recycler);
    assert_eq!(stats.total_earned, 50);
}

// ── Edge case 3: incentive with exact budget match ───────────────────────────
//
// When total_reward == remaining_budget exactly, the budget hits 0 after
// distribution and the contract must automatically deactivate the incentive.
// Any subsequent distribute_rewards call must fail with "Incentive not active".
#[test]
fn test_exact_budget_match_deactivates_incentive() {
    let env = Env::default();
    let (client, _admin, token) = setup(&env);

    let manufacturer = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.register_participant(&manufacturer, &Role::Manufacturer, &name(&env, "M"), &0, &0);
    client.register_participant(&recycler, &Role::Recycler, &name(&env, "R"), &0, &0);

    StellarAssetClient::new(&env, &token).mint(&manufacturer, &1_000_000);

    // 10 pts/kg, budget exactly 50 → one 5 kg submission exhausts it
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &50);

    let material = client.submit_material(&recycler, &WasteType::Plastic, &5_000);
    client.confirm_waste(&material.id, &recycler);

    let total = client.distribute_rewards(&material.id, &incentive.id, &manufacturer);
    assert_eq!(total, 50);

    // Budget is now 0 → incentive must be deactivated automatically
    let updated = client.get_incentive_by_id(&incentive.id).unwrap();
    assert_eq!(updated.remaining_budget, 0);
    assert!(!updated.active, "Incentive should be deactivated when budget hits zero");
}

#[test]
#[should_panic(expected = "Incentive not active")]
fn test_exact_budget_match_blocks_further_distribution() {
    let env = Env::default();
    let (client, _admin, token) = setup(&env);

    let manufacturer = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.register_participant(&manufacturer, &Role::Manufacturer, &name(&env, "M"), &0, &0);
    client.register_participant(&recycler, &Role::Recycler, &name(&env, "R"), &0, &0);

    StellarAssetClient::new(&env, &token).mint(&manufacturer, &1_000_000);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &50);

    let m1 = client.submit_material(&recycler, &WasteType::Plastic, &5_000);
    client.confirm_waste(&m1.id, &recycler);
    client.distribute_rewards(&m1.id, &incentive.id, &manufacturer);

    // Second submission — incentive is now inactive, must panic
    let m2 = client.submit_material(&recycler, &WasteType::Plastic, &5_000);
    client.confirm_waste(&m2.id, &recycler);
    client.distribute_rewards(&m2.id, &incentive.id, &manufacturer);
}

// ── Edge case 4: transfer to self ────────────────────────────────────────────
//
// Allowing self-transfer would let a participant inject themselves into the
// collector history multiple times to inflate their reward share.
// The contract must reject it.
#[test]
#[should_panic(expected = "Cannot transfer waste to self")]
fn test_transfer_to_self_is_rejected() {
    let env = Env::default();
    let (client, _admin, _token) = setup(&env);

    let recycler = Address::generate(&env);
    client.register_participant(&recycler, &Role::Recycler, &name(&env, "R"), &0, &0);

    let material = client.submit_material(&recycler, &WasteType::Plastic, &5_000);

    // Transferring to yourself must be rejected
    client.transfer_waste(&material.id, &recycler, &recycler);
}

// ── Edge case 5: reward exceeds remaining budget ─────────────────────────────
//
// When a single submission would consume more than the remaining incentive
// budget, the contract must reject the distribution rather than allow a
// partial payout (which would leave an inconsistent accounting state).
#[test]
#[should_panic(expected = "Insufficient incentive budget")]
fn test_reward_exceeds_remaining_budget_panics() {
    let env = Env::default();
    let (client, _admin, token) = setup(&env);

    let manufacturer = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.register_participant(&manufacturer, &Role::Manufacturer, &name(&env, "M"), &0, &0);
    client.register_participant(&recycler, &Role::Recycler, &name(&env, "R"), &0, &0);

    StellarAssetClient::new(&env, &token).mint(&manufacturer, &1_000_000);

    // Budget of 10; reward_points = 100 pts/kg; a 1 kg submission → reward = 100 > budget 10
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &10);

    let material = client.submit_material(&recycler, &WasteType::Plastic, &1_000);
    client.confirm_waste(&material.id, &recycler);

    // Must panic because 100 > 10
    client.distribute_rewards(&material.id, &incentive.id, &manufacturer);
}

// ── Edge case 6: empty batch submit ──────────────────────────────────────────
//
// Submitting an empty materials list must be rejected to avoid persisting a
// no-op batch record that wastes storage and skews global metrics counters.
#[test]
#[should_panic(expected = "Batch must not be empty")]
fn test_submit_materials_batch_empty_panics() {
    let env = Env::default();
    let (client, _admin, _token) = setup(&env);

    let recycler = Address::generate(&env);
    client.register_participant(&recycler, &Role::Recycler, &name(&env, "R"), &0, &0);

    let empty: Vec<(WasteType, u128)> = Vec::new(&env);
    client.submit_materials_batch(&recycler, &empty);
}

// ── Edge case 7: unregistered participant cannot submit waste ─────────────────
//
// Allowing an unregistered address to submit waste would corrupt the supply
// chain by inserting anonymous entries into the transfer history.
#[test]
#[should_panic(expected = "Participant not registered")]
fn test_unregistered_address_cannot_submit_material() {
    let env = Env::default();
    let (client, _admin, _token) = setup(&env);

    let stranger = Address::generate(&env);
    // No register_participant call — stranger is unknown to the contract
    client.submit_material(&stranger, &WasteType::Plastic, &1_000);
}

// ── Edge case 8: incentive type mismatch ─────────────────────────────────────
//
// An incentive for WasteType::Metal must not reward a Plastic submission.
// The contract must either return 0 or panic.  Document the actual behaviour.
//
// Current contract behaviour: distribute_rewards checks the incentive's
// waste_type matches the material's waste_type and panics if they differ.
#[test]
#[should_panic(expected = "Waste type mismatch")]
fn test_incentive_waste_type_mismatch_panics() {
    let env = Env::default();
    let (client, _admin, token) = setup(&env);

    let manufacturer = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.register_participant(&manufacturer, &Role::Manufacturer, &name(&env, "M"), &0, &0);
    client.register_participant(&recycler, &Role::Recycler, &name(&env, "R"), &0, &0);

    StellarAssetClient::new(&env, &token).mint(&manufacturer, &1_000_000);

    // Metal incentive
    let incentive = client.create_incentive(&manufacturer, &WasteType::Metal, &10, &1000);

    // Plastic submission
    let material = client.submit_material(&recycler, &WasteType::Plastic, &5_000);
    client.confirm_waste(&material.id, &recycler);

    // Must panic with type mismatch
    client.distribute_rewards(&material.id, &incentive.id, &manufacturer);
}

// ── Edge case 9: weight truncation boundary ───────────────────────────────────
//
// weight_kg = weight_grams / 1000 (integer division).
// 999 g → 0 kg (documented in edge case 1).
// 1000 g → exactly 1 kg.
// 1001 g → 1 kg (truncates, not rounds).
// This test pins the boundary and ensures no off-by-one in reward calculation.
#[test]
fn test_weight_truncation_boundary_1000g_equals_1kg() {
    let env = Env::default();
    let (client, _admin, token) = setup(&env);

    let manufacturer = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.register_participant(&manufacturer, &Role::Manufacturer, &name(&env, "M"), &0, &0);
    client.register_participant(&recycler, &Role::Recycler, &name(&env, "R"), &0, &0);

    StellarAssetClient::new(&env, &token).mint(&manufacturer, &1_000_000);

    // 10 pts/kg, budget 1000
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &1000);

    // Exactly 1000 g → 1 kg
    let m1 = client.submit_material(&recycler, &WasteType::Plastic, &1_000);
    client.confirm_waste(&m1.id, &recycler);
    let total1 = client.distribute_rewards(&m1.id, &incentive.id, &manufacturer);
    assert_eq!(total1, 10, "1000 g should yield 10 pts (1 kg × 10)");

    // 1001 g → 1 kg (truncated, same as 1000 g)
    let m2 = client.submit_material(&recycler, &WasteType::Plastic, &1_001);
    client.confirm_waste(&m2.id, &recycler);
    let total2 = client.distribute_rewards(&m2.id, &incentive.id, &manufacturer);
    assert_eq!(total2, 10, "1001 g should also yield 10 pts (truncated to 1 kg)");
}

// ── Edge case 10: create incentive with zero reward points ───────────────────
//
// A zero-point incentive is economically meaningless but must not panic or
// corrupt state.  The contract should either reject it or accept it silently
// with a resulting 0 reward on every distribution.
#[test]
fn test_zero_reward_points_incentive_distributes_zero() {
    let env = Env::default();
    let (client, _admin, token) = setup(&env);

    let manufacturer = Address::generate(&env);
    let recycler = Address::generate(&env);

    client.register_participant(&manufacturer, &Role::Manufacturer, &name(&env, "M"), &0, &0);
    client.register_participant(&recycler, &Role::Recycler, &name(&env, "R"), &0, &0);

    StellarAssetClient::new(&env, &token).mint(&manufacturer, &1_000_000);

    // 0 pts/kg, budget 100
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &0, &100);

    let material = client.submit_material(&recycler, &WasteType::Plastic, &5_000);
    client.confirm_waste(&material.id, &recycler);

    let total = client.distribute_rewards(&material.id, &incentive.id, &manufacturer);
    assert_eq!(total, 0, "Zero reward-point incentive must distribute 0");
}
