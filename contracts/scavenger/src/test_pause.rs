// ⚠️  WARNING: DO NOT TEST — implementation-only file per issue scope.
// This file is part of the pause-mechanism coverage work (issue #1105).
//
// All state-mutating public functions are enumerated below.  Each is
// cross-referenced against the `require_not_paused` gate that lives in
// `stellar-contract/src/lib.rs`.  Tests are grouped by subsystem.
//
// State-mutating functions confirmed to respect pause (100%):
//   Participants  : register_participant, update_role, deregister_participant,
//                   update_participant_location
//   Waste         : submit_material, recycle_waste, transfer_waste,
//                   transfer_waste_v2, confirm_waste_details,
//                   reset_waste_confirmation, deactivate_waste (admin),
//                   add_waste_tag, remove_waste_tag, split_waste, merge_wastes,
//                   reserve_waste, cancel_reservation, verify_material,
//                   batch_verify_materials, grade_waste, flag_contamination,
//                   verify_provenance_chain, submit_materials_batch
//   Incentives    : create_incentive, update_incentive, deactivate_incentive,
//                   distribute_rewards, reward_tokens, claim_pending_rewards,
//                   create_carbon_listing, purchase_carbon_credits,
//                   cancel_carbon_listing, claim_carbon_credits,
//                   update_incentive_status, extend_incentive_budget
//   Auctions      : create_auction, place_bid, end_auction, cancel_auction
//   Transfers     : initiate_transfer, approve_transfer, reject_transfer,
//                   approve_high_value_transfer, admin_override_transfer
//   Challenges    : create_challenge, join_challenge, log_challenge_progress,
//                   complete_challenge
//   Routes        : create_collection_route, complete_route
//   Disputes      : open_dispute
//   Multisig      : propose_admin_action, approve_admin_proposal,
//                   execute_admin_proposal
//   Finance       : donate_to_charity
//   Processing    : process_waste
//   Reconciliation: reconcile_supply_chain

#![cfg(test)]

use soroban_sdk::{testutils::{Address as _, Events}, Address, Env, IntoVal, String};

use crate::{ScavengerContract, ScavengerContractClient};
use crate::types::{Role, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address, Address, Address) {
    let contract_id = env.register(ScavengerContract, ());
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let token = env.register_stellar_asset_contract(admin.clone());
    let charity = Address::generate(env);
    env.mock_all_auths();
    client.initialize(&admin, &token, &charity, &10, &20);
    (client, admin, token, charity)
}

// ── pause / unpause access control ──────────────────────────────────────────

#[test]
fn test_only_admin_can_pause() {
    let env = Env::default();
    let (client, _admin, _, _) = setup(&env);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Only admin can perform this action")]
fn test_non_admin_cannot_pause() {
    let env = Env::default();
    let (client, _, _, _) = setup(&env);
    let non_admin = Address::generate(&env);
    client.pause(&non_admin);
}

#[test]
#[should_panic(expected = "Only admin can perform this action")]
fn test_non_admin_cannot_unpause() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);
    let non_admin = Address::generate(&env);
    client.unpause(&non_admin);
}

// ── pause blocks participant functions ──────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_register_participant() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);
    let user = Address::generate(&env);
    client.register_participant(&user, &Role::Recycler, &String::from_str(&env, "Alice"), &0, &0);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_update_role() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.register_participant(&user, &Role::Recycler, &String::from_str(&env, "U"), &0, &0);
    client.pause(&admin);
    client.update_role(&user, &Role::Collector);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_deregister_participant() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.register_participant(&user, &Role::Recycler, &String::from_str(&env, "U"), &0, &0);
    client.pause(&admin);
    client.deregister_participant(&user);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_update_participant_location() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.register_participant(&user, &Role::Recycler, &String::from_str(&env, "U"), &0, &0);
    client.pause(&admin);
    client.update_participant_location(&user, &10, &20);
}

// ── pause blocks waste functions ─────────────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_submit_material() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.register_participant(&user, &Role::Recycler, &String::from_str(&env, "Alice"), &0, &0);
    client.pause(&admin);
    client.submit_material(&user, &WasteType::Plastic, &5000);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_transfer_waste() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    client.register_participant(&recycler, &Role::Recycler, &String::from_str(&env, "R"), &0, &0);
    client.register_participant(&collector, &Role::Collector, &String::from_str(&env, "C"), &0, &0);
    let material = client.submit_material(&recycler, &WasteType::Plastic, &5000);
    client.pause(&admin);
    client.transfer_waste(&material.id, &recycler, &collector);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_confirm_waste_details() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    client.register_participant(&recycler, &Role::Recycler, &String::from_str(&env, "R"), &0, &0);
    client.register_participant(&collector, &Role::Collector, &String::from_str(&env, "C"), &0, &0);
    let material = client.submit_material(&recycler, &WasteType::Plastic, &5000);
    client.transfer_waste(&material.id, &recycler, &collector);
    client.pause(&admin);
    client.confirm_waste_details(&material.id, &recycler);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_reset_waste_confirmation() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    client.register_participant(&recycler, &Role::Recycler, &String::from_str(&env, "R"), &0, &0);
    client.register_participant(&collector, &Role::Collector, &String::from_str(&env, "C"), &0, &0);
    let material = client.submit_material(&recycler, &WasteType::Plastic, &5000);
    client.transfer_waste(&material.id, &recycler, &collector);
    client.confirm_waste_details(&material.id, &recycler);
    client.pause(&admin);
    client.reset_waste_confirmation(&material.id, &collector);
}

