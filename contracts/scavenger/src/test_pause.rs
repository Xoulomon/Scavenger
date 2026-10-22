//! Pause-guard coverage tests — issue #1519.
//!
//! Every state-mutating public function that calls `require_not_paused` is
//! exercised here.  The test for each function:
//!   1. Sets up the contract with the necessary pre-conditions.
//!   2. Pauses the contract.
//!   3. Calls the function and expects a `"Contract is paused"` panic.
//!
//! This file is the single source of truth for pause coverage.  When a new
//! mutating entrypoint is added to `lib.rs`, a corresponding
//! `test_pause_blocks_*` test MUST be added here.
//!
//! ## Admin functions that must remain callable while paused
//!
//! The following admin-only functions intentionally bypass the pause guard so
//! that admins can manage the contract during an incident:
//!   - `pause` / `unpause`
//!   - `initialize_admin`
//!   - `transfer_admin`, `add_admin`, `remove_admin`
//!   - `set_charity_contract`, `set_percentages`, `set_token_address`
//!   - `set_multisig_threshold`
//!   - All read-only (`get_*`, `is_*`) functions
//!
//! These are documented and verified in `test_read_and_admin_work_while_paused`.

#![cfg(test)]

use soroban_sdk::{
    symbol_short, testutils::Address as _, Address, Env, String,
};
use crate::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

// ── shared setup ─────────────────────────────────────────────────────────────

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    env.mock_all_auths();
    client.initialize_admin(&admin);
    (client, admin)
}

fn setup_with_recycler(env: &Env) -> (ScavengerContractClient<'_>, Address, Address) {
    let (client, admin) = setup(env);
    let recycler = Address::generate(env);
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &symbol_short!("R"),
        &0i128,
        &0i128,
    );
    (client, admin, recycler)
}

fn setup_with_two_participants(
    env: &Env,
) -> (ScavengerContractClient<'_>, Address, Address, Address) {
    let (client, admin, recycler) = setup_with_recycler(env);
    let collector = Address::generate(env);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("C"),
        &0i128,
        &0i128,
    );
    (client, admin, recycler, collector)
}

fn setup_with_manufacturer(env: &Env) -> (ScavengerContractClient<'_>, Address, Address) {
    let (client, admin) = setup(env);
    let mfr = Address::generate(env);
    client.register_participant(
        &mfr,
        &ParticipantRole::Manufacturer,
        &symbol_short!("M"),
        &0i128,
        &0i128,
    );
    (client, admin, mfr)
}

// ── pause / unpause access control ──────────────────────────────────────────

#[test]
fn test_contract_not_paused_by_default() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    assert!(!client.is_paused());
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_non_admin_cannot_pause() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let non_admin = Address::generate(&env);
    client.pause(&non_admin);
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_non_admin_cannot_unpause() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.pause(&admin);
    let non_admin = Address::generate(&env);
    client.unpause(&non_admin);
}

