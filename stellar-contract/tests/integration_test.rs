#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol};
use stellar_scavngr_contract::{
    ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType,
};

fn setup_full_ecosystem(env: &Env) -> (ScavengerContractClient, Address, Address, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let collector = Address::generate(env);
    let manufacturer = Address::generate(env);

    let name = soroban_sdk::symbol_short!("test");

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &1000000, &2000000);
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &1100000, &2100000);
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &name, &1200000, &2200000);

    (client, admin, recycler, collector, manufacturer)
}

// ========== Full Supply Chain Flow Tests ==========

#[test]
fn test_complete_recycler_to_collector_to_manufacturer_flow() {
    let env = Env::default();
    let (client, _, recycler, collector, manufacturer) = setup_full_ecosystem(&env);

    // Step 1: Recycler registers waste
    let waste_id = client.recycle_waste(&WasteType::Plastic, &5000, &recycler, &1000000, &2000000);
    assert!(waste_id > 0);

    // Step 2: Transfer from recycler to collector
    let transfer1 = client.transfer_waste_v2(&waste_id, &recycler, &collector, &1100000, &2100000);
    assert_eq!(transfer1.from, recycler);
    assert_eq!(transfer1.to, collector);

    // Step 3: Transfer from collector to manufacturer
    let transfer2 = client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &1200000, &2200000);
    assert_eq!(transfer2.from, collector);
    assert_eq!(transfer2.to, manufacturer);

    // Verify final ownership
    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.len(), 2);
}

#[test]
fn test_multiple_wastes_through_supply_chain() {
    let env = Env::default();
    let (client, _, recycler, collector, manufacturer) = setup_full_ecosystem(&env);

    // Register multiple waste types
    let plastic_id = client.recycle_waste(&WasteType::Plastic, &3000, &recycler, &0, &0);
    let metal_id = client.recycle_waste(&WasteType::Metal, &4000, &recycler, &0, &0);
    let glass_id = client.recycle_waste(&WasteType::Glass, &2000, &recycler, &0, &0);

    // Transfer all through supply chain
    client.transfer_waste_v2(&plastic_id, &recycler, &collector, &0, &0);
    client.transfer_waste_v2(&metal_id, &recycler, &collector, &0, &0);
    client.transfer_waste_v2(&glass_id, &recycler, &collector, &0, &0);

    client.transfer_waste_v2(&plastic_id, &collector, &manufacturer, &0, &0);
    client.transfer_waste_v2(&metal_id, &collector, &manufacturer, &0, &0);
    client.transfer_waste_v2(&glass_id, &collector, &manufacturer, &0, &0);

    // Verify all transfers
    assert_eq!(client.get_waste_transfer_history_v2(&plastic_id).len(), 2);
    assert_eq!(client.get_waste_transfer_history_v2(&metal_id).len(), 2);
    assert_eq!(client.get_waste_transfer_history_v2(&glass_id).len(), 2);
}

#[test]
fn test_material_submission_and_verification_flow() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_ecosystem(&env);

    let desc = String::from_str(&env, "Plastic bottles");

    // Submit material
    let material = client.submit_material(&WasteType::Plastic, &5000, &recycler, &desc);
    assert!(!material.verified);
    assert_eq!(material.weight, 5000);

    // Verify material
    let verified = client.verify_material(&material.id, &recycler);
    assert!(verified.verified);

    // Check stats updated
    let stats = client.get_stats(&recycler).unwrap();
    assert_eq!(stats.total_submissions, 1);
    assert_eq!(stats.verified_submissions, 1);
}

// ========== Reward Distribution Tests ==========

#[test]
fn test_reward_distribution_with_percentages() {
    let env = Env::default();
    let (client, admin, recycler, _, _) = setup_full_ecosystem(&env);

    // Set percentages
    client.set_percentages(&admin, &30, &20);

    let collector_pct = client.get_collector_percentage().unwrap();
    let owner_pct = client.get_owner_percentage().unwrap();

    assert_eq!(collector_pct, 30);
    assert_eq!(owner_pct, 20);

    // Submit and verify material
    let desc = String::from_str(&env, "Test");
    let material = client.submit_material(&WasteType::Metal, &10000, &recycler, &desc);
    client.verify_material(&material.id, &recycler);

    // Verify participant stats updated
    let participant = client.get_participant(&recycler).unwrap();
    assert!(participant.total_waste_processed > 0);
}

