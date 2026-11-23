#![cfg(test)]

//! Comprehensive Soroban Environment Integration Tests (#1753)
//!
//! Full integration tests using the Soroban test environment (soroban_sdk::Env)
//! with testutils. Tests complex multi-step workflows, state consistency,
//! event emissions, and cross-function interactions.
//!
//! These tests use the real contract logic (not mocks) and verify that all
//! components work together correctly in a realistic environment.

mod common;

use common::setup::*;
use soroban_sdk::{
    testutils::{Address as _, Events as _},
    Address, Env, String, Vec,
};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContractClient, WasteType};

// ══════════════════════════════════════════════════════════════════════════════
//  Complete Lifecycle Integration Tests
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_full_waste_lifecycle_with_confirmation() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);

    let collector = register_participant_with_role(&env, &client, ParticipantRole::Collector, "col");
    let processor = register_participant_with_role(&env, &client, ParticipantRole::Manufacturer, "proc");
    let auditor = register_participant_with_role(&env, &client, ParticipantRole::Auditor, "aud");

    // Step 1: Recycler registers waste
    let waste_id = client.recycle_waste(&WasteType::Plastic, &5000, &recycler, &40_712_800, &-74_006_000);
    assert!(waste_id > 0, "Waste registration should succeed");

    // Step 2: Transfer to collector
    let transfer1 = client.transfer_waste_v2(&waste_id, &recycler, &collector, &40_712_900, &-74_006_100);
    assert_eq!(transfer1.from, recycler);
    assert_eq!(transfer1.to, collector);

    // Step 3: Auditor confirms waste details
    let confirmed = client.confirm_waste_details(&waste_id, &auditor);
    assert!(confirmed.is_confirmed, "Auditor should confirm waste");

    // Step 4: Transfer to processor
    let transfer2 = client.transfer_waste_v2(&waste_id, &collector, &processor, &40_713_000, &-74_006_200);
    assert_eq!(transfer2.from, collector);
    assert_eq!(transfer2.to, processor);

    // Verify complete history
    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.len(), 2, "Should have two transfers in history");

    // Verify waste data consistency
    let waste = client.get_waste(&waste_id).unwrap();
    assert_eq!(waste.waste_type, WasteType::Plastic);
    assert_eq!(waste.weight, 5000);
    assert_eq!(waste.current_owner, processor);
    assert!(waste.is_confirmed);
}

#[test]
fn test_multi_waste_parallel_processing() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);
    let collector = register_participant_with_role(&env, &client, ParticipantRole::Collector, "col");
    let processor = register_participant_with_role(&env, &client, ParticipantRole::Manufacturer, "proc");

    // Register multiple waste types simultaneously
    let plastic_id = client.recycle_waste(&WasteType::Plastic, &3000, &recycler, &0, &0);
    let metal_id = client.recycle_waste(&WasteType::Metal, &4500, &recycler, &0, &0);
    let glass_id = client.recycle_waste(&WasteType::Glass, &2000, &recycler, &0, &0);
    let paper_id = client.recycle_waste(&WasteType::Paper, &1500, &recycler, &0, &0);

    // Process all through supply chain
    let waste_ids = vec![&env, plastic_id, metal_id, glass_id, paper_id];

    for &waste_id in waste_ids.iter() {
        client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
        client.transfer_waste_v2(&waste_id, &collector, &processor, &0, &0);
    }

    // Verify all completed successfully
    for &waste_id in waste_ids.iter() {
        let history = client.get_waste_transfer_history_v2(&waste_id);
        assert_eq!(history.len(), 2, "Each waste should have two transfers");

        let waste = client.get_waste(&waste_id).unwrap();
        assert_eq!(waste.current_owner, processor);
    }

    // Verify global stats reflect all operations
    let (total_wastes, total_weight, _) = client.get_supply_chain_stats();
    assert_eq!(total_wastes, 4);
    assert_eq!(total_weight, 11000); // 3000 + 4500 + 2000 + 1500
}

