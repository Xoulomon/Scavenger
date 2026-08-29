use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events},
    Address, Env, Vec,
};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

#[test]
fn test_batch_transfer_basic() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );

    // Create multiple waste items
    let waste_id1 = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);
    let waste_id2 = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);
    let waste_id3 = client.recycle_waste(&WasteType::Paper, &1500, &recycler, &40_000_000, &-74_000_000);

    // Batch transfer all three items
    let mut waste_ids = Vec::new(&env);
    waste_ids.push_back(waste_id1);
    waste_ids.push_back(waste_id2);
    waste_ids.push_back(waste_id3);

    let transfers = client.batch_transfer_waste(&waste_ids, &collector, &41_000_000, &-75_000_000);

    // Verify all transfers were successful
    assert_eq!(transfers.len(), 3);
    assert_eq!(transfers.get(0).unwrap().from, recycler);
    assert_eq!(transfers.get(0).unwrap().to, collector);
    assert_eq!(transfers.get(0).unwrap().waste_id, waste_id1);
    assert_eq!(transfers.get(1).unwrap().waste_id, waste_id2);
    assert_eq!(transfers.get(2).unwrap().waste_id, waste_id3);

    // Verify ownership changed
    let waste1 = client.get_waste_v2(&waste_id1).unwrap();
    let waste2 = client.get_waste_v2(&waste_id2).unwrap();
    let waste3 = client.get_waste_v2(&waste_id3).unwrap();
    assert_eq!(waste1.current_owner, collector);
    assert_eq!(waste2.current_owner, collector);
    assert_eq!(waste3.current_owner, collector);
}

#[test]
fn test_batch_transfer_empty_batch() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );

    let waste_ids = Vec::new(&env);
    let transfers = client.batch_transfer_waste(&waste_ids, &collector, &41_000_000, &-75_000_000);

    assert_eq!(transfers.len(), 0);
}

#[test]
fn test_batch_transfer_single_item() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );

    let waste_id = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);

    let mut waste_ids = Vec::new(&env);
    waste_ids.push_back(waste_id);

    let transfers = client.batch_transfer_waste(&waste_ids, &collector, &41_000_000, &-75_000_000);

    assert_eq!(transfers.len(), 1);
    assert_eq!(transfers.get(0).unwrap().waste_id, waste_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #7)")]
fn test_batch_transfer_nonexistent_waste() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );

    let waste_id1 = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);

    let mut waste_ids = Vec::new(&env);
    waste_ids.push_back(waste_id1);
    waste_ids.push_back(999999); // Non-existent waste ID

    client.batch_transfer_waste(&waste_ids, &collector, &41_000_000, &-75_000_000);
}

#[test]
fn test_batch_transfer_mixed_ownership() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler1 = Address::generate(&env);
    let recycler2 = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &recycler1,
        &ParticipantRole::Recycler,
        &symbol_short!("Rec1"),
        &100,
        &200,
    );
    client.register_participant(
        &recycler2,
        &ParticipantRole::Recycler,
        &symbol_short!("Rec2"),
        &150,
        &250,
    );
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );

    // Create waste items owned by different recyclers
    let waste_id1 = client.recycle_waste(&WasteType::Plastic, &2500, &recycler1, &40_000_000, &-74_000_000);
    let waste_id2 = client.recycle_waste(&WasteType::Metal, &3000, &recycler2, &40_000_000, &-74_000_000);

    // Verify initial ownership
    let waste1 = client.get_waste_v2(&waste_id1).unwrap();
    let waste2 = client.get_waste_v2(&waste_id2).unwrap();
    assert_eq!(waste1.current_owner, recycler1);
    assert_eq!(waste2.current_owner, recycler2);

    // Each recycler can only transfer their own waste
    let mut waste_ids1 = Vec::new(&env);
    waste_ids1.push_back(waste_id1);
    let transfers1 = client.batch_transfer_waste(&waste_ids1, &collector, &41_000_000, &-75_000_000);
    assert_eq!(transfers1.len(), 1);

    let mut waste_ids2 = Vec::new(&env);
    waste_ids2.push_back(waste_id2);
    let transfers2 = client.batch_transfer_waste(&waste_ids2, &collector, &41_000_000, &-75_000_000);
    assert_eq!(transfers2.len(), 1);

    // Verify both are now owned by collector
    let waste1_after = client.get_waste_v2(&waste_id1).unwrap();
    let waste2_after = client.get_waste_v2(&waste_id2).unwrap();
    assert_eq!(waste1_after.current_owner, collector);
    assert_eq!(waste2_after.current_owner, collector);
}