#[test]
fn test_batch_material_submission_and_verification() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_ecosystem(&env);

    let mut batch = soroban_sdk::Vec::new(&env);
    for i in 1..=5 {
        let desc = String::from_str(&env, "Batch item");
        batch.push_back((WasteType::Plastic, i * 1000, desc));
    }

    let materials = client.submit_materials_batch(&batch, &recycler);
    assert_eq!(materials.len(), 5);

    // Verify all materials
    let mut ids = soroban_sdk::Vec::new(&env);
    for material in materials.iter() {
        ids.push_back(material.id);
    }

    let verified = client.verify_materials_batch(&ids, &recycler);
    assert_eq!(verified.len(), 5);

    // Check stats
    let stats = client.get_stats(&recycler).unwrap();
    assert_eq!(stats.total_submissions, 5);
    assert_eq!(stats.verified_submissions, 5);
}

// ========== Multiple Participants Tests ==========

#[test]
fn test_multiple_recyclers_and_collectors() {
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup_full_ecosystem(&env);

    let name = soroban_sdk::symbol_short!("test");

    // Add more participants
    let recycler2 = Address::generate(&env);
    let recycler3 = Address::generate(&env);
    let collector2 = Address::generate(&env);

    client.register_participant(&recycler2, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&recycler3, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&collector2, &ParticipantRole::Collector, &name, &0, &0);

    // Each recycler submits waste
    let w1 = client.recycle_waste(&WasteType::Plastic, &1000, &recycler2, &0, &0);
    let w2 = client.recycle_waste(&WasteType::Metal, &2000, &recycler3, &0, &0);

    // Transfer to different collectors
    client.transfer_waste_v2(&w1, &recycler2, &collector2, &0, &0);
    client.transfer_waste_v2(&w2, &recycler3, &collector2, &0, &0);

    // Both collectors transfer to manufacturer
    client.transfer_waste_v2(&w1, &collector2, &manufacturer, &0, &0);
    client.transfer_waste_v2(&w2, &collector2, &manufacturer, &0, &0);

    // Verify transfers
    assert_eq!(client.get_waste_transfer_history_v2(&w1).len(), 2);
    assert_eq!(client.get_waste_transfer_history_v2(&w2).len(), 2);
}

#[test]
fn test_parallel_supply_chains() {
    let env = Env::default();
    let (client, _, recycler1, collector1, manufacturer1) = setup_full_ecosystem(&env);

    let name = soroban_sdk::symbol_short!("test");

    // Create second supply chain
    let recycler2 = Address::generate(&env);
    let collector2 = Address::generate(&env);
    let manufacturer2 = Address::generate(&env);

    client.register_participant(&recycler2, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&collector2, &ParticipantRole::Collector, &name, &0, &0);
    client.register_participant(&manufacturer2, &ParticipantRole::Manufacturer, &name, &0, &0);

    // Chain 1
    let w1 = client.recycle_waste(&WasteType::Plastic, &3000, &recycler1, &0, &0);
    client.transfer_waste_v2(&w1, &recycler1, &collector1, &0, &0);
    client.transfer_waste_v2(&w1, &collector1, &manufacturer1, &0, &0);

    // Chain 2
    let w2 = client.recycle_waste(&WasteType::Metal, &4000, &recycler2, &0, &0);
    client.transfer_waste_v2(&w2, &recycler2, &collector2, &0, &0);
    client.transfer_waste_v2(&w2, &collector2, &manufacturer2, &0, &0);

    // Verify both chains
    assert_eq!(client.get_waste_transfer_history_v2(&w1).len(), 2);
    assert_eq!(client.get_waste_transfer_history_v2(&w2).len(), 2);
}

// ========== Incentive Lifecycle Tests ==========

#[test]
fn test_complete_incentive_lifecycle() {
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup_full_ecosystem(&env);

    // Create incentive
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &10000);
    assert!(incentive.active);
    assert_eq!(incentive.total_budget, 10000);
    assert_eq!(incentive.remaining_budget, 10000);

    // Update incentive
    let updated = client.update_incentive(&incentive.id, &150, &15000);
    assert_eq!(updated.reward_points, 150);
    assert_eq!(updated.total_budget, 15000);

    // Deactivate incentive
    let deactivated = client.deactivate_incentive(&incentive.id, &manufacturer);
    assert!(!deactivated.active);
}

