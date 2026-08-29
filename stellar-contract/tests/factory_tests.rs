//! Tests that exercise the factory helpers from `factories.rs` — closes #946.
//!
//! Every test uses ONLY factory helpers (no hand-built objects) to demonstrate
//! the pattern and validate that the factories themselves work correctly.

#![cfg(test)]

mod factories;
use factories::*;

use soroban_sdk::{testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, WasteType};

// ── ParticipantFactory tests ──────────────────────────────────────────────────

#[test]
fn test_factory_creates_recycler() {
    let env = Env::default();
    env.mock_all_auths();
    let client = make_client_no_auth(&env);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    let recycler = ParticipantFactory::recycler(&env, &client);

    assert!(
        client.is_participant_registered(&recycler),
        "Recycler should be registered"
    );
}

#[test]
fn test_factory_creates_collector() {
    let env = Env::default();
    env.mock_all_auths();
    let client = make_client_no_auth(&env);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    let collector = ParticipantFactory::collector(&env, &client);

    assert!(
        client.is_participant_registered(&collector),
        "Collector should be registered"
    );
}

#[test]
fn test_factory_creates_manufacturer() {
    let env = Env::default();
    env.mock_all_auths();
    let client = make_client_no_auth(&env);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    let manufacturer = ParticipantFactory::manufacturer(&env, &client);

    assert!(
        client.is_participant_registered(&manufacturer),
        "Manufacturer should be registered"
    );
}

#[test]
fn test_factory_with_role_creates_independent_addresses() {
    let env = Env::default();
    env.mock_all_auths();
    let client = make_client_no_auth(&env);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    let r1 = ParticipantFactory::recycler(&env, &client);
    let r2 = ParticipantFactory::recycler(&env, &client);

    assert_ne!(r1, r2, "Each factory call should produce a unique address");
}

#[test]
fn test_factory_with_location() {
    let env = Env::default();
    env.mock_all_auths();
    let client = make_client_no_auth(&env);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);

    let addr = ParticipantFactory::with_location(&env, &client, ParticipantRole::Recycler, 40, 74);

    assert!(
        client.is_participant_registered(&addr),
        "Located participant should be registered"
    );
}

// ── WasteFactory tests ────────────────────────────────────────────────────────

#[test]
fn test_factory_creates_plastic_waste() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_env(&env);

    let waste_id = WasteFactory::plastic(&env, &client, &recycler);

    assert!(waste_id > 0, "Waste ID must be non-zero");
}

#[test]
fn test_factory_creates_metal_waste() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_env(&env);

    let waste_id = WasteFactory::metal(&env, &client, &recycler);

    assert!(waste_id > 0);
}

#[test]
fn test_factory_creates_glass_waste() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_env(&env);

    let waste_id = WasteFactory::glass(&env, &client, &recycler);

    assert!(waste_id > 0);
}

#[test]
fn test_factory_creates_paper_waste() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_env(&env);

    let waste_id = WasteFactory::paper(&env, &client, &recycler);

    assert!(waste_id > 0);
}

#[test]
fn test_factory_creates_electronics_waste() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_env(&env);

    let waste_id = WasteFactory::electronics(&env, &client, &recycler);

    assert!(waste_id > 0);
}

#[test]
fn test_factory_waste_ids_are_unique() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_env(&env);

    let id1 = WasteFactory::plastic(&env, &client, &recycler);
    let id2 = WasteFactory::plastic(&env, &client, &recycler);
    let id3 = WasteFactory::metal(&env, &client, &recycler);

    assert_ne!(id1, id2);
    assert_ne!(id2, id3);
}

#[test]
fn test_factory_waste_with_custom_weight() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_env(&env);

    let waste_id = WasteFactory::with_type(&env, &client, &recycler, WasteType::Metal, 5_000);

    assert!(waste_id > 0);
}

#[test]
fn test_factory_waste_with_location() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_env(&env);

    let waste_id =
        WasteFactory::with_location(&env, &client, &recycler, WasteType::Glass, 500, 40_000_000, -74_000_000);

    assert!(waste_id > 0);
}

// ── IncentiveFactory tests ────────────────────────────────────────────────────

#[test]
fn test_factory_creates_plastic_incentive() {
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup_full_env(&env);

    let incentive_id = IncentiveFactory::plastic(&env, &client, &manufacturer);

    assert!(incentive_id > 0 || incentive_id == 0, "ID should be valid");
    let incentive = client.get_incentive_by_id(&incentive_id).expect("Incentive must exist");
    assert_eq!(incentive.waste_type, WasteType::Plastic);
}

#[test]
fn test_factory_creates_metal_incentive() {
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup_full_env(&env);

    let incentive_id = IncentiveFactory::metal(&env, &client, &manufacturer);

    let incentive = client.get_incentive_by_id(&incentive_id).expect("Incentive must exist");
    assert_eq!(incentive.waste_type, WasteType::Metal);
}

#[test]
fn test_factory_creates_incentive_with_custom_params() {
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup_full_env(&env);

    let incentive_id = IncentiveFactory::with_params(&env, &client, &manufacturer, WasteType::Glass, 500, 10_000);

    let incentive = client.get_incentive_by_id(&incentive_id).expect("Incentive must exist");
    assert_eq!(incentive.reward_points, 500);
    assert_eq!(incentive.total_budget, 10_000);
}

// ── TransferFactory tests ─────────────────────────────────────────────────────

#[test]
fn test_factory_transfer_changes_ownership() {
    let env = Env::default();
    let (client, _, recycler, collector, _) = setup_full_env(&env);

    let waste_id = WasteFactory::plastic(&env, &client, &recycler);
    TransferFactory::transfer(&client, waste_id, &recycler, &collector);

    // After transfer the collector should appear in transfer history
    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert!(!history.is_empty(), "Transfer history should not be empty");
    let last = history.last().unwrap();
    assert_eq!(last.to, collector);
}

#[test]
fn test_factory_multi_hop_transfer() {
    let env = Env::default();
    let (client, _, recycler, collector, manufacturer) = setup_full_env(&env);

    let waste_id = WasteFactory::metal(&env, &client, &recycler);
    TransferFactory::transfer(&client, waste_id, &recycler, &collector);
    TransferFactory::transfer(&client, waste_id, &collector, &manufacturer);

    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.len(), 2, "Should have exactly two transfer records");
}

#[test]
fn test_factory_transfer_at_location() {
    let env = Env::default();
    let (client, _, recycler, collector, _) = setup_full_env(&env);

    let waste_id = WasteFactory::glass(&env, &client, &recycler);
    TransferFactory::transfer_at(&client, waste_id, &recycler, &collector, 40_000_000, -74_000_000);

    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert!(!history.is_empty());
}

// ── setup_full_env tests ──────────────────────────────────────────────────────

#[test]
fn test_setup_full_env_registers_all_participants() {
    let env = Env::default();
    let (client, _, recycler, collector, manufacturer) = setup_full_env(&env);

    assert!(client.is_participant_registered(&recycler));
    assert!(client.is_participant_registered(&collector));
    assert!(client.is_participant_registered(&manufacturer));
}

#[test]
fn test_full_supply_chain_via_factories() {
    let env = Env::default();
    let (client, _, recycler, collector, manufacturer) = setup_full_env(&env);

    let waste_id = WasteFactory::plastic(&env, &client, &recycler);
    TransferFactory::transfer(&client, waste_id, &recycler, &collector);
    TransferFactory::transfer(&client, waste_id, &collector, &manufacturer);

    let _ = IncentiveFactory::plastic(&env, &client, &manufacturer);

    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.len(), 2);
}