#[test]
#[should_panic(expected = "Error(Contract, #18)")]
fn test_batch_transfer_deactivated_waste() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );

    let waste_id1 = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);
    let waste_id2 = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    // Deactivate one waste item
    client.deactivate_waste(&waste_id1, &admin);

    let mut waste_ids = Vec::new(&env);
    waste_ids.push_back(waste_id1);
    waste_ids.push_back(waste_id2);

    // Should fail because waste_id1 is deactivated
    client.batch_transfer_waste(&waste_ids, &collector, &41_000_000, &-75_000_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #27)")]
fn test_batch_transfer_invalid_route() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let recycler2 = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &symbol_short!("Rec1"),
        &100,
        &200,
    );
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );
    client.register_participant(
        &recycler2,
        &ParticipantRole::Recycler,
        &symbol_short!("Rec2"),
        &500,
        &600,
    );

    let waste_id1 = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);

    // Transfer to collector first
    client.transfer_waste_v2(&waste_id1, &recycler, &collector, &41_000_000, &-75_000_000);

    let waste_id2 = client.recycle_waste(&WasteType::Metal, &3000, &collector, &41_000_000, &-75_000_000);

    let mut waste_ids = Vec::new(&env);
    waste_ids.push_back(waste_id1);
    waste_ids.push_back(waste_id2);

    // Should fail: collector -> recycler is invalid
    client.batch_transfer_waste(&waste_ids, &recycler2, &42_000_000, &-76_000_000);
}

#[test]
#[should_panic(expected = "Participant not found")]
fn test_batch_transfer_unregistered_recipient() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let unregistered = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);

    let mut waste_ids = Vec::new(&env);
    waste_ids.push_back(waste_id);

    client.batch_transfer_waste(&waste_ids, &unregistered, &41_000_000, &-75_000_000);
}

#[test]
fn test_batch_transfer_large_batch() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );

    // Create 10 waste items
    let mut waste_ids = Vec::new(&env);
    for i in 0..10 {
        let waste_id = client.recycle_waste(
            &WasteType::Plastic,
            &(2000 + i * 100),
            &recycler,
            &40_000_000,
            &-74_000_000,
        );
        waste_ids.push_back(waste_id);
    }

    let transfers = client.batch_transfer_waste(&waste_ids, &collector, &41_000_000, &-75_000_000);

    assert_eq!(transfers.len(), 10);

    // Verify all wastes are now owned by collector
    for waste_id in waste_ids.iter() {
        let waste = client.get_waste_v2(&waste_id).unwrap();
        assert_eq!(waste.current_owner, collector);
    }
}

#[test]
fn test_batch_transfer_events_emitted() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );

    let waste_id1 = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);
    let waste_id2 = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    let mut waste_ids = Vec::new(&env);
    waste_ids.push_back(waste_id1);
    waste_ids.push_back(waste_id2);

    let events_before = env.events().all().len();

    client.batch_transfer_waste(&waste_ids, &collector, &41_000_000, &-75_000_000);

    let events_after = env.events().all().len();

    // Should have emitted at least 2 new events (one for each waste transfer)
    assert!(events_after > events_before);
}

#[test]
fn test_batch_transfer_history_updated() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );

    let waste_id1 = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);
    let waste_id2 = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    let mut waste_ids = Vec::new(&env);
    waste_ids.push_back(waste_id1);
    waste_ids.push_back(waste_id2);

    client.batch_transfer_waste(&waste_ids, &collector, &41_000_000, &-75_000_000);

    // Verify transfer history was updated for both wastes
    let history1 = client.get_waste_transfer_history_v2(&waste_id1);
    let history2 = client.get_waste_transfer_history_v2(&waste_id2);

    assert_eq!(history1.len(), 1);
    assert_eq!(history2.len(), 1);
    assert_eq!(history1.get(0).unwrap().from, recycler);
    assert_eq!(history1.get(0).unwrap().to, collector);
    assert_eq!(history2.get(0).unwrap().from, recycler);
    assert_eq!(history2.get(0).unwrap().to, collector);
}

