use soroban_sdk::{testutils::Address as _, Address, Env, Symbol};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteGrade, WasteType};

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

fn recycle(client: &ScavengerContractClient, recycler: &Address) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &5000u128, recycler, &0i128, &0i128)
}

// ── 1. WasteGrade multiplier values ──────────────────────────────────────────

#[test]
fn test_grade_multipliers() {
    assert_eq!(WasteGrade::A.multiplier_pct(), 150);
    assert_eq!(WasteGrade::B.multiplier_pct(), 120);
    assert_eq!(WasteGrade::C.multiplier_pct(), 100);
    assert_eq!(WasteGrade::D.multiplier_pct(), 70);
}

// ── 2. from_u32 / is_valid ────────────────────────────────────────────────────

#[test]
fn test_grade_from_u32() {
    assert_eq!(WasteGrade::from_u32(0), Some(WasteGrade::A));
    assert_eq!(WasteGrade::from_u32(1), Some(WasteGrade::B));
    assert_eq!(WasteGrade::from_u32(2), Some(WasteGrade::C));
    assert_eq!(WasteGrade::from_u32(3), Some(WasteGrade::D));
    assert_eq!(WasteGrade::from_u32(4), None);
}

#[test]
fn test_grade_is_valid() {
    assert!(WasteGrade::is_valid(0));
    assert!(WasteGrade::is_valid(3));
    assert!(!WasteGrade::is_valid(4));
}

// ── 3. Default grade is C ─────────────────────────────────────────────────────

#[test]
fn test_new_waste_default_grade_is_c() {
    let (env, client, _admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = recycle(&client, &recycler);
    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.grade, WasteGrade::C);
}

// ── 4. Collector can grade ────────────────────────────────────────────────────

#[test]
fn test_collector_can_grade() {
    let (env, client, _admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    let waste_id = recycle(&client, &recycler);

    let waste = client.set_waste_grade(&waste_id, &WasteGrade::A, &collector);
    assert_eq!(waste.grade, WasteGrade::A);
}

// ── 5. Manufacturer can grade ─────────────────────────────────────────────────

#[test]
fn test_manufacturer_can_grade() {
    let (env, client, _admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);
    let waste_id = recycle(&client, &recycler);

    let waste = client.set_waste_grade(&waste_id, &WasteGrade::B, &manufacturer);
    assert_eq!(waste.grade, WasteGrade::B);
}

// ── 6. Recycler cannot grade ──────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Only collectors or manufacturers can grade waste")]
fn test_recycler_cannot_grade() {
    let (env, client, _admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = recycle(&client, &recycler);
    client.set_waste_grade(&waste_id, &WasteGrade::A, &recycler);
}

// ── 7. Cannot grade deactivated waste ────────────────────────────────────────

#[test]
#[should_panic(expected = "Waste is deactivated")]
fn test_cannot_grade_deactivated_waste() {
    let (env, client, admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    let waste_id = recycle(&client, &recycler);
    client.deactivate_waste(&waste_id, &admin);
    client.set_waste_grade(&waste_id, &WasteGrade::A, &collector);
}

// ── 8. Grade history is appended ─────────────────────────────────────────────

#[test]
fn test_grade_history_appended() {
    let (env, client, _admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);
    let waste_id = recycle(&client, &recycler);

    client.set_waste_grade(&waste_id, &WasteGrade::B, &collector);
    client.set_waste_grade(&waste_id, &WasteGrade::A, &manufacturer);

    let history = client.get_grade_history(&waste_id);
    assert_eq!(history.len(), 2);
    assert_eq!(history.get(0).unwrap().grade, WasteGrade::B);
    assert_eq!(history.get(1).unwrap().grade, WasteGrade::A);
}

// ── 9. get_wastes_by_grade returns correct IDs ───────────────────────────────

#[test]
fn test_get_wastes_by_grade() {
    let (env, client, _admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let id1 = recycle(&client, &recycler);
    let id2 = recycle(&client, &recycler);
    let id3 = recycle(&client, &recycler);

    client.set_waste_grade(&id1, &WasteGrade::A, &collector);
    client.set_waste_grade(&id2, &WasteGrade::A, &collector);
    // id3 stays at default C

    let grade_a = client.get_wastes_by_grade(&WasteGrade::A);
    assert_eq!(grade_a.len(), 2);
    assert!(grade_a.contains(id1));
    assert!(grade_a.contains(id2));

    let grade_c = client.get_wastes_by_grade(&WasteGrade::C);
    assert!(grade_c.contains(id3));
}

// ── 10. Grade stats recorded on grader ───────────────────────────────────────

#[test]
fn test_grade_stats_recorded() {
    let (env, client, _admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let id1 = recycle(&client, &recycler);
    let id2 = recycle(&client, &recycler);
    let id3 = recycle(&client, &recycler);

    client.set_waste_grade(&id1, &WasteGrade::A, &collector);
    client.set_waste_grade(&id2, &WasteGrade::A, &collector);
    client.set_waste_grade(&id3, &WasteGrade::D, &collector);

    let stats = client.get_stats(&collector).unwrap();
    assert_eq!(stats.grade_a_count, 2);
    assert_eq!(stats.grade_d_count, 1);
    assert_eq!(stats.grade_b_count, 0);
    assert_eq!(stats.grade_c_count, 0);
}

// ── 11. apply_grade_multiplier helper ────────────────────────────────────────

#[test]
fn test_apply_grade_multiplier() {
    use stellar_scavngr_contract::ScavengerContract;
    assert_eq!(ScavengerContract::apply_grade_multiplier(100, WasteGrade::A), 150);
    assert_eq!(ScavengerContract::apply_grade_multiplier(100, WasteGrade::B), 120);
    assert_eq!(ScavengerContract::apply_grade_multiplier(100, WasteGrade::C), 100);
    assert_eq!(ScavengerContract::apply_grade_multiplier(100, WasteGrade::D), 70);
}

// ── 12. Grade persists after transfer ────────────────────────────────────────

#[test]
fn test_grade_persists_after_transfer() {
    let (env, client, _admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    let _manufacturer = register(&client, &env, ParticipantRole::Manufacturer);

    let waste_id = recycle(&client, &recycler);
    client.set_waste_grade(&waste_id, &WasteGrade::A, &collector);

    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0i128, &0i128);

    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.grade, WasteGrade::A);
}
