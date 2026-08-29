#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, Vec};
use stellar_scavngr_contract::{
    CollectionRoute, ParticipantRole, RouteStatus, ScavengerContract, ScavengerContractClient, WasteType,
};

// ── helpers ───────────────────────────────────────────────────────────────────

fn setup() -> (Env, ScavengerContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &id);
    (env, client)
}

fn register(client: &ScavengerContractClient, env: &Env, role: ParticipantRole) -> Address {
    let addr = Address::generate(env);
    client.register_participant(&addr, &role, &symbol_short!("p"), &0, &0);
    addr
}

/// Register a waste at the given coordinates (microdegrees).
fn register_waste(client: &ScavengerContractClient, recycler: &Address, lat: i128, lon: i128) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &5_000, recycler, &lat, &lon)
}

// ── 1. create_collection_route returns a Pending route ───────────────────────
#[test]
fn test_create_route_pending() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let w1 = register_waste(&client, &recycler, 0, 0);
    let mut ids = Vec::new(&env);
    ids.push_back(w1);

    let route = client.create_collection_route(&collector, &ids);
    assert_eq!(route.collector, collector);
    assert_eq!(route.status, RouteStatus::Pending);
    assert_eq!(route.waste_ids.len(), 1);
}

// ── 2. complete_route sets status to Completed ───────────────────────────────
#[test]
fn test_complete_route() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let w1 = register_waste(&client, &recycler, 0, 0);
    let mut ids = Vec::new(&env);
    ids.push_back(w1);

    let route = client.create_collection_route(&collector, &ids);
    let completed = client.complete_route(&collector, &route.id);
    assert_eq!(completed.status, RouteStatus::Completed);
}

// ── 3. get_route retrieves the correct route ──────────────────────────────────
#[test]
fn test_get_route() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let w1 = register_waste(&client, &recycler, 0, 0);
    let mut ids = Vec::new(&env);
    ids.push_back(w1);

    let created = client.create_collection_route(&collector, &ids);
    let fetched = client.get_route(&created.id).unwrap();
    assert_eq!(fetched.id, created.id);
    assert_eq!(fetched.collector, collector);
}

// ── 4. Only collectors can create routes ─────────────────────────────────────
#[test]
#[should_panic(expected = "Only collectors can create routes")]
fn test_only_collector_can_create_route() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);

    let w1 = register_waste(&client, &recycler, 0, 0);
    let mut ids = Vec::new(&env);
    ids.push_back(w1);

    client.create_collection_route(&recycler, &ids);
}

// ── 5. Route cannot exceed 50 waste items ────────────────────────────────────
#[test]
#[should_panic(expected = "Route cannot exceed 50 waste items")]
fn test_route_max_50_wastes() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let mut ids = Vec::new(&env);
    for _ in 0..51 {
        let w = register_waste(&client, &recycler, 0, 0);
        ids.push_back(w);
    }
    client.create_collection_route(&collector, &ids);
}

// ── 6. Empty waste list is rejected ──────────────────────────────────────────
#[test]
#[should_panic(expected = "Route must contain at least one waste item")]
fn test_empty_route_rejected() {
    let (env, client) = setup();
    let collector = register(&client, &env, ParticipantRole::Collector);
    let ids: Vec<u128> = Vec::new(&env);
    client.create_collection_route(&collector, &ids);
}

// ── 7. Only assigned collector can complete route ────────────────────────────
#[test]
#[should_panic(expected = "Only the assigned collector can complete this route")]
fn test_wrong_collector_cannot_complete() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector1 = register(&client, &env, ParticipantRole::Collector);
    let collector2 = register(&client, &env, ParticipantRole::Collector);

    let w1 = register_waste(&client, &recycler, 0, 0);
    let mut ids = Vec::new(&env);
    ids.push_back(w1);

    let route = client.create_collection_route(&collector1, &ids);
    client.complete_route(&collector2, &route.id);
}

// ── 8. Cannot complete an already-completed route ────────────────────────────
#[test]
#[should_panic(expected = "Route is not pending")]
fn test_cannot_complete_twice() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let w1 = register_waste(&client, &recycler, 0, 0);
    let mut ids = Vec::new(&env);
    ids.push_back(w1);

    let route = client.create_collection_route(&collector, &ids);
    client.complete_route(&collector, &route.id);
    client.complete_route(&collector, &route.id);
}

// ── 9. get_wastes_in_radius returns nearby wastes ────────────────────────────
#[test]
fn test_get_wastes_in_radius() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);

    // Register waste at origin (0, 0)
    let w_near = register_waste(&client, &recycler, 0, 0);
    // Register waste ~200 km away (≈ 1.8° lat ≈ 1_800_000 microdegrees)
    let _w_far = register_waste(&client, &recycler, 1_800_000, 0);

    // Query within 50 km of origin
    let result = client.get_wastes_in_radius(&0, &0, &50);
    assert!(result.contains(&w_near));
    assert!(!result.contains(&_w_far));
}

// ── 10. get_wastes_in_radius returns empty when none in range ─────────────────
#[test]
fn test_get_wastes_in_radius_empty() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);

    // Waste far from query point
    register_waste(&client, &recycler, 50_000_000, 0); // 50° lat away

    let result = client.get_wastes_in_radius(&0, &0, &10);
    assert_eq!(result.len(), 0);
}

// ── 11. Route with invalid waste ID panics ───────────────────────────────────
#[test]
#[should_panic(expected = "Waste not found or inactive")]
fn test_route_with_invalid_waste_id() {
    let (env, client) = setup();
    let collector = register(&client, &env, ParticipantRole::Collector);

    let mut ids = Vec::new(&env);
    ids.push_back(9999u128); // non-existent
    client.create_collection_route(&collector, &ids);
}