#[test]
fn test_incentive_driven_workflow() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);
    let collector = register_participant_with_role(&env, &client, ParticipantRole::Collector, "col");
    let manufacturer = register_participant_with_role(&env, &client, ParticipantRole::Manufacturer, "mfg");

    // Manufacturer creates incentive for plastic waste
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &150, &100_000);
    assert!(incentive.active);
    assert_eq!(incentive.reward_points, 150);

    // Recycler responds by collecting plastic waste
    let waste_id = client.recycle_waste(&WasteType::Plastic, &8000, &recycler, &0, &0);

    // Waste flows through supply chain to incentivizing manufacturer
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &0, &0);

    // Verify waste reached the manufacturer
    let waste = client.get_waste(&waste_id).unwrap();
    assert_eq!(waste.current_owner, manufacturer);

    // Verify incentive still active
    let retrieved_incentive = client.get_incentive_by_id(&incentive.id).unwrap();
    assert!(retrieved_incentive.active);

    // Check if manufacturer has active incentive
    let active_incentive = client.get_active_mfr_incentive(&manufacturer, &WasteType::Plastic);
    assert!(active_incentive.is_some());
}

// ══════════════════════════════════════════════════════════════════════════════
//  Event Emission Integration Tests
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_waste_registration_emits_events() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);

    // Register waste and check events
    let waste_id = client.recycle_waste(&WasteType::Metal, &6000, &recycler, &1_000_000, &2_000_000);

    let events = env.events().all();
    let event_count = events.len();

    assert!(event_count > 0, "Should emit at least one event");

    // Waste registration should succeed
    assert!(waste_id > 0);
}

#[test]
fn test_transfer_emits_sequential_events() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);
    let collector = register_participant_with_role(&env, &client, ParticipantRole::Collector, "col");
    let processor = register_participant_with_role(&env, &client, ParticipantRole::Manufacturer, "proc");

    let waste_id = client.recycle_waste(&WasteType::Glass, &3500, &recycler, &0, &0);

    // Record events before transfers
    let events_before = env.events().all().len();

    // Perform transfers
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    client.transfer_waste_v2(&waste_id, &collector, &processor, &0, &0);

    // Check that new events were emitted
    let events_after = env.events().all().len();
    assert!(events_after > events_before, "Transfers should emit events");

    // Verify transfer history matches event sequence
    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.len(), 2);
    assert_eq!(history.get(0).unwrap().from, recycler);
    assert_eq!(history.get(1).unwrap().to, processor);
}

#[test]
fn test_confirmation_emits_event() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);
    let auditor = register_participant_with_role(&env, &client, ParticipantRole::Auditor, "aud");

    let waste_id = client.recycle_waste(&WasteType::Paper, &2500, &recycler, &0, &0);

    let events_before = env.events().all().len();

    // Confirm waste
    let confirmed = client.confirm_waste_details(&waste_id, &auditor);
    assert!(confirmed.is_confirmed);

    // Check event was emitted
    let events_after = env.events().all().len();
    assert!(events_after > events_before, "Confirmation should emit event");
}