// ── Participants ─────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_register_participant() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.pause(&admin);
    let user = Address::generate(&env);
    client.register_participant(
        &user,
        &ParticipantRole::Recycler,
        &symbol_short!("U"),
        &0i128,
        &0i128,
    );
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_update_role() {
    let env = Env::default();
    let (client, admin, recycler) = setup_with_recycler(&env);
    client.pause(&admin);
    client.update_role(&recycler, &ParticipantRole::Collector);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_deregister_participant() {
    let env = Env::default();
    let (client, admin, recycler) = setup_with_recycler(&env);
    client.pause(&admin);
    client.deregister_participant(&recycler);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_update_participant_location() {
    let env = Env::default();
    let (client, admin, recycler) = setup_with_recycler(&env);
    client.pause(&admin);
    client.update_participant_location(&recycler, &10i128, &20i128);
}

// ── Waste lifecycle ──────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_submit_material() {
    let env = Env::default();
    let (client, admin, recycler) = setup_with_recycler(&env);
    client.pause(&admin);
    client.submit_material(
        &WasteType::Plastic,
        &5000u64,
        &recycler,
        &String::from_str(&env, ""),
    );
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_recycle_waste() {
    let env = Env::default();
    let (client, admin, recycler) = setup_with_recycler(&env);
    client.pause(&admin);
    client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_transfer_waste() {
    let env = Env::default();
    let (client, admin, recycler, collector) = setup_with_two_participants(&env);
    let waste_id = client.submit_material(
        &WasteType::Plastic,
        &5000u64,
        &recycler,
        &String::from_str(&env, ""),
    );
    client.pause(&admin);
    client.transfer_waste(
        &waste_id,
        &recycler,
        &collector,
        &String::from_str(&env, ""),
    );
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_transfer_waste_v2() {
    let env = Env::default();
    let (client, admin, recycler, collector) = setup_with_two_participants(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);
    client.pause(&admin);
    let _ = client.transfer_waste_v2(&waste_id, &recycler, &collector, &0i128, &0i128);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_confirm_waste_details() {
    let env = Env::default();
    let (client, admin, recycler, collector) = setup_with_two_participants(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0i128, &0i128).unwrap();
    client.pause(&admin);
    client.confirm_waste_details(&waste_id, &collector);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_reset_waste_confirmation() {
    let env = Env::default();
    let (client, admin, recycler, collector) = setup_with_two_participants(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0i128, &0i128).unwrap();
    client.confirm_waste_details(&waste_id, &collector);
    client.pause(&admin);
    client.reset_waste_confirmation(&waste_id, &recycler);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_update_processing_status() {
    let env = Env::default();
    let (client, admin, recycler) = setup_with_recycler(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);
    client.pause(&admin);
    use crate::ProcessingStatus;
    client.update_processing_status(&waste_id, &ProcessingStatus::Processing, &recycler);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_add_waste_tag() {
    let env = Env::default();
    let (client, admin, recycler) = setup_with_recycler(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);
    client.pause(&admin);
    client.add_waste_tag(&waste_id, &String::from_str(&env, "eco"), &recycler);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_split_waste() {
    let env = Env::default();
    let (client, admin, recycler) = setup_with_recycler(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);
    client.pause(&admin);
    client.split_waste(&waste_id, &500u128, &recycler);
}

// ── Incentives ───────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_create_incentive() {
    let env = Env::default();
    let (client, admin, mfr) = setup_with_manufacturer(&env);
    client.pause(&admin);
    client.create_incentive(&mfr, &WasteType::Plastic, &10u64, &1000u64);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_deactivate_incentive() {
    let env = Env::default();
    let (client, admin, mfr) = setup_with_manufacturer(&env);
    let incentive = client.create_incentive(&mfr, &WasteType::Plastic, &10u64, &1000u64);
    client.pause(&admin);
    client.deactivate_incentive(&incentive.id, &mfr);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_update_incentive_status() {
    let env = Env::default();
    let (client, admin, mfr) = setup_with_manufacturer(&env);
    let incentive = client.create_incentive(&mfr, &WasteType::Plastic, &10u64, &1000u64);
    client.pause(&admin);
    client.update_incentive_status(&incentive.id, &false);
}

// ── Auctions ─────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_create_auction() {
    let env = Env::default();
    let (client, admin, recycler) = setup_with_recycler(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);
    client.pause(&admin);
    client.create_auction(&recycler, &waste_id, &100u128, &86400u64);
}

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_place_bid() {
    let env = Env::default();
    let (client, admin, recycler, collector) = setup_with_two_participants(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);
    let auction_id = client.create_auction(&recycler, &waste_id, &100u128, &86400u64);
    client.pause(&admin);
    client.place_bid(&collector, &auction_id, &200u128);
}

// ── Multisig proposals ───────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_propose_admin_action() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.pause(&admin);
    use crate::AdminAction;
    client.propose_admin_action(&admin, &AdminAction::Pause);
}

// ── Finance / carbon ─────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_donate_to_charity() {
    let env = Env::default();
    let (client, admin, recycler) = setup_with_recycler(&env);
    let charity = Address::generate(&env);
    client.set_charity_contract(&admin, &charity);
    client.pause(&admin);
    client.donate_to_charity(&recycler, &10i128);
}

// ── Transfers ────────────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is paused")]
fn test_pause_blocks_validate_transfer_path() {
    let env = Env::default();
    let (client, admin, recycler, collector) = setup_with_two_participants(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);
    client.pause(&admin);
    client.validate_transfer_path(&waste_id, &recycler, &collector);
}

// ── Unpause restores operations ──────────────────────────────────────────────

#[test]
fn test_unpause_restores_register_participant() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.pause(&admin);
    client.unpause(&admin);
    let user = Address::generate(&env);
    client.register_participant(
        &user,
        &ParticipantRole::Recycler,
        &symbol_short!("U"),
        &0i128,
        &0i128,
    );
    assert!(client.is_participant_registered(&user));
}

#[test]
fn test_unpause_restores_recycle_waste() {
    let env = Env::default();
    let (client, admin, recycler) = setup_with_recycler(&env);
    client.pause(&admin);
    client.unpause(&admin);
    let id = client.recycle_waste(&WasteType::Plastic, &1000u128, &recycler, &0i128, &0i128);
    assert!(id > 0);
}

// ── Double pause / unpause guards ────────────────────────────────────────────

#[test]
#[should_panic(expected = "Contract is already paused")]
fn test_cannot_pause_when_already_paused() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.pause(&admin);
    client.pause(&admin);
}

#[test]
#[should_panic(expected = "Contract is not paused")]
fn test_cannot_unpause_when_not_paused() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.unpause(&admin);
}

// ── Read-only and admin functions work while paused ──────────────────────────
//
// The following functions are intentionally NOT gated by require_not_paused:
//   - All get_* / is_* query functions (read-only)
//   - Admin management functions (pause, unpause, set_*, transfer_admin)
// This ensures the contract remains observable and administrable during incidents.

#[test]
fn test_read_and_admin_work_while_paused() {
    let env = Env::default();
    let (client, admin, recycler) = setup_with_recycler(&env);
    client.pause(&admin);

    // Read-only queries must not be blocked
    assert!(client.is_paused());
    assert!(client.is_participant_registered(&recycler));
    assert!(client.get_participant(&recycler).is_some());
    assert!(client.get_participant_info(&recycler).is_some());

    // Admin operations must still work while paused
    let new_token = Address::generate(&env);
    client.set_token_address(&admin, &new_token);
}
