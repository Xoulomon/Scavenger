#![cfg(test)]

use super::*;
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};

#[test]
fn test_record_and_retrieve_transfer() {
    let env = Env::default();
    let contract_id = env.register(WasteTransferContract, ());
    let client = WasteTransferContractClient::new(&env, &contract_id);

    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let waste_id = 12345u128;
    let latitude = 377749000i128; // 37.7749 degrees
    let longitude = -1224194000i128; // -122.4194 degrees
    let notes = symbol_short!("PICKUP");

    // Mock the auth for testing
    env.mock_all_auths();

    // Record a transfer
    client.record_transfer(&waste_id, &from, &to, &latitude, &longitude, &notes);

    // Retrieve transfers
    let transfers = client.get_transfers(&waste_id);
    assert_eq!(transfers.len(), 1);

    let transfer = transfers.get(0).unwrap();
    assert_eq!(transfer.waste_id, waste_id);
    assert_eq!(transfer.from, from);
    assert_eq!(transfer.to, to);
    assert_eq!(transfer.latitude, latitude);
    assert_eq!(transfer.longitude, longitude);
    assert_eq!(transfer.notes, notes);
    // Timestamp is captured from ledger
    assert_eq!(transfer.timestamp, env.ledger().timestamp());
}

#[test]
fn test_multiple_transfers() {
    let env = Env::default();
    let contract_id = env.register(WasteTransferContract, ());
    let client = WasteTransferContractClient::new(&env, &contract_id);

    let addr1 = Address::generate(&env);
    let addr2 = Address::generate(&env);
    let addr3 = Address::generate(&env);
    let waste_id = 99999u128;

    env.mock_all_auths();

    // Record multiple transfers for the same waste_id
    client.record_transfer(
        &waste_id,
        &addr1,
        &addr2,
        &100000000,
        &200000000,
        &symbol_short!("COLLECT"),
    );

    client.record_transfer(
        &waste_id,
        &addr2,
        &addr3,
        &300000000,
        &400000000,
        &symbol_short!("PROCESS"),
    );

    // Verify we have 2 transfers
    let transfers = client.get_transfers(&waste_id);
    assert_eq!(transfers.len(), 2);

    // Verify the order is preserved
    let first = transfers.get(0).unwrap();
    assert_eq!(first.from, addr1);
    assert_eq!(first.to, addr2);

    let second = transfers.get(1).unwrap();
    assert_eq!(second.from, addr2);
    assert_eq!(second.to, addr3);
}

#[test]
fn test_get_latest_transfer() {
    let env = Env::default();
    let contract_id = env.register(WasteTransferContract, ());
    let client = WasteTransferContractClient::new(&env, &contract_id);

    let waste_id = 55555u128;
    let addr1 = Address::generate(&env);
    let addr2 = Address::generate(&env);
    let addr3 = Address::generate(&env);

    env.mock_all_auths();

    // No transfers yet
    let latest = client.get_latest_transfer(&waste_id);
    assert!(latest.is_none());

    // Add first transfer
    client.record_transfer(
        &waste_id,
        &addr1,
        &addr2,
        &100000000,
        &200000000,
        &symbol_short!("FIRST"),
    );

    let latest = client.get_latest_transfer(&waste_id);
    assert!(latest.is_some());
    assert_eq!(latest.unwrap().notes, symbol_short!("FIRST"));

    // Add second transfer
    client.record_transfer(
        &waste_id,
        &addr2,
        &addr3,
        &300000000,
        &400000000,
        &symbol_short!("SECOND"),
    );

    let latest = client.get_latest_transfer(&waste_id);
    assert!(latest.is_some());
    assert_eq!(latest.unwrap().notes, symbol_short!("SECOND"));
}

#[test]
fn test_timestamp_accuracy() {
    let env = Env::default();
    let contract_id = env.register(WasteTransferContract, ());
    let client = WasteTransferContractClient::new(&env, &contract_id);

    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let waste_id = 77777u128;

    env.mock_all_auths();

    // Get current ledger timestamp
    let before_timestamp = env.ledger().timestamp();

    client.record_transfer(
        &waste_id,
        &from,
        &to,
        &100000000,
        &200000000,
        &symbol_short!("TEST"),
    );

    let transfer = client.get_latest_transfer(&waste_id).unwrap();
    
    // Timestamp should be >= the timestamp before recording
    assert!(transfer.timestamp >= before_timestamp);
}

#[test]
fn test_location_preservation() {
    let env = Env::default();
    let contract_id = env.register(WasteTransferContract, ());
    let client = WasteTransferContractClient::new(&env, &contract_id);

    let from = Address::generate(&env);
    let to = Address::generate(&env);
    let waste_id = 11111u128;
    
    // Test with precise coordinates
    let lat = 405163383i128; // 40.5163383 (New York)
    let lon = -741422778i128; // -74.1422778 (New York)

    env.mock_all_auths();

    client.record_transfer(&waste_id, &from, &to, &lat, &lon, &symbol_short!("NYC"));

    let transfer = client.get_latest_transfer(&waste_id).unwrap();
    
    // Verify exact location data is preserved
    assert_eq!(transfer.latitude, lat);
    assert_eq!(transfer.longitude, lon);
}

#[test]
fn test_different_waste_ids() {
    let env = Env::default();
    let contract_id = env.register(WasteTransferContract, ());
    let client = WasteTransferContractClient::new(&env, &contract_id);

    let from = Address::generate(&env);
    let to = Address::generate(&env);

    env.mock_all_auths();

    // Record transfers for different waste IDs
    client.record_transfer(&111, &from, &to, &100, &200, &symbol_short!("WASTE1"));
    client.record_transfer(&222, &from, &to, &300, &400, &symbol_short!("WASTE2"));

    // Verify they're stored separately
    let transfers1 = client.get_transfers(&111);
    let transfers2 = client.get_transfers(&222);

    assert_eq!(transfers1.len(), 1);
    assert_eq!(transfers2.len(), 1);
    assert_eq!(transfers1.get(0).unwrap().waste_id, 111);
    assert_eq!(transfers2.get(0).unwrap().waste_id, 222);
}