// ══════════════════════════════════════════════════════════════════════════════
//  Multi-Participant Workflow Tests
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_multiple_recyclers_competing() {
    let env = Env::default();
    let (client, _) = setup_admin(&env);

    // Register multiple recyclers
    let recycler1 = register_participant_with_role(&env, &client, ParticipantRole::Recycler, "rec1");
    let recycler2 = register_participant_with_role(&env, &client, ParticipantRole::Recycler, "rec2");
    let recycler3 = register_participant_with_role(&env, &client, ParticipantRole::Recycler, "rec3");

    let collector = register_participant_with_role(&env, &client, ParticipantRole::Collector, "col");

    // Each recycler submits waste
    let w1 = client.recycle_waste(&WasteType::Plastic, &2000, &recycler1, &0, &0);
    let w2 = client.recycle_waste(&WasteType::Plastic, &3000, &recycler2, &0, &0);
    let w3 = client.recycle_waste(&WasteType::Plastic, &4000, &recycler3, &0, &0);

    // All transfer to same collector
    client.transfer_waste_v2(&w1, &recycler1, &collector, &0, &0);
    client.transfer_waste_v2(&w2, &recycler2, &collector, &0, &0);
    client.transfer_waste_v2(&w3, &recycler3, &collector, &0, &0);

    // Verify collector received all waste
    let w1_final = client.get_waste(&w1).unwrap();
    let w2_final = client.get_waste(&w2).unwrap();
    let w3_final = client.get_waste(&w3).unwrap();

    assert_eq!(w1_final.current_owner, collector);
    assert_eq!(w2_final.current_owner, collector);
    assert_eq!(w3_final.current_owner, collector);

    // Verify stats
    let (total_wastes, total_weight, _) = client.get_supply_chain_stats();
    assert_eq!(total_wastes, 3);
    assert_eq!(total_weight, 9000); // 2000 + 3000 + 4000
}

#[test]
fn test_collector_aggregation_workflow() {
    let env = Env::default();
    let (client, _) = setup_admin(&env);

    let recycler1 = register_participant_with_role(&env, &client, ParticipantRole::Recycler, "rec1");
    let recycler2 = register_participant_with_role(&env, &client, ParticipantRole::Recycler, "rec2");
    let collector = register_participant_with_role(&env, &client, ParticipantRole::Collector, "col");
    let processor = register_participant_with_role(&env, &client, ParticipantRole::Manufacturer, "proc");

    // Multiple recyclers submit to collector
    let w1 = client.recycle_waste(&WasteType::Metal, &1500, &recycler1, &0, &0);
    let w2 = client.recycle_waste(&WasteType::Metal, &2500, &recycler2, &0, &0);

    client.transfer_waste_v2(&w1, &recycler1, &collector, &0, &0);
    client.transfer_waste_v2(&w2, &recycler2, &collector, &0, &0);

    // Collector aggregates and sends to processor
    client.transfer_waste_v2(&w1, &collector, &processor, &0, &0);
    client.transfer_waste_v2(&w2, &collector, &processor, &0, &0);

    // Verify processor received both batches
    let w1_final = client.get_waste(&w1).unwrap();
    let w2_final = client.get_waste(&w2).unwrap();

    assert_eq!(w1_final.current_owner, processor);
    assert_eq!(w2_final.current_owner, processor);

    // Verify transfer histories show collector as intermediary
    let h1 = client.get_waste_transfer_history_v2(&w1);
    let h2 = client.get_waste_transfer_history_v2(&w2);

    assert_eq!(h1.len(), 2);
    assert_eq!(h2.len(), 2);

    assert_eq!(h1.get(0).unwrap().to, collector);
    assert_eq!(h1.get(1).unwrap().from, collector);
}

#[test]
fn test_multi_manufacturer_incentive_competition() {
    let env = Env::default();
    let (client, _) = setup_admin(&env);

    let mfg1 = register_participant_with_role(&env, &client, ParticipantRole::Manufacturer, "mfg1");
    let mfg2 = register_participant_with_role(&env, &client, ParticipantRole::Manufacturer, "mfg2");
    let mfg3 = register_participant_with_role(&env, &client, ParticipantRole::Manufacturer, "mfg3");

    // All manufacturers create incentives for same waste type
    let i1 = client.create_incentive(&mfg1, &WasteType::Glass, &100, &50_000);
    let i2 = client.create_incentive(&mfg2, &WasteType::Glass, &150, &75_000); // Best offer
    let i3 = client.create_incentive(&mfg3, &WasteType::Glass, &80, &40_000);

    assert_ne!(i1.id, i2.id);
    assert_ne!(i2.id, i3.id);

    // Verify all are active
    assert!(client.get_incentive_by_id(&i1.id).is_some());
    assert!(client.get_incentive_by_id(&i2.id).is_some());
    assert!(client.get_incentive_by_id(&i3.id).is_some());

    // Check highest reward incentive
    let best = client.get_active_mfr_incentive(&mfg2, &WasteType::Glass);
    assert!(best.is_some());
}