#[test]
fn test_batch_transfer_participant_waste_lists_updated() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );

    let waste_id1 = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);
    let waste_id2 = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    // Verify recycler owns both wastes initially
    let recycler_wastes_before = client.get_participant_wastes_v2(&recycler);
    assert_eq!(recycler_wastes_before.len(), 2);

    let mut waste_ids = Vec::new(&env);
    waste_ids.push_back(waste_id1);
    waste_ids.push_back(waste_id2);

    client.batch_transfer_waste(&waste_ids, &collector, &41_000_000, &-75_000_000);

    // Verify recycler no longer owns the wastes
    let recycler_wastes_after = client.get_participant_wastes_v2(&recycler);
    assert_eq!(recycler_wastes_after.len(), 0);

    // Verify collector now owns both wastes
    let collector_wastes = client.get_participant_wastes_v2(&collector);
    assert_eq!(collector_wastes.len(), 2);
    assert!(collector_wastes.contains(waste_id1));
    assert!(collector_wastes.contains(waste_id2));
}

#[test]
fn test_batch_transfer_atomic_validation() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    env.mock_all_auths();

    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );

    let waste_id1 = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);
    let waste_id2 = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);
    let waste_id3 = client.recycle_waste(&WasteType::Paper, &1500, &recycler, &40_000_000, &-74_000_000);

    // Deactivate the second waste
    client.deactivate_waste(&waste_id2, &admin);

    let mut waste_ids = Vec::new(&env);
    waste_ids.push_back(waste_id1);
    waste_ids.push_back(waste_id2); // This one is deactivated
    waste_ids.push_back(waste_id3);

    // Attempt batch transfer - should fail
    let result = client.try_batch_transfer_waste(&waste_ids, &collector, &41_000_000, &-75_000_000);
    assert!(result.is_err());

    // Verify NO transfers occurred (atomic validation)
    let waste1 = client.get_waste_v2(&waste_id1).unwrap();
    let waste3 = client.get_waste_v2(&waste_id3).unwrap();

    // Both should still be owned by recycler
    assert_eq!(waste1.current_owner, recycler);
    assert_eq!(waste3.current_owner, recycler);
}

#[test]
fn test_batch_transfer_recycler_to_manufacturer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &300,
        &400,
    );

    let waste_id1 = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);
    let waste_id2 = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    let mut waste_ids = Vec::new(&env);
    waste_ids.push_back(waste_id1);
    waste_ids.push_back(waste_id2);

    let transfers = client.batch_transfer_waste(&waste_ids, &manufacturer, &41_000_000, &-75_000_000);

    assert_eq!(transfers.len(), 2);
    assert_eq!(transfers.get(0).unwrap().to, manufacturer);
    assert_eq!(transfers.get(1).unwrap().to, manufacturer);
}

#[test]
fn test_batch_transfer_collector_to_manufacturer() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector = Address::generate(&env);
    let manufacturer = Address::generate(&env);
    env.mock_all_auths();

    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &100, &200);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &symbol_short!("Col"),
        &300,
        &400,
    );
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &500,
        &600,
    );

    let waste_id1 = client.recycle_waste(&WasteType::Plastic, &2500, &recycler, &40_000_000, &-74_000_000);
    let waste_id2 = client.recycle_waste(&WasteType::Metal, &3000, &recycler, &40_000_000, &-74_000_000);

    // Transfer to collector first
    client.transfer_waste_v2(&waste_id1, &recycler, &collector, &41_000_000, &-75_000_000);
    client.transfer_waste_v2(&waste_id2, &recycler, &collector, &41_000_000, &-75_000_000);

    let mut waste_ids = Vec::new(&env);
    waste_ids.push_back(waste_id1);
    waste_ids.push_back(waste_id2);

    let transfers = client.batch_transfer_waste(&waste_ids, &manufacturer, &42_000_000, &-76_000_000);

    assert_eq!(transfers.len(), 2);
    assert_eq!(transfers.get(0).unwrap().from, collector);
    assert_eq!(transfers.get(0).unwrap().to, manufacturer);
}
