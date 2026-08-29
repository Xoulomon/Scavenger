mod common;
use common::event_helpers::*;

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, IntoVal, Symbol, TryIntoVal, Vec};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

// ── shared setup ─────────────────────────────────────────────────────────────

fn setup_recycler(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let recycler = Address::generate(env);
    env.mock_all_auths();
    client.register_participant(
        &recycler,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("user"),
        &0,
        &0,
    );
    (client, recycler)
}

// ── tests ─────────────────────────────────────────────────────────────────────

#[test]
fn test_waste_registered_event_emitted() {
    let env = Env::default();
    let (client, recycler) = setup_recycler(&env);

    let waste_type = WasteType::Plastic;
    let weight: u128 = 2500;
    let latitude: i128 = 40_500_000;
    let longitude: i128 = -74_000_000;

    let waste_id = client.recycle_waste(&waste_type, &weight, &recycler, &latitude, &longitude);

    // ── using helpers ──────────────────────────────────────────────────────
    assert_at_least_n_events(&env, 1);
    assert_last_event_symbol(&env, symbol_short!("recycled"));
    assert_last_event_topics(&env, (symbol_short!("recycled"), waste_id));

    // Verify data fields
    let (_, _, data_val) = last_event(&env);
    let event_data: (WasteType, u128, Address, i128, i128) = data_val.try_into_val(&env).unwrap();
    assert_eq!(event_data.0, waste_type);
    assert_eq!(event_data.1, weight);
    assert_eq!(event_data.2, recycler);
    assert_eq!(event_data.3, latitude);
    assert_eq!(event_data.4, longitude);
}

#[test]
fn test_waste_registered_event_fields() {
    let env = Env::default();
    let (client, recycler) = setup_recycler(&env);

    let test_cases = vec![
        (WasteType::Paper, 1000u128, 51_500_000i128, 0i128),
        (WasteType::Metal, 5000u128, -33_900_000i128, 151_200_000i128),
        (WasteType::Glass, 3500u128, 35_700_000i128, 139_700_000i128),
    ];

    for (waste_type, weight, lat, lon) in test_cases {
        let waste_id = client.recycle_waste(&waste_type, &weight, &recycler, &lat, &lon);

        // ── helpers replace 6 manual asserts ──────────────────────────────
        assert_last_event_topics(&env, (symbol_short!("recycled"), waste_id));

        let (_, _, data_val) = last_event(&env);
        let event_data: (WasteType, u128, Address, i128, i128) = data_val.try_into_val(&env).unwrap();
        assert_eq!(event_data.0, waste_type, "Waste type mismatch");
        assert_eq!(event_data.1, weight, "Weight mismatch");
        assert_eq!(event_data.2, recycler, "Recycler address mismatch");
        assert_eq!(event_data.3, lat, "Latitude mismatch");
        assert_eq!(event_data.4, lon, "Longitude mismatch");
    }
}

#[test]
fn test_waste_registered_event_multiple_wastes() {
    let env = Env::default();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let recycler1 = Address::generate(&env);
    let recycler2 = Address::generate(&env);
    env.mock_all_auths();

    let name = soroban_sdk::symbol_short!("user");
    client.register_participant(&recycler1, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&recycler2, &ParticipantRole::Recycler, &name, &0, &0);

    let snap = snapshot(&env);

    let waste_id1 = client.recycle_waste(&WasteType::Plastic, &2000, &recycler1, &40_000_000, &-74_000_000);
    let waste_id2 = client.recycle_waste(&WasteType::Metal, &3000, &recycler2, &41_000_000, &-73_000_000);

    // ── helpers ────────────────────────────────────────────────────────────
    let new_events = events_since(&env, snap);
    assert_eq!(new_events.len(), 2, "expected exactly 2 waste-registered events");

    // Second-to-last event = waste_id1
    assert_nth_last_event_topics(&env, 1, (symbol_short!("recycled"), waste_id1));
    // Last event = waste_id2
    assert_last_event_topics(&env, (symbol_short!("recycled"), waste_id2));

    // Verify data
    let (_, _, d1) = nth_last_event(&env, 1);
    let data1: (WasteType, u128, Address, i128, i128) = d1.try_into_val(&env).unwrap();
    assert_eq!(data1.0, WasteType::Plastic);
    assert_eq!(data1.2, recycler1);

    let (_, _, d2) = last_event(&env);
    let data2: (WasteType, u128, Address, i128, i128) = d2.try_into_val(&env).unwrap();
    assert_eq!(data2.0, WasteType::Metal);
    assert_eq!(data2.2, recycler2);
}

#[test]
fn test_waste_registered_event_with_boundary_coordinates() {
    let env = Env::default();
    let (client, recycler) = setup_recycler(&env);

    let boundary_tests = vec![
        (90_000_000i128, 180_000_000i128),
        (-90_000_000i128, -180_000_000i128),
        (0, 0),
        (90_000_000i128, -180_000_000i128),
        (-90_000_000i128, 180_000_000i128),
    ];

    for (lat, lon) in boundary_tests {
        client.recycle_waste(&WasteType::PetPlastic, &1500, &recycler, &lat, &lon);

        let (_, _, data_val) = last_event(&env);
        let event_data: (WasteType, u128, Address, i128, i128) = data_val.try_into_val(&env).unwrap();
        assert_eq!(event_data.3, lat, "Latitude should match");
        assert_eq!(event_data.4, lon, "Longitude should match");
    }
}

#[test]
fn test_waste_registered_event_symbol() {
    let env = Env::default();
    let (client, recycler) = setup_recycler(&env);

    client.recycle_waste(&WasteType::Paper, &1000, &recycler, &40_000_000, &-74_000_000);

    // ── helper replaces manual topics extraction ───────────────────────────
    assert_last_event_symbol(&env, symbol_short!("recycled"));
    assert_event_emitted_with_symbol(&env, symbol_short!("recycled"));
}
