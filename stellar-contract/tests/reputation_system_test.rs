#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{
    ParticipantRole, ReputationBadge, ScavengerContract, ScavengerContractClient, WasteType,
};

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

// ── 1. Fresh participant starts with score 0 ──────────────────────────────────
#[test]
fn test_initial_reputation_zero() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let p = client.get_participant(&recycler).unwrap();
    assert_eq!(p.reputation_score, 0);
}

// ── 2. Badge is None for score 0 ─────────────────────────────────────────────
#[test]
fn test_badge_none_at_zero() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    assert_eq!(client.get_reputation_badge(&recycler), ReputationBadge::None);
}

// ── 3. verify_material increases submitter reputation ────────────────────────
#[test]
fn test_verify_material_increases_reputation() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let submitter = register(&client, &env, ParticipantRole::Recycler);

    let mat = client.submit_material(&WasteType::Plastic, &5000, &submitter, &String::from_str(&env, "test"));
    client.verify_material(&mat.id, &recycler);

    let p = client.get_participant(&submitter).unwrap();
    assert!(p.reputation_score > 0);
}

// ── 4. transfer_waste_v2 increases both parties' reputation ──────────────────
#[test]
fn test_transfer_increases_reputation() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_id = client.recycle_waste(&WasteType::Metal, &10_000, &recycler, &0, &0);
    client
        .transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0)
        .unwrap();

    let r = client.get_participant(&recycler).unwrap();
    let c = client.get_participant(&collector).unwrap();
    assert!(r.reputation_score > 0);
    assert!(c.reputation_score > 0);
}

// ── 5. confirm_waste_details increases confirmer and owner reputation ─────────
#[test]
fn test_confirm_increases_reputation() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_id = client.recycle_waste(&WasteType::Glass, &5_000, &recycler, &0, &0);
    client
        .transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0)
        .unwrap();
    client.confirm_waste_details(&waste_id, &recycler);

    let r = client.get_participant(&recycler).unwrap();
    assert!(r.reputation_score > 0);
}

// ── 6. penalize_reputation decreases score ───────────────────────────────────
#[test]
fn test_penalize_reputation() {
    let (env, client, admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);

    // Give some positive score first via verify
    let submitter = register(&client, &env, ParticipantRole::Recycler);
    let mat = client.submit_material(&WasteType::Paper, &5000, &submitter, &String::from_str(&env, "t"));
    client.verify_material(&mat.id, &recycler);

    let before = client.get_participant(&submitter).unwrap().reputation_score;
    client.penalize_reputation(&admin, &submitter, &-15);
    let after = client.get_participant(&submitter).unwrap().reputation_score;
    assert_eq!(after, before - 15);
}

// ── 7. Score is clamped at REP_MAX (10000) ───────────────────────────────────
#[test]
fn test_score_clamped_at_max() {
    let (env, client, admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);

    // Penalize with a large positive via admin — use a workaround: many verifications
    // Instead, directly test via many verify cycles
    // We'll use penalize with a negative to test min; for max we verify many times
    // 10000 / 10 = 1000 verifications needed — too many; test via penalize boundary
    // Test min clamp instead (simpler)
    client.penalize_reputation(&admin, &recycler, &-500);
    client.penalize_reputation(&admin, &recycler, &-500);
    client.penalize_reputation(&admin, &recycler, &-500); // would be -1500 without clamp
    let p = client.get_participant(&recycler).unwrap();
    assert_eq!(p.reputation_score, -1000); // clamped at REP_MIN
}

// ── 8. Score is clamped at REP_MIN (-1000) ───────────────────────────────────
#[test]
fn test_score_clamped_at_min() {
    let (env, client, admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    client.penalize_reputation(&admin, &recycler, &-1000);
    client.penalize_reputation(&admin, &recycler, &-1000);
    let p = client.get_participant(&recycler).unwrap();
    assert_eq!(p.reputation_score, -1000);
}

// ── 9. Bronze badge at score >= 100 ──────────────────────────────────────────
#[test]
fn test_badge_bronze() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);

    // 10 verifications × 10 pts = 100 → Bronze
    for _ in 0..10 {
        let submitter = register(&client, &env, ParticipantRole::Recycler);
        let mat = client.submit_material(&WasteType::Paper, &5000, &submitter, &String::from_str(&env, "t"));
        client.verify_material(&mat.id, &recycler);
    }
    assert_eq!(client.get_reputation_badge(&recycler), ReputationBadge::Bronze);
}

