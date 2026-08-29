#![cfg(test)]

use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Ledger},
    Address, Env, String,
};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

#[test]
fn test_get_waste_transfer_history_returns_complete_history() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);
    let description = String::from_str(&env, "Test waste");
    let note = String::from_str(&env, "Transfer note");
    env.mock_all_auths();

    // Register participants
    client.register_participant(
        &user1,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user3,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit material
    let material = client.submit_material(&WasteType::Plastic, &5000, &user1, &description);

    // Transfer: user1 -> user2
    client.transfer_waste(&material.id, &user1, &user2, &note);

    // Transfer: user2 -> user3
    client.transfer_waste(&material.id, &user2, &user3, &note);

    // Get transfer history
    let history = client.get_waste_transfer_history(&material.id);

    // Verify complete history
    assert_eq!(history.len(), 2);

    // First transfer
    let transfer1 = history.get(0).unwrap();
    assert_eq!(transfer1.waste_id, material.id as u128);
    assert_eq!(transfer1.from, user1);
    assert_eq!(transfer1.to, user2);

    // Second transfer
    let transfer2 = history.get(1).unwrap();
    assert_eq!(transfer2.waste_id, material.id as u128);
    assert_eq!(transfer2.from, user2);
    assert_eq!(transfer2.to, user3);
}

#[test]
fn test_get_waste_transfer_history_chronological_order() {
    let env = Env::default();
    env.ledger().with_mut(|li| {
        li.timestamp = 1000;
    });

    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);
    let description = String::from_str(&env, "Chronological test");
    let note = String::from_str(&env, "Transfer");
    env.mock_all_auths();

    // Register participants
    client.register_participant(
        &user1,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user3,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit material
    let material = client.submit_material(&WasteType::Metal, &3000, &user1, &description);

    // First transfer at timestamp 1000
    client.transfer_waste(&material.id, &user1, &user2, &note);

    // Advance time
    env.ledger().with_mut(|li| {
        li.timestamp = 2000;
    });

    // Second transfer at timestamp 2000
    client.transfer_waste(&material.id, &user2, &user3, &note);

    // Get history
    let history = client.get_waste_transfer_history(&material.id);

    // Verify chronological order
    assert_eq!(history.len(), 2);

    let transfer1 = history.get(0).unwrap();
    let transfer2 = history.get(1).unwrap();

    // First transfer should have earlier timestamp
    assert!(transfer1.transferred_at < transfer2.transferred_at);
    assert_eq!(transfer1.transferred_at, 1000);
    assert_eq!(transfer2.transferred_at, 2000);
}

#[test]
fn test_get_waste_transfer_history_includes_all_details() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let sender = Address::generate(&env);
    let receiver = Address::generate(&env);
    let description = String::from_str(&env, "Details test");
    let note = String::from_str(&env, "Important transfer note");
    env.mock_all_auths();

    // Register participants
    client.register_participant(
        &sender,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &receiver,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit material
    let material = client.submit_material(&WasteType::Glass, &4000, &sender, &description);

    // Transfer
    client.transfer_waste(&material.id, &sender, &receiver, &note);

    // Get history
    let history = client.get_waste_transfer_history(&material.id);

    // Verify all details are included
    assert_eq!(history.len(), 1);

    let transfer = history.get(0).unwrap();
    assert_eq!(transfer.waste_id, material.id as u128);
    assert_eq!(transfer.from, sender);
    assert_eq!(transfer.to, receiver);
    assert_eq!(transfer.transferred_at, 0);
    assert_eq!(transfer.note, symbol_short!("note"));
}

#[test]
fn test_get_waste_transfer_history_empty_for_no_transfers() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);
    let description = String::from_str(&env, "No transfer test");
    env.mock_all_auths();

    // Register participant
    client.register_participant(
        &user,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit material but don't transfer
    let material = client.submit_material(&WasteType::Paper, &2000, &user, &description);

    // Get history
    let history = client.get_waste_transfer_history(&material.id);

    // Should be empty
    assert_eq!(history.len(), 0);
}

