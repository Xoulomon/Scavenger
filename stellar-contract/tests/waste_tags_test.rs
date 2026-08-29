use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup() -> (Env, ScavengerContractClient<'static>, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(&env, &contract_id);
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);
    (env, client, admin)
}

fn register(client: &ScavengerContractClient, env: &Env, role: ParticipantRole) -> Address {
    let addr = Address::generate(env);
    client.register_participant(&addr, &role, &Symbol::new(env, "user"), &0, &0);
    addr
}

fn recycle(client: &ScavengerContractClient, _env: &Env, recycler: &Address) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &5000u128, recycler, &0i128, &0i128)
}

fn tag(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

// ── 1. Add a tag and retrieve it ─────────────────────────────────────────────

#[test]
fn test_add_tag_basic() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = recycle(&client, &env, &recycler);

    let waste = client.add_waste_tag(&waste_id, &tag(&env, "recyclable"), &recycler);
    assert_eq!(waste.tags.len(), 1);
    assert_eq!(waste.tags.get(0).unwrap(), tag(&env, "recyclable"));
}

// ── 2. Tags are normalised to lowercase ──────────────────────────────────────

#[test]
fn test_tag_normalised_to_lowercase() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = recycle(&client, &env, &recycler);

    let waste = client.add_waste_tag(&waste_id, &tag(&env, "HAZARDOUS"), &recycler);
    assert_eq!(waste.tags.get(0).unwrap(), tag(&env, "hazardous"));
}

// ── 3. Duplicate tags are silently ignored ────────────────────────────────────

#[test]
fn test_duplicate_tag_ignored() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = recycle(&client, &env, &recycler);

    client.add_waste_tag(&waste_id, &tag(&env, "organic"), &recycler);
    let waste = client.add_waste_tag(&waste_id, &tag(&env, "ORGANIC"), &recycler); // same after normalise
    assert_eq!(waste.tags.len(), 1);
}

// ── 4. Tag limit of 10 enforced ───────────────────────────────────────────────

#[test]
#[should_panic(expected = "Tag limit reached")]
fn test_tag_limit_enforced() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = recycle(&client, &env, &recycler);

    let tags = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k"];
    for t in &tags {
        client.add_waste_tag(&waste_id, &tag(&env, t), &recycler);
    }
}

// ── 5. Tag length limit of 20 chars enforced ─────────────────────────────────

#[test]
#[should_panic(expected = "Tag exceeds maximum length of 20 characters")]
fn test_tag_too_long() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = recycle(&client, &env, &recycler);

    client.add_waste_tag(
        &waste_id,
        &tag(&env, "this_tag_is_way_too_long_for_the_limit"),
        &recycler,
    );
}

// ── 6. Empty tag rejected ─────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Tag cannot be empty")]
fn test_empty_tag_rejected() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = recycle(&client, &env, &recycler);

    client.add_waste_tag(&waste_id, &tag(&env, ""), &recycler);
}

// ── 7. Remove a tag ───────────────────────────────────────────────────────────

#[test]
fn test_remove_tag() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = recycle(&client, &env, &recycler);

    client.add_waste_tag(&waste_id, &tag(&env, "recyclable"), &recycler);
    client.add_waste_tag(&waste_id, &tag(&env, "organic"), &recycler);

    let waste = client.remove_waste_tag(&waste_id, &tag(&env, "RECYCLABLE"), &recycler);
    assert_eq!(waste.tags.len(), 1);
    assert_eq!(waste.tags.get(0).unwrap(), tag(&env, "organic"));
}

// ── 8. Remove non-existent tag is a no-op ────────────────────────────────────

#[test]
fn test_remove_nonexistent_tag_noop() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = recycle(&client, &env, &recycler);

    client.add_waste_tag(&waste_id, &tag(&env, "organic"), &recycler);
    let waste = client.remove_waste_tag(&waste_id, &tag(&env, "hazardous"), &recycler);
    assert_eq!(waste.tags.len(), 1);
}

// ── 9. get_wastes_by_tag returns correct IDs ─────────────────────────────────

#[test]
fn test_get_wastes_by_tag() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);

    let id1 = recycle(&client, &env, &recycler);
    let id2 = recycle(&client, &env, &recycler);
    let id3 = recycle(&client, &env, &recycler);

    client.add_waste_tag(&id1, &tag(&env, "recyclable"), &recycler);
    client.add_waste_tag(&id2, &tag(&env, "RECYCLABLE"), &recycler); // same after normalise
    client.add_waste_tag(&id3, &tag(&env, "hazardous"), &recycler);

    let results = client.get_wastes_by_tag(&tag(&env, "recyclable"));
    assert_eq!(results.len(), 2);
    assert!(results.contains(id1));
    assert!(results.contains(id2));
    assert!(!results.contains(id3));
}

// ── 10. Only owner can add tags ───────────────────────────────────────────────

#[test]
#[should_panic(expected = "Only the waste owner can add tags")]
fn test_only_owner_can_add_tag() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    let waste_id = recycle(&client, &env, &recycler);

    client.add_waste_tag(&waste_id, &tag(&env, "recyclable"), &collector);
}

// ── 11. Cannot add tag to deactivated waste ───────────────────────────────────

#[test]
#[should_panic(expected = "Waste is deactivated")]
fn test_cannot_tag_deactivated_waste() {
    let (env, client, admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = recycle(&client, &env, &recycler);

    client.deactivate_waste(&waste_id, &admin);
    client.add_waste_tag(&waste_id, &tag(&env, "recyclable"), &recycler);
}

// ── 12. Exact 20-char tag is accepted ────────────────────────────────────────

#[test]
fn test_tag_exactly_20_chars_accepted() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = recycle(&client, &env, &recycler);

    let twenty = "abcdefghijklmnopqrst"; // exactly 20 chars
    let waste = client.add_waste_tag(&waste_id, &tag(&env, twenty), &recycler);
    assert_eq!(waste.tags.len(), 1);
}
