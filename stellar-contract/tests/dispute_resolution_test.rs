#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{DisputeStatus, ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

// ── helpers ───────────────────────────────────────────────────────────────────

fn setup() -> (Env, ScavengerContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &id);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);
    (env, client, admin)
}

fn register(client: &ScavengerContractClient, env: &Env, role: ParticipantRole) -> Address {
    let addr = Address::generate(env);
    client.register_participant(&addr, &role, &symbol_short!("p"), &0, &0);
    addr
}

fn make_waste(client: &ScavengerContractClient, env: &Env, recycler: &Address) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &10_000, recycler, &0, &0)
}

// ── 1. create_dispute returns a Pending dispute ───────────────────────────────
#[test]
fn test_create_dispute_pending() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = make_waste(&client, &env, &recycler);

    let dispute = client.create_dispute(&recycler, &waste_id, &String::from_str(&env, "Wrong weight"));

    assert_eq!(dispute.waste_id, waste_id);
    assert_eq!(dispute.disputer, recycler);
    assert_eq!(dispute.status, DisputeStatus::Pending);
}

// ── 2. create_dispute freezes the waste ──────────────────────────────────────
#[test]
fn test_create_dispute_freezes_waste() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = make_waste(&client, &env, &recycler);

    client.create_dispute(&recycler, &waste_id, &String::from_str(&env, "Bad quality"));

    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert!(waste.is_frozen);
}

// ── 3. Frozen waste cannot be transferred ────────────────────────────────────
#[test]
fn test_frozen_waste_cannot_be_transferred() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    let waste_id = make_waste(&client, &env, &recycler);

    client.create_dispute(&recycler, &waste_id, &String::from_str(&env, "Dispute"));

    let result = client.try_transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    assert!(result.is_err());
}

