#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};
use stellar_scavngr_contract::{
    ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType,
};

fn setup_contract(env: &Env) -> (ScavengerContractClient, Address, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let manufacturer = Address::generate(env);
    let name = soroban_sdk::symbol_short!("test");

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &name, &0, &0);

    (client, admin, recycler, manufacturer)
}

// ========== Basic Operation Gas Tests ==========

#[test]
fn test_gas_participant_registration() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    let participant = Address::generate(&env);
    let name = soroban_sdk::symbol_short!("test");
    
    client.initialize_admin(&admin);
    
    // Measure registration
    client.register_participant(&participant, &ParticipantRole::Recycler, &name, &1000000, &2000000);
    
    // Verify registration succeeded
    assert!(client.is_participant_registered(&participant));
}

#[test]
fn test_gas_waste_registration() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    // Single waste registration
    let waste_id = client.recycle_waste(&WasteType::Plastic, &5000, &recycler, &1000000, &2000000);
    assert!(waste_id > 0);
}

#[test]
fn test_gas_waste_transfer() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let name = soroban_sdk::symbol_short!("test");
    let collector = Address::generate(&env);
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &0, &0);
    
    let waste_id = client.recycle_waste(&WasteType::Plastic, &5000, &recycler, &0, &0);
    
    // Measure transfer
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &1100000, &2100000);
}

#[test]
fn test_gas_incentive_creation() {
    let env = Env::default();
    let (client, _, _, manufacturer) = setup_contract(&env);
    
    // Measure incentive creation
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &10000);
    assert!(incentive.active);
}

#[test]
fn test_gas_material_submission() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let desc = String::from_str(&env, "Test material");
    
    // Measure material submission
    let material = client.submit_material(&WasteType::Metal, &3000, &recycler, &desc);
    assert_eq!(material.weight, 3000);
}

#[test]
fn test_gas_material_verification() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let desc = String::from_str(&env, "Test");
    let material = client.submit_material(&WasteType::Plastic, &2000, &recycler, &desc);
    
    // Measure verification
    let verified = client.verify_material(&material.id, &recycler);
    assert!(verified.verified);
}

// ========== Batch Operation Gas Tests ==========

#[test]
fn test_gas_batch_small() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let mut batch = Vec::new(&env);
    for i in 1..=10 {
        let desc = String::from_str(&env, "Batch");
        batch.push_back((WasteType::Plastic, i * 100, desc));
    }
    
    let results = client.submit_materials_batch(&batch, &recycler);
    assert_eq!(results.len(), 10);
}

#[test]
fn test_gas_batch_medium() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let mut batch = Vec::new(&env);
    for i in 1..=50 {
        let desc = String::from_str(&env, "Batch");
        batch.push_back((WasteType::Metal, i * 100, desc));
    }
    
    let results = client.submit_materials_batch(&batch, &recycler);
    assert_eq!(results.len(), 50);
}

#[test]
fn test_gas_batch_verification() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let mut batch = Vec::new(&env);
    for i in 1..=20 {
        let desc = String::from_str(&env, "Batch");
        batch.push_back((WasteType::Glass, i * 100, desc));
    }
    
    let materials = client.submit_materials_batch(&batch, &recycler);
    
    let mut ids = Vec::new(&env);
    for material in materials.iter() {
        ids.push_back(material.id);
    }
    
    // Measure batch verification
    let verified = client.verify_materials_batch(&ids, &recycler);
    assert_eq!(verified.len(), 20);
}

// ========== Storage Access Tests ==========

#[test]
fn test_gas_get_participant() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    // Measure participant retrieval
    let participant = client.get_participant(&recycler);
    assert!(participant.is_some());
}

#[test]
fn test_gas_get_participant_info() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let desc = String::from_str(&env, "Test");
    client.submit_material(&WasteType::Plastic, &1000, &recycler, &desc);
    
    // Measure participant info retrieval (includes stats)
    let info = client.get_participant_info(&recycler);
    assert!(info.is_some());
}

#[test]
fn test_gas_get_waste_transfer_history() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let name = soroban_sdk::symbol_short!("test");
    let collector = Address::generate(&env);
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &0, &0);
    
    let waste_id = client.recycle_waste(&WasteType::Plastic, &3000, &recycler, &0, &0);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    
    // Measure history retrieval
    let history = client.get_waste_transfer_history_v2(&waste_id);
    assert_eq!(history.len(), 1);
}

#[test]
fn test_gas_get_incentives() {
    let env = Env::default();
    let (client, _, _, manufacturer) = setup_contract(&env);
    
    client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &5000);
    client.create_incentive(&manufacturer, &WasteType::Metal, &150, &7000);
    
    // Measure incentive retrieval
    let incentives = client.get_active_incentives();
    assert_eq!(incentives.len(), 2);
}

// ========== Large Dataset Tests ==========

#[test]
fn test_gas_multiple_waste_registrations() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    // Register 50 wastes
    for i in 1..=50 {
        client.recycle_waste(&WasteType::Plastic, &(i * 100), &recycler, &0, &0);
    }
    
    // Verify count
    let (total_wastes, _, _) = client.get_supply_chain_stats();
    assert_eq!(total_wastes, 50);
}

#[test]
fn test_gas_multiple_transfers() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let name = soroban_sdk::symbol_short!("test");
    let collector = Address::generate(&env);
    let manufacturer = Address::generate(&env);
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &0, &0);
    client.register_participant(&manufacturer, &ParticipantRole::Manufacturer, &name, &0, &0);
    
    // Create and transfer 20 wastes
    for i in 1..=20 {
        let waste_id = client.recycle_waste(&WasteType::Metal, &(i * 100), &recycler, &0, &0);
        client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
        client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &0, &0);
    }
}