// ══════════════════════════════════════════════════════════════════════════════
//  State Consistency Tests
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_waste_ownership_consistency_through_transfers() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);
    let collector = register_participant_with_role(&env, &client, ParticipantRole::Collector, "col");
    let processor = register_participant_with_role(&env, &client, ParticipantRole::Manufacturer, "proc");

    let waste_id = client.recycle_waste(&WasteType::Electronics, &7000, &recycler, &0, &0);

    // Initial owner
    let waste_initial = client.get_waste(&waste_id).unwrap();
    assert_eq!(waste_initial.current_owner, recycler);

    // After first transfer
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    let waste_after_1 = client.get_waste(&waste_id).unwrap();
    assert_eq!(waste_after_1.current_owner, collector);

    // After second transfer
    client.transfer_waste_v2(&waste_id, &collector, &processor, &0, &0);
    let waste_after_2 = client.get_waste(&waste_id).unwrap();
    assert_eq!(waste_after_2.current_owner, processor);

    // All other properties should remain unchanged
    assert_eq!(waste_after_2.waste_type, WasteType::Electronics);
    assert_eq!(waste_after_2.weight, 7000);
    assert_eq!(waste_after_2.waste_id, waste_id);
}

#[test]
fn test_participant_stats_consistency() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);

    let desc = String::from_str(&env, "Test material");

    // Submit materials
    let m1 = client.submit_material(&WasteType::Plastic, &1000, &recycler, &desc);
    let m2 = client.submit_material(&WasteType::Metal, &2000, &recycler, &desc);
    let m3 = client.submit_material(&WasteType::Glass, &1500, &recycler, &desc);

    // Check stats after submissions
    let stats_unverified = client.get_stats(&recycler).unwrap();
    assert_eq!(stats_unverified.total_submissions, 3);
    assert_eq!(stats_unverified.verified_submissions, 0);
    assert_eq!(stats_unverified.total_weight, 4500);

    // Verify some materials
    client.verify_material(&m1.id, &recycler);
    client.verify_material(&m2.id, &recycler);

    // Check stats after verification
    let stats_verified = client.get_stats(&recycler).unwrap();
    assert_eq!(stats_verified.total_submissions, 3);
    assert_eq!(stats_verified.verified_submissions, 2);
    assert_eq!(stats_verified.total_weight, 4500); // Weight doesn't change

    // Verify material type counts
    assert_eq!(stats_verified.plastic_count, 1);
    assert_eq!(stats_verified.metal_count, 1);
    assert_eq!(stats_verified.glass_count, 1);
}

#[test]
fn test_incentive_budget_consistency() {
    let env = Env::default();
    let (client, _) = setup_admin(&env);
    let manufacturer = register_participant_with_role(&env, &client, ParticipantRole::Manufacturer, "mfg");

    // Create incentive
    let incentive = client.create_incentive(&manufacturer, &WasteType::Organic, &200, &100_000);
    assert_eq!(incentive.total_budget, 100_000);
    assert_eq!(incentive.remaining_budget, 100_000);

    // Update incentive
    let updated = client.update_incentive(&incentive.id, &250, &150_000);
    assert_eq!(updated.reward_points, 250);
    assert_eq!(updated.total_budget, 150_000);

    // Verify consistency through retrieval
    let retrieved = client.get_incentive_by_id(&incentive.id).unwrap();
    assert_eq!(retrieved.reward_points, 250);
    assert_eq!(retrieved.total_budget, 150_000);
    assert_eq!(retrieved.remaining_budget, 150_000);
}