// ── 4. resolve_dispute with accepted=true → Resolved, waste unfrozen ─────────
#[test]
fn test_resolve_dispute_accepted() {
    let (env, client, admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = make_waste(&client, &env, &recycler);

    let dispute = client.create_dispute(&recycler, &waste_id, &String::from_str(&env, "Weight mismatch"));

    let resolved = client.resolve_dispute(
        &admin,
        &dispute.id,
        &true,
        &String::from_str(&env, "Confirmed by admin"),
    );

    assert_eq!(resolved.status, DisputeStatus::Resolved);
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert!(!waste.is_frozen);
}

// ── 5. resolve_dispute with accepted=false → Rejected, waste unfrozen ────────
#[test]
fn test_resolve_dispute_rejected() {
    let (env, client, admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = make_waste(&client, &env, &recycler);

    let dispute = client.create_dispute(&recycler, &waste_id, &String::from_str(&env, "Transfer issue"));

    let resolved = client.resolve_dispute(&admin, &dispute.id, &false, &String::from_str(&env, "No evidence"));

    assert_eq!(resolved.status, DisputeStatus::Rejected);
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert!(!waste.is_frozen);
}

// ── 6. After resolution, waste can be transferred again ──────────────────────
#[test]
fn test_transfer_allowed_after_resolution() {
    let (env, client, admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    let waste_id = make_waste(&client, &env, &recycler);

    let dispute = client.create_dispute(&recycler, &waste_id, &String::from_str(&env, "Issue"));
    client.resolve_dispute(&admin, &dispute.id, &false, &String::from_str(&env, "Rejected"));

    let result = client.try_transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
    assert!(result.is_ok());
}

// ── 7. Cannot create a second dispute on already-frozen waste ─────────────────
#[test]
#[should_panic(expected = "Waste already has an open dispute")]
fn test_duplicate_dispute_rejected() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = make_waste(&client, &env, &recycler);

    client.create_dispute(&recycler, &waste_id, &String::from_str(&env, "First"));
    client.create_dispute(&recycler, &waste_id, &String::from_str(&env, "Second"));
}

// ── 8. Cannot resolve an already-resolved dispute ────────────────────────────
#[test]
#[should_panic(expected = "Dispute is not pending")]
fn test_cannot_resolve_twice() {
    let (env, client, admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = make_waste(&client, &env, &recycler);

    let dispute = client.create_dispute(&recycler, &waste_id, &String::from_str(&env, "Issue"));
    client.resolve_dispute(&admin, &dispute.id, &true, &String::from_str(&env, "OK"));
    client.resolve_dispute(&admin, &dispute.id, &false, &String::from_str(&env, "Again"));
}

// ── 9. resolve_dispute is admin-only ─────────────────────────────────────────
#[test]
#[should_panic]
fn test_resolve_requires_admin() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = make_waste(&client, &env, &recycler);

    let dispute = client.create_dispute(&recycler, &waste_id, &String::from_str(&env, "Issue"));
    client.resolve_dispute(&recycler, &dispute.id, &true, &String::from_str(&env, "Self-resolve"));
}

// ── 10. get_disputes filters by Pending ──────────────────────────────────────
#[test]
fn test_get_disputes_pending() {
    let (env, client, admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);

    let w1 = make_waste(&client, &env, &recycler);
    let w2 = make_waste(&client, &env, &recycler);

    let d1 = client.create_dispute(&recycler, &w1, &String::from_str(&env, "A"));
    let d2 = client.create_dispute(&recycler, &w2, &String::from_str(&env, "B"));

    // Resolve d1
    client.resolve_dispute(&admin, &d1.id, &true, &String::from_str(&env, "OK"));

    let pending = client.get_disputes(&DisputeStatus::Pending);
    assert_eq!(pending.len(), 1);
    assert_eq!(pending.get(0).unwrap().id, d2.id);
}

// ── 11. get_disputes filters by Resolved ─────────────────────────────────────
#[test]
fn test_get_disputes_resolved() {
    let (env, client, admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);

    let w1 = make_waste(&client, &env, &recycler);
    let d1 = client.create_dispute(&recycler, &w1, &String::from_str(&env, "A"));
    client.resolve_dispute(&admin, &d1.id, &true, &String::from_str(&env, "OK"));

    let resolved = client.get_disputes(&DisputeStatus::Resolved);
    assert_eq!(resolved.len(), 1);
    assert_eq!(resolved.get(0).unwrap().id, d1.id);
}

// ── 12. Reason exceeding 500 chars is rejected ───────────────────────────────
#[test]
#[should_panic(expected = "Reason exceeds 500 characters")]
fn test_reason_too_long() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = make_waste(&client, &env, &recycler);

    let long_reason = String::from_str(&env, &"x".repeat(501));
    client.create_dispute(&recycler, &waste_id, &long_reason);
}

// ── 13. create_dispute on non-existent waste panics ──────────────────────────
#[test]
#[should_panic(expected = "Waste not found")]
fn test_dispute_nonexistent_waste() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    client.create_dispute(&recycler, &9999, &String::from_str(&env, "Ghost waste"));
}

// ── 14. get_dispute returns correct dispute by ID ────────────────────────────
#[test]
fn test_get_dispute_by_id() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = make_waste(&client, &env, &recycler);

    let created = client.create_dispute(&recycler, &waste_id, &String::from_str(&env, "Quality issue"));

    let fetched = client.get_dispute(&created.id).unwrap();
    assert_eq!(fetched.id, created.id);
    assert_eq!(fetched.waste_id, waste_id);
    assert_eq!(fetched.status, DisputeStatus::Pending);
}

// ── 15. Unregistered participant cannot create dispute ───────────────────────
#[test]
#[should_panic]
fn test_unregistered_cannot_dispute() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = make_waste(&client, &env, &recycler);

    let stranger = Address::generate(&env);
    client.create_dispute(&stranger, &waste_id, &String::from_str(&env, "Stranger things"));
}