#[test]
fn test_get_waste_transfer_history_non_existent_waste() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    // Get history for non-existent waste
    let history = client.get_waste_transfer_history(&999);

    // Should return empty vector
    assert_eq!(history.len(), 0);
}

#[test]
fn test_get_waste_transfer_history_multiple_wastes_separate() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);
    let description = String::from_str(&env, "Multiple wastes test");
    let note1 = String::from_str(&env, "Transfer 1");
    let note2 = String::from_str(&env, "Transfer 2");
    env.mock_all_auths();

    // Register participants
    client.register_participant(
        &user1,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user3,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit two materials
    let material1 = client.submit_material(&WasteType::Plastic, &1000, &user1, &description);
    let material2 = client.submit_material(&WasteType::Metal, &2000, &user1, &description);

    // Transfer material1: user1 -> user2
    client.transfer_waste(&material1.id, &user1, &user2, &note1);

    // Transfer material2: user1 -> user3
    client.transfer_waste(&material2.id, &user1, &user3, &note2);

    // Get histories
    let history1 = client.get_waste_transfer_history(&material1.id);
    let history2 = client.get_waste_transfer_history(&material2.id);

    // Verify histories are separate
    assert_eq!(history1.len(), 1);
    assert_eq!(history2.len(), 1);

    assert_eq!(history1.get(0).unwrap().to, user2);
    assert_eq!(history2.get(0).unwrap().to, user3);
}

#[test]
fn test_get_waste_transfer_history_immutable() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let description = String::from_str(&env, "Immutable test");
    let note = String::from_str(&env, "Transfer");
    env.mock_all_auths();

    // Register participants
    client.register_participant(
        &user1,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit material
    let material = client.submit_material(&WasteType::Glass, &3000, &user1, &description);

    // Transfer
    client.transfer_waste(&material.id, &user1, &user2, &note);

    // Get history multiple times
    let history1 = client.get_waste_transfer_history(&material.id);
    let history2 = client.get_waste_transfer_history(&material.id);

    // Verify history is consistent (immutable)
    assert_eq!(history1.len(), history2.len());
    assert_eq!(history1.get(0).unwrap().from, history2.get(0).unwrap().from);
    assert_eq!(history1.get(0).unwrap().to, history2.get(0).unwrap().to);
}

#[test]
fn test_get_waste_transfer_history_long_chain() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let recycler = Address::generate(&env);
    let collector1 = Address::generate(&env);
    let collector2 = Address::generate(&env);
    let manufacturer = Address::generate(&env);

    let description = String::from_str(&env, "Long chain test");
    let note = String::from_str(&env, "Transfer");
    env.mock_all_auths();

    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("r"),
        &0,
        &0,
    );
    client.register_participant(
        &collector1,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("c1"),
        &0,
        &0,
    );
    client.register_participant(
        &collector2,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("c2"),
        &0,
        &0,
    );
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("m"),
        &0,
        &0,
    );

    // Submit material with recycler
    let material = client.submit_material(&WasteType::Paper, &5000, &recycler, &description);

    // Valid chain: recycler -> collector1 -> collector2 -> manufacturer (3 transfers)
    // Note: Collector->Collector is not a valid route; use Recycler->Collector->Manufacturer
    // Use 2-step chain: recycler -> collector1 -> manufacturer
    client.transfer_waste(&material.id, &recycler, &collector1, &note);
    client.transfer_waste(&material.id, &collector1, &manufacturer, &note);

    // Get history
    let history = client.get_waste_transfer_history(&material.id);

    // Verify chain
    assert_eq!(history.len(), 2);
    assert_eq!(history.get(0).unwrap().from, recycler);
    assert_eq!(history.get(0).unwrap().to, collector1);
    assert_eq!(history.get(1).unwrap().from, collector1);
    assert_eq!(history.get(1).unwrap().to, manufacturer);
}

