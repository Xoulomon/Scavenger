#![cfg(test)]
extern crate std;

use crate::{Waste, WasteBuilder, WasteManagement, WasteManagementClient, WasteType};
use soroban_sdk::{testutils::Address as _, Address, Env};
use std::vec;

#[test]
fn test_waste_struct_creation() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let confirmer = Address::generate(&env);

    let waste = Waste {
        waste_id: 1,
        waste_type: WasteType::Plastic,
        weight: 1000,
        current_owner: owner.clone(),
        latitude: 404850000, // 40.4850000 * 10^7
        longitude: -740600000, // -74.0600000 * 10^7
        recycled_timestamp: 1234567890,
        is_active: true,
        is_confirmed: false,
        confirmer: confirmer.clone(),
    };

    assert_eq!(waste.waste_id, 1);
    assert_eq!(waste.waste_type, WasteType::Plastic);
    assert_eq!(waste.weight, 1000);
    assert_eq!(waste.current_owner, owner);
    assert_eq!(waste.latitude, 404850000);
    assert_eq!(waste.longitude, -740600000);
    assert_eq!(waste.recycled_timestamp, 1234567890);
    assert_eq!(waste.is_active, true);
    assert_eq!(waste.is_confirmed, false);
    assert_eq!(waste.confirmer, confirmer);
}

#[test]
fn test_waste_builder_pattern() {
    let env = Env::default();
    let owner = Address::generate(&env);
    let confirmer = Address::generate(&env);

    let waste = WasteBuilder::new()
        .waste_id(42)
        .waste_type(WasteType::Glass)
        .weight(2500)
        .current_owner(owner.clone())
        .latitude(337700000) // 33.7700000 * 10^7
        .longitude(-842800000) // -84.2800000 * 10^7
        .recycled_timestamp(9876543210)
        .is_active(true)
        .is_confirmed(true)
        .confirmer(confirmer.clone())
        .build();

    assert_eq!(waste.waste_id, 42);
    assert_eq!(waste.waste_type, WasteType::Glass);
    assert_eq!(waste.weight, 2500);
    assert_eq!(waste.current_owner, owner);
    assert_eq!(waste.latitude, 337700000);
    assert_eq!(waste.longitude, -842800000);
    assert_eq!(waste.recycled_timestamp, 9876543210);
    assert_eq!(waste.is_active, true);
    assert_eq!(waste.is_confirmed, true);
    assert_eq!(waste.confirmer, confirmer);
}

#[test]
fn test_all_waste_types() {
    let env = Env::default();
    let owner = Address::generate(&env);

    let waste_types = vec![
        WasteType::Plastic,
        WasteType::Glass,
        WasteType::Metal,
        WasteType::Paper,
        WasteType::Organic,
        WasteType::Electronic,
        WasteType::Hazardous,
        WasteType::Mixed,
    ];

    for (i, waste_type) in waste_types.iter().enumerate() {
        let waste = WasteBuilder::new()
            .waste_id(i as u128)
            .waste_type(waste_type.clone())
            .weight(1000)
            .current_owner(owner.clone())
            .latitude(0)
            .longitude(0)
            .recycled_timestamp(0)
            .is_active(true)
            .is_confirmed(false)
            .confirmer(owner.clone())
            .build();

        assert_eq!(waste.waste_type, *waste_type);
    }
}

#[test]
fn test_contract_create_waste() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(WasteManagement, ());
    let client = WasteManagementClient::new(&env, &contract_id);

    let owner = Address::generate(&env);

    let waste = client.create_waste(
        &123,
        &WasteType::Metal,
        &5000,
        &owner,
        &515000000, // 51.5000000 * 10^7 (London)
        &-1270000, // -0.1270000 * 10^7
    );

    assert_eq!(waste.waste_id, 123);
    assert_eq!(waste.waste_type, WasteType::Metal);
    assert_eq!(waste.weight, 5000);
    assert_eq!(waste.current_owner, owner);
    assert_eq!(waste.latitude, 515000000);
    assert_eq!(waste.longitude, -1270000);
    assert_eq!(waste.is_active, true);
    assert_eq!(waste.is_confirmed, false);
}

#[test]
#[should_panic(expected = "waste_id is required")]
fn test_builder_missing_waste_id() {
    let env = Env::default();
    let owner = Address::generate(&env);

    WasteBuilder::new()
        .waste_type(WasteType::Plastic)
        .weight(1000)
        .current_owner(owner.clone())
        .latitude(0)
        .longitude(0)
        .recycled_timestamp(0)
        .is_active(true)
        .is_confirmed(false)
        .confirmer(owner)
        .build();
}

#[test]
#[should_panic(expected = "waste_type is required")]
fn test_builder_missing_waste_type() {
    let env = Env::default();
    let owner = Address::generate(&env);

    WasteBuilder::new()
        .waste_id(1)
        .weight(1000)
        .current_owner(owner.clone())
        .latitude(0)
        .longitude(0)
        .recycled_timestamp(0)
        .is_active(true)
        .is_confirmed(false)
        .confirmer(owner)
        .build();
}