#[test]
fn test_multiple_incentives_same_waste_type() {
    let env = Env::default();
    let (client, _, _, _, manufacturer) = setup_full_ecosystem(&env);

    let name = soroban_sdk::symbol_short!("test");
    let manufacturer2 = Address::generate(&env);
    client.register_participant(&manufacturer2, &ParticipantRole::Manufacturer, &name, &0, &0);

    // Both manufacturers create incentives for plastic
    let i1 = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &5000);
    let i2 = client.create_incentive(&manufacturer2, &WasteType::Plastic, &150, &8000);

    assert_ne!(i1.id, i2.id);
    assert_eq!(i1.waste_type, WasteType::Plastic);
    assert_eq!(i2.waste_type, WasteType::Plastic);

    // Get active incentive for manufacturer (should return highest reward)
    let active = client.get_active_mfr_incentive(&manufacturer, &WasteType::Plastic);
    assert!(active.is_some());
}

#[test]
fn test_incentive_with_waste_flow() {
    let env = Env::default();
    let (client, _, recycler, collector, manufacturer) = setup_full_ecosystem(&env);

    // Manufacturer creates incentive
    let incentive = client.create_incentive(&manufacturer, &WasteType::Metal, &200, &20000);
    assert!(incentive.active);

    // Recycler submits matching waste type
    let waste_id = client.recycle_waste(&WasteType::Metal, &5000, &recycler, &0, &0);

    // Transfer through supply chain
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &0, &0);

    // Verify incentive still exists
    let retrieved = client.get_incentive_by_id(&incentive.id).unwrap();
    assert_eq!(retrieved.id, incentive.id);
}

// ========== Statistics Accuracy Tests ==========

#[test]
fn test_statistics_tracking_accuracy() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_ecosystem(&env);

    let desc = String::from_str(&env, "Test");

    // Submit multiple materials
    let m1 = client.submit_material(&WasteType::Plastic, &1000, &recycler, &desc);
    let m2 = client.submit_material(&WasteType::Metal, &2000, &recycler, &desc);
    let _m3 = client.submit_material(&WasteType::Glass, &1500, &recycler, &desc);

    // Verify some materials
    client.verify_material(&m1.id, &recycler);
    client.verify_material(&m2.id, &recycler);

    // Check stats
    let stats = client.get_stats(&recycler).unwrap();
    assert_eq!(stats.total_submissions, 3);
    assert_eq!(stats.verified_submissions, 2);
    assert_eq!(stats.total_weight, 4500);
    assert_eq!(stats.plastic_count, 1);
    assert_eq!(stats.metal_count, 1);
    assert_eq!(stats.glass_count, 1);
}

#[test]
fn test_global_statistics() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_ecosystem(&env);

    let name = soroban_sdk::symbol_short!("test");
    let recycler2 = Address::generate(&env);
    client.register_participant(&recycler2, &ParticipantRole::Recycler, &name, &0, &0);

    let desc = String::from_str(&env, "Test");

    // Multiple participants submit using new waste system
    client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    client.recycle_waste(&WasteType::Metal, &2000, &recycler2, &0, &0);

    // Check global stats
    let (total_wastes, total_weight, _) = client.get_supply_chain_stats();
    assert_eq!(total_wastes, 2);
    assert_eq!(total_weight, 3000);
}

#[test]
fn test_participant_info_with_stats() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_ecosystem(&env);

    let desc = String::from_str(&env, "Test");

    // Submit and verify materials
    let m1 = client.submit_material(&WasteType::Plastic, &2000, &recycler, &desc);
    client.verify_material(&m1.id, &recycler);

    // Get participant info
    let info = client.get_participant_info(&recycler).unwrap();
    assert_eq!(info.participant.address, recycler);
    assert_eq!(info.stats.total_submissions, 1);
    assert_eq!(info.stats.verified_submissions, 1);
    assert_eq!(info.stats.total_weight, 2000);
}

// ========== Event Sequence Tests ==========

#[test]
fn test_waste_registration_event_sequence() {
    let env = Env::default();
    let (client, _, recycler, _, _) = setup_full_ecosystem(&env);

    // Register waste (should emit event)
    let waste_id = client.recycle_waste(&WasteType::Plastic, &3000, &recycler, &1000000, &2000000);
    assert!(waste_id > 0);

    // Events are emitted but we verify by checking the waste exists
    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.len(), 0); // No transfers yet
}

#[test]
fn test_transfer_event_sequence() {
    let env = Env::default();
    let (client, _, recycler, collector, manufacturer) = setup_full_ecosystem(&env);

    let waste_id = client.recycle_waste(&WasteType::Metal, &4000, &recycler, &0, &0);

    // Each transfer should emit event
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &0, &0);

    // Verify event sequence through history
    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.len(), 2);
    assert_eq!(history.get(0).unwrap().from, recycler);
    assert_eq!(history.get(0).unwrap().to, collector);
    assert_eq!(history.get(1).unwrap().from, collector);
    assert_eq!(history.get(1).unwrap().to, manufacturer);
}