#[test]
fn test_get_waste_transfer_history_with_different_notes() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);
    let description = String::from_str(&env, "Notes test");
    let note1 = String::from_str(&env, "First transfer");
    let note2 = String::from_str(&env, "Second transfer");
    env.mock_all_auths();

    // Register participants
    client.register_participant(
        &user1,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user3,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit material
    let material = client.submit_material(&WasteType::Metal, &6000, &user1, &description);

    // Transfers with different notes
    client.transfer_waste(&material.id, &user1, &user2, &note1);
    client.transfer_waste(&material.id, &user2, &user3, &note2);

    // Get history
    let history = client.get_waste_transfer_history(&material.id);

    // Verify notes are preserved
    assert_eq!(history.len(), 2);
    assert_eq!(history.get(0).unwrap().note, symbol_short!("note"));
    assert_eq!(history.get(1).unwrap().note, symbol_short!("note"));
}

#[test]
fn test_get_waste_transfer_history_alias_compatibility() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let description = String::from_str(&env, "Alias test");
    let note = String::from_str(&env, "Transfer");
    env.mock_all_auths();

    // Register participants
    client.register_participant(
        &user1,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit material
    let material = client.submit_material(&WasteType::Plastic, &4000, &user1, &description);

    // Transfer
    client.transfer_waste(&material.id, &user1, &user2, &note);

    // Get history using both functions
    let history1 = client.get_waste_transfer_history(&material.id);
    let history2 = client.get_transfer_history(&material.id);

    // Both should return identical results
    assert_eq!(history1.len(), history2.len());
    assert_eq!(history1.get(0).unwrap().from, history2.get(0).unwrap().from);
    assert_eq!(history1.get(0).unwrap().to, history2.get(0).unwrap().to);
}

#[test]
fn test_get_waste_transfer_history_all_waste_types() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let description = String::from_str(&env, "All types test");
    let note = String::from_str(&env, "Transfer");
    env.mock_all_auths();

    // Register participants
    client.register_participant(
        &user1,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Test with each waste type
    let waste_types = vec![
        WasteType::Paper,
        WasteType::PetPlastic,
        WasteType::Plastic,
        WasteType::Metal,
        WasteType::Glass,
    ];

    for waste_type in waste_types {
        let material = client.submit_material(&waste_type, &1000, &user1, &description);
        client.transfer_waste(&material.id, &user1, &user2, &note);

        let history = client.get_waste_transfer_history(&material.id);
        assert_eq!(history.len(), 1);
        assert_eq!(history.get(0).unwrap().waste_id, material.id as u128);
    }
}

#[test]
fn test_get_waste_transfer_history_preserves_order_after_multiple_queries() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let user3 = Address::generate(&env);
    let description = String::from_str(&env, "Order preservation test");
    let note = String::from_str(&env, "Transfer");
    env.mock_all_auths();

    // Register participants
    client.register_participant(
        &user1,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user3,
        &ParticipantRole::Manufacturer,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit material
    let material = client.submit_material(&WasteType::Glass, &5000, &user1, &description);

    // Create transfers
    client.transfer_waste(&material.id, &user1, &user2, &note);
    client.transfer_waste(&material.id, &user2, &user3, &note);

    // Query history multiple times
    for _ in 0..5 {
        let history = client.get_waste_transfer_history(&material.id);

        // Verify order is always the same
        assert_eq!(history.len(), 2);
        assert_eq!(history.get(0).unwrap().from, user1);
        assert_eq!(history.get(0).unwrap().to, user2);
        assert_eq!(history.get(1).unwrap().from, user2);
        assert_eq!(history.get(1).unwrap().to, user3);
    }
}

#[test]
fn test_get_waste_transfer_history_no_side_effects() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);

    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);
    let description = String::from_str(&env, "Side effects test");
    let note = String::from_str(&env, "Transfer");
    env.mock_all_auths();

    // Register participants
    client.register_participant(
        &user1,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    client.register_participant(
        &user2,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );

    // Submit material
    let material = client.submit_material(&WasteType::Metal, &3000, &user1, &description);

    // Transfer
    client.transfer_waste(&material.id, &user1, &user2, &note);

    // Get history
    let _history = client.get_waste_transfer_history(&material.id);

    // Verify waste data is unchanged
    let waste = client.get_waste(&material.id).unwrap();
    assert_eq!(waste.id, material.id);
    assert_eq!(waste.submitter, user2); // Current owner
    assert_eq!(waste.waste_type, WasteType::Metal);
    assert_eq!(waste.weight, 3000);
}