// ══════════════════════════════════════════════════════════════════════════════
//  Material Submission Workflow Tests
// ══════════════════════════════════════════════════════════════════════════════

#[test]
fn test_material_submission_verification_workflow() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);

    let desc = String::from_str(&env, "High-quality plastic bottles");

    // Submit material
    let material = client.submit_material(&WasteType::Plastic, &5000, &recycler, &desc);
    assert!(!material.verified);
    assert_eq!(material.weight, 5000);
    assert_eq!(material.submitted_by, recycler);

    // Verify material
    let verified = client.verify_material(&material.id, &recycler);
    assert!(verified.verified);

    // Check stats updated correctly
    let stats = client.get_stats(&recycler).unwrap();
    assert_eq!(stats.total_submissions, 1);
    assert_eq!(stats.verified_submissions, 1);
    assert_eq!(stats.total_weight, 5000);
}

#[test]
fn test_batch_material_operations() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);

    // Prepare batch
    let mut batch = Vec::new(&env);
    for i in 1..=10 {
        let desc = String::from_str(&env, "Batch item");
        batch.push_back((WasteType::Plastic, i * 100, desc));
    }

    // Submit batch
    let materials = client.submit_materials_batch(&batch, &recycler);
    assert_eq!(materials.len(), 10);

    // Verify all submitted materials
    let mut ids = Vec::new(&env);
    for material in materials.iter() {
        ids.push_back(material.id);
    }

    let verified = client.verify_materials_batch(&ids, &recycler);
    assert_eq!(verified.len(), 10);

    // Check stats
    let stats = client.get_stats(&recycler).unwrap();
    assert_eq!(stats.total_submissions, 10);
    assert_eq!(stats.verified_submissions, 10);

    // Total weight: 100 + 200 + ... + 1000 = 5500
    assert_eq!(stats.total_weight, 5500);
}

// ══════════════════════════════════════════════════════════════════════════════
//  Edge Case and Error Handling Tests
// ══════════════════════════════════════════════════════════════════════════════

#[test]
#[should_panic(expected = "Waste not found")]
fn test_transfer_nonexistent_waste_fails() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);
    let collector = register_participant_with_role(&env, &client, ParticipantRole::Collector, "col");

    // Attempt to transfer waste that doesn't exist
    client.transfer_waste_v2(&999999, &recycler, &collector, &0, &0);
}

#[test]
#[should_panic(expected = "Participant not registered")]
fn test_unregistered_participant_cannot_submit_waste() {
    let env = Env::default();
    let (client, _) = setup_admin(&env);

    let unregistered = Address::generate(&env);

    // Attempt to submit waste without being registered
    client.recycle_waste(&WasteType::Plastic, &1000, &unregistered, &0, &0);
}

#[test]
fn test_waste_confirmation_by_third_party() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);
    let auditor = register_participant_with_role(&env, &client, ParticipantRole::Auditor, "aud");

    let waste_id = client.recycle_waste(&WasteType::Textile, &3000, &recycler, &0, &0);

    // Third party (auditor) confirms
    let confirmed = client.confirm_waste_details(&waste_id, &auditor);
    assert!(confirmed.is_confirmed);

    // Verify confirmation persisted
    let waste = client.get_waste(&waste_id).unwrap();
    assert!(waste.is_confirmed);
}

#[test]
fn test_large_weight_waste_handling() {
    let env = Env::default();
    let (client, _, recycler) = setup_with_recycler(&env);

    // Test with very large weight (within u64 limits)
    let large_weight: u64 = 1_000_000_000; // 1 billion grams (1,000 metric tons)

    let waste_id = client.recycle_waste(&WasteType::Metal, &large_weight, &recycler, &0, &0);

    let waste = client.get_waste(&waste_id).unwrap();
    assert_eq!(waste.weight, large_weight);

    // Verify stats handle large numbers
    let (_, total_weight, _) = client.get_supply_chain_stats();
    assert_eq!(total_weight, large_weight);
}