#[test]
fn test_gas_multiple_participants() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);
    
    let name = soroban_sdk::symbol_short!("test");
    
    // Register 50 participants
    for _ in 0..50 {
        let participant = Address::generate(&env);
        client.register_participant(&participant, &ParticipantRole::Recycler, &name, &0, &0);
    }
}

#[test]
fn test_gas_multiple_incentives() {
    let env = Env::default();
    let (client, _, _, manufacturer) = setup_contract(&env);
    
    // Create 50 incentives
    for i in 1..=50 {
        let waste_type = match i % 5 {
            0 => WasteType::Paper,
            1 => WasteType::Plastic,
            2 => WasteType::Metal,
            3 => WasteType::Glass,
            _ => WasteType::PetPlastic,
        };
        client.create_incentive(&manufacturer, &waste_type, &(i * 10), &(i * 1000));
    }
}

// ========== Loop Optimization Tests ==========

#[test]
fn test_gas_get_participant_wastes_empty() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    // Measure with no wastes
    let wastes = client.get_participant_wastes(&recycler);
    assert_eq!(wastes.len(), 0);
}

#[test]
fn test_gas_get_participant_wastes_small() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let desc = String::from_str(&env, "Test");
    for _ in 0..10 {
        client.submit_material(&WasteType::Plastic, &1000, &recycler, &desc);
    }
    
    // Measure with 10 wastes
    let wastes = client.get_participant_wastes(&recycler);
    assert_eq!(wastes.len(), 10);
}

#[test]
fn test_gas_get_participant_wastes_large() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let desc = String::from_str(&env, "Test");
    for _ in 0..50 {
        client.submit_material(&WasteType::Metal, &1000, &recycler, &desc);
    }
    
    // Measure with 50 wastes
    let wastes = client.get_participant_wastes(&recycler);
    assert_eq!(wastes.len(), 50);
}

#[test]
fn test_gas_supply_chain_stats_large() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    // Create 50 wastes
    for i in 1..=50 {
        client.recycle_waste(&WasteType::Plastic, &(i * 100), &recycler, &0, &0);
    }
    
    // Measure stats calculation (iterates through all wastes)
    let (total_wastes, total_weight, _) = client.get_supply_chain_stats();
    assert_eq!(total_wastes, 50);
    assert!(total_weight > 0);
}

// ========== Complex Operation Tests ==========

#[test]
fn test_gas_complete_flow() {
    let env = Env::default();
    let (client, _, recycler, manufacturer) = setup_contract(&env);
    
    let name = soroban_sdk::symbol_short!("test");
    let collector = Address::generate(&env);
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &0, &0);
    
    // Complete flow: register, transfer, transfer, confirm
    let waste_id = client.recycle_waste(&WasteType::Plastic, &5000, &recycler, &0, &0);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    client.transfer_waste_v2(&waste_id, &collector, &manufacturer, &0, &0);
    client.confirm_waste_details(&waste_id, &recycler);
}

#[test]
fn test_gas_incentive_workflow() {
    let env = Env::default();
    let (client, _, _, manufacturer) = setup_contract(&env);
    
    // Create, update, deactivate
    let incentive = client.create_incentive(&manufacturer, &WasteType::Metal, &100, &10000);
    client.update_incentive(&incentive.id, &150, &15000);
    client.deactivate_incentive(&incentive.id, &manufacturer);
}

#[test]
fn test_gas_stats_update() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let desc = String::from_str(&env, "Test");
    
    // Submit and verify multiple materials (updates stats each time)
    for _ in 0..20 {
        let material = client.submit_material(&WasteType::Plastic, &1000, &recycler, &desc);
        client.verify_material(&material.id, &recycler);
    }
    
    let stats = client.get_stats(&recycler).unwrap();
    assert_eq!(stats.total_submissions, 20);
    assert_eq!(stats.verified_submissions, 20);
}

// ========== Comparison Tests ==========

#[test]
fn test_gas_single_vs_batch_submission() {
    let env = Env::default();
    let (client, _, _, _) = setup_contract(&env);
    
    let name = soroban_sdk::symbol_short!("test");
    let recycler1 = Address::generate(&env);
    let recycler2 = Address::generate(&env);
    client.register_participant(&recycler1, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&recycler2, &ParticipantRole::Recycler, &name, &0, &0);
    
    let desc = String::from_str(&env, "Test");
    
    // Single submissions
    for _ in 0..10 {
        client.submit_material(&WasteType::Plastic, &1000, &recycler1, &desc);
    }
    
    // Batch submission
    let mut batch = Vec::new(&env);
    for _ in 0..10 {
        batch.push_back((WasteType::Plastic, 1000, desc.clone()));
    }
    client.submit_materials_batch(&batch, &recycler2);
}

#[test]
fn test_gas_waste_exists_check() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let desc = String::from_str(&env, "Test");
    let material = client.submit_material(&WasteType::Plastic, &1000, &recycler, &desc);
    
    // Measure existence check (should be fast)
    assert!(client.waste_exists(&material.id));
    assert!(!client.waste_exists(&99999));
}

#[test]
fn test_gas_participant_registered_check() {
    let env = Env::default();
    let (client, _, recycler, _) = setup_contract(&env);
    
    let unregistered = Address::generate(&env);
    
    // Measure registration checks (should be fast)
    assert!(client.is_participant_registered(&recycler));
    assert!(!client.is_participant_registered(&unregistered));
}

#[test]
fn test_gas_role_validation() {
    let env = Env::default();
    let (client, _, recycler, manufacturer) = setup_contract(&env);
    
    // Measure role validation checks
    assert!(client.can_collect(&recycler));
    assert!(!client.can_collect(&manufacturer));
    assert!(client.can_manufacture(&manufacturer));
    assert!(!client.can_manufacture(&recycler));
}