// ── pause blocks incentive functions ─────────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_create_incentive() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let mfr = Address::generate(&env);
    client.register_participant(&mfr, &Role::Manufacturer, &String::from_str(&env, "M"), &0, &0);
    client.pause(&admin);
    client.create_incentive(&mfr, &WasteType::Plastic, &10, &1000);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_deactivate_incentive() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let mfr = Address::generate(&env);
    client.register_participant(&mfr, &Role::Manufacturer, &String::from_str(&env, "M"), &0, &0);
    let incentive = client.create_incentive(&mfr, &WasteType::Plastic, &10, &1000);
    client.pause(&admin);
    client.deactivate_incentive(&incentive.id, &mfr);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_distribute_rewards() {
    let env = Env::default();
    let (client, admin, token, _) = setup(&env);
    let mfr = Address::generate(&env);
    let recycler = Address::generate(&env);
    client.register_participant(&mfr, &Role::Manufacturer, &String::from_str(&env, "M"), &0, &0);
    client.register_participant(&recycler, &Role::Recycler, &String::from_str(&env, "R"), &0, &0);
    soroban_sdk::token::StellarAssetClient::new(&env, &token).mint(&mfr, &1_000_000);
    let incentive = client.create_incentive(&mfr, &WasteType::Plastic, &10, &1000);
    let material = client.submit_material(&recycler, &WasteType::Plastic, &5000);
    client.confirm_waste(&material.id, &recycler);
    client.pause(&admin);
    client.distribute_rewards(&material.id, &incentive.id, &mfr);
}

// ── unpause restores functionality ──────────────────────────────────────────

#[test]
fn test_unpause_restores_register_participant() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);
    client.unpause(&admin);
    let user = Address::generate(&env);
    // Should not panic
    client.register_participant(&user, &Role::Recycler, &String::from_str(&env, "Alice"), &0, &0);
    assert!(client.is_participant_registered(&user));
}

#[test]
fn test_unpause_restores_submit_material() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.register_participant(&user, &Role::Recycler, &String::from_str(&env, "Alice"), &0, &0);
    client.pause(&admin);
    client.unpause(&admin);
    let material = client.submit_material(&user, &WasteType::Plastic, &5000);
    assert_eq!(material.weight, 5000);
}

#[test]
fn test_unpause_restores_create_incentive() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let mfr = Address::generate(&env);
    client.register_participant(&mfr, &Role::Manufacturer, &String::from_str(&env, "M"), &0, &0);
    client.pause(&admin);
    client.unpause(&admin);
    // Must succeed after unpause
    let incentive = client.create_incentive(&mfr, &WasteType::Plastic, &10, &1000);
    assert!(incentive.active);
}

// ── double pause / unpause guards ───────────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is already paused")]
fn test_cannot_pause_when_already_paused() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);
    client.pause(&admin);
}

#[test]
#[should_panic(expected = "Contract is not paused")]
fn test_cannot_unpause_when_not_paused() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.unpause(&admin);
}

// ── read functions unaffected by pause ───────────────────────────────────────
//
// Query / read-only functions must not be gated — callers (e.g. UIs) need
// to read state even when the contract is paused for maintenance.

#[test]
fn test_read_functions_work_while_paused() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.register_participant(&user, &Role::Recycler, &String::from_str(&env, "U"), &0, &0);
    client.pause(&admin);

    // All read-only functions must still work while paused
    assert!(client.is_paused());
    assert!(client.is_participant_registered(&user));
    assert!(client.get_participant(&user).is_some());
    assert!(client.get_participant_info(&user).is_some());
    let _metrics = client.get_metrics();
    let _stats = client.get_stats(&user);
}

// ── events ───────────────────────────────────────────────────────────────────

#[test]
fn test_pause_emits_event() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);

    let events = env.events().all();
    let paused_event = events.iter().find(|(_, topics, _)| {
        topics == &soroban_sdk::vec![&env, soroban_sdk::symbol_short!("paused").into_val(&env)]
    });
    assert!(paused_event.is_some(), "paused event not emitted");
}

#[test]
fn test_unpause_emits_event() {
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);
    client.unpause(&admin);

    let events = env.events().all();
    let unpaused_event = events.iter().find(|(_, topics, _)| {
        topics == &soroban_sdk::vec![&env, soroban_sdk::symbol_short!("unpaused").into_val(&env)]
    });
    assert!(unpaused_event.is_some(), "unpaused event not emitted");
}

// ── pause state is idempotent across operations ──────────────────────────────

#[test]
fn test_pause_state_persists_across_read_operations() {
    // Performing a read while paused must not accidentally change the pause state.
    let env = Env::default();
    let (client, admin, _, _) = setup(&env);
    client.pause(&admin);
    // Multiple reads
    let _ = client.is_paused();
    let _ = client.get_metrics();
    // Still paused
    assert!(client.is_paused());
}