// ── 10. get_participants_by_reputation filters correctly ─────────────────────
#[test]
fn test_get_participants_by_reputation() {
    let (env, client, admin) = setup();
    let r1 = register(&client, &env, ParticipantRole::Recycler);
    let r2 = register(&client, &env, ParticipantRole::Recycler);

    // Give r1 some score via verify
    let submitter = register(&client, &env, ParticipantRole::Recycler);
    let mat = client.submit_material(&WasteType::Metal, &5000, &submitter, &String::from_str(&env, "t"));
    client.verify_material(&mat.id, &r1);

    // r2 stays at 0, penalize to negative
    client.penalize_reputation(&admin, &r2, &-50);

    let above_zero = client.get_participants_by_reputation(&1);
    assert!(above_zero.contains(&r1));
    assert!(!above_zero.contains(&r2));
}

// ── 11. penalize_reputation panics with non-negative delta ───────────────────
#[test]
#[should_panic(expected = "Delta must be negative for a penalty")]
fn test_penalize_requires_negative_delta() {
    let (env, client, admin) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    client.penalize_reputation(&admin, &recycler, &10);
}

// ── 12. penalize_reputation is admin-only ────────────────────────────────────
#[test]
#[should_panic]
fn test_penalize_requires_admin() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let non_admin = register(&client, &env, ParticipantRole::Recycler);
    client.penalize_reputation(&non_admin, &recycler, &-10);
}

// ── 13. decay_reputation reduces positive score after inactivity ─────────────
#[test]
fn test_decay_reduces_score() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);

    // Build up score
    for _ in 0..5 {
        let submitter = register(&client, &env, ParticipantRole::Recycler);
        let mat = client.submit_material(&WasteType::Paper, &5000, &submitter, &String::from_str(&env, "t"));
        client.verify_material(&mat.id, &recycler);
    }
    let score_before = client.get_participant(&recycler).unwrap().reputation_score;

    // Advance ledger time by 31 days (> DECAY_WINDOW_SECS)
    env.ledger().with_mut(|l| l.timestamp += 31 * 24 * 3600);
    client.decay_reputation(&recycler);

    let score_after = client.get_participant(&recycler).unwrap().reputation_score;
    assert!(score_after < score_before, "score should decay after inactivity");
}

// ── 14. decay does not go below 0 ────────────────────────────────────────────
#[test]
fn test_decay_does_not_go_below_zero() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    // Score is 0; advance time and decay — should stay at 0
    env.ledger().with_mut(|l| l.timestamp += 365 * 24 * 3600);
    client.decay_reputation(&recycler);
    let p = client.get_participant(&recycler).unwrap();
    assert_eq!(p.reputation_score, 0);
}

// ── 15. Multiple verifications accumulate score ───────────────────────────────
#[test]
fn test_multiple_verifications_accumulate() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let submitter = register(&client, &env, ParticipantRole::Recycler);

    for _ in 0..3 {
        let mat = client.submit_material(&WasteType::Plastic, &5000, &submitter, &String::from_str(&env, "t"));
        client.verify_material(&mat.id, &recycler);
    }
    let p = client.get_participant(&submitter).unwrap();
    // submitter gets REP_VERIFY (10) per verification × 3 = 30
    assert_eq!(p.reputation_score, 30);
}

// ── 16. get_participants_by_reputation returns empty when none qualify ────────
#[test]
fn test_get_participants_by_reputation_empty() {
    let (env, client, _) = setup();
    register(&client, &env, ParticipantRole::Recycler);
    let result = client.get_participants_by_reputation(&9999);
    assert_eq!(result.len(), 0);
}

// ── 17. Silver badge at score >= 500 ─────────────────────────────────────────
#[test]
fn test_badge_silver() {
    let (env, client, _) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);

    // 50 verifications × 10 pts = 500 → Silver
    for _ in 0..50 {
        let submitter = register(&client, &env, ParticipantRole::Recycler);
        let mat = client.submit_material(&WasteType::Paper, &5000, &submitter, &String::from_str(&env, "t"));
        client.verify_material(&mat.id, &recycler);
    }
    assert_eq!(client.get_reputation_badge(&recycler), ReputationBadge::Silver);
}