#[test]
fn test_confirmation_event_sequence() {
    let env = Env::default();
    let (client, _, recycler, collector, manufacturer) = setup_full_ecosystem(&env);

    let waste_id = client.recycle_waste(&WasteType::Glass, &2000, &recycler, &0, &0);

    // Transfer to collector
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    
    // Manufacturer confirms (third party)
    client.confirm_waste_details(&waste_id, &manufacturer);

    // Verify confirmation through history
    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.len(), 1);
}

// ========== Real-World Scenario Tests ==========

#[test]
fn test_realistic_daily_operations() {
    let env = Env::default();
    let (client, admin, recycler, collector, manufacturer) = setup_full_ecosystem(&env);

    // Setup: Admin configures system
    client.set_percentages(&admin, &25, &15);

    // Manufacturer creates incentives
    client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &50000);
    client.create_incentive(&manufacturer, &WasteType::Metal, &150, &75000);

    // Day 1: Recycler collects waste
    let w1 = client.recycle_waste(&WasteType::Plastic, &5000, &recycler, &1000000, &2000000);
    let w2 = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &1000100, &2000100);

    // Day 2: Collector picks up
    client.transfer_waste_v2(&w1, &recycler, &collector, &1100000, &2100000);
    client.transfer_waste_v2(&w2, &recycler, &collector, &1100100, &2100100);

    // Day 3: Manufacturer receives
    client.transfer_waste_v2(&w1, &collector, &manufacturer, &1200000, &2200000);
    client.transfer_waste_v2(&w2, &collector, &manufacturer, &1200100, &2200100);

    // Verify complete flow
    assert_eq!(client.get_waste_transfer_history_v2(&w1).len(), 2);
    assert_eq!(client.get_waste_transfer_history_v2(&w2).len(), 2);

    // Check stats
    let (total_wastes, _, _) = client.get_supply_chain_stats();
    assert_eq!(total_wastes, 2);
}

#[test]
fn test_multi_manufacturer_competition() {
    let env = Env::default();
    let (client, _, recycler, collector, manufacturer1) = setup_full_ecosystem(&env);

    let name = soroban_sdk::symbol_short!("test");
    let manufacturer2 = Address::generate(&env);
    let manufacturer3 = Address::generate(&env);

    client.register_participant(&manufacturer2, &ParticipantRole::Manufacturer, &name, &0, &0);
    client.register_participant(&manufacturer3, &ParticipantRole::Manufacturer, &name, &0, &0);

    // All manufacturers create competing incentives
    client.create_incentive(&manufacturer1, &WasteType::Plastic, &100, &10000);
    client.create_incentive(&manufacturer2, &WasteType::Plastic, &120, &12000);
    client.create_incentive(&manufacturer3, &WasteType::Plastic, &90, &9000);

    // Recycler submits plastic waste
    let waste_id = client.recycle_waste(&WasteType::Plastic, &5000, &recycler, &0, &0);

    // Transfer to collector
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);

    // Collector chooses manufacturer with best incentive
    client.transfer_waste_v2(&waste_id, &collector, &manufacturer2, &0, &0);

    // Verify final destination
    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.get(1).unwrap().to, manufacturer2);
}

#[test]
fn test_waste_confirmation_workflow() {
    let env = Env::default();
    let (client, _, recycler, collector, manufacturer) = setup_full_ecosystem(&env);

    // Register and transfer waste
    let waste_id = client.recycle_waste(&WasteType::Metal, &4000, &recycler, &0, &0);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);

    // Manufacturer confirms waste details (third party)
    let confirmed = client.confirm_waste_details(&waste_id, &manufacturer);
    assert!(confirmed.is_confirmed);

    // Transfer to manufacturer
    client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &0, &0);

    // Verify complete workflow
    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.len(), 2);
}

#[test]
fn test_bulk_collection_transfer() {
    let env = Env::default();
    let (client, _, _, collector, manufacturer) = setup_full_ecosystem(&env);

    let _name = soroban_sdk::symbol_short!("test");
    let notes = soroban_sdk::symbol_short!("bulk");

    // Collector transfers aggregated waste to manufacturer
    let waste_id = client.transfer_collected_waste(
        &WasteType::Plastic,
        &collector,
        &manufacturer,
        &1200000,
        &2200000,
        &notes,
    );

    assert!(waste_id > 0);

    // Verify transfer recorded
    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.len(), 1);
    assert_eq!(history.get(0).unwrap().from, collector);
    assert_eq!(history.get(0).unwrap().to, manufacturer);
}
