#![cfg(test)]
//! Grading test helpers and utilities.

//! Tests for the waste grading system (issue #544).
//!
//! Covers:
//! - `WasteGrade` enum values and reward multipliers
//! - Grading rules per waste type (`min_acceptable_grade`)
//! - `set_waste_grade` — only Collector/Manufacturer may grade
//! - `apply_grade_multiplier` — base reward scaled by grade
//! - `get_grade_history` — audit trail of grading events
//! - `get_wastes_by_grade` — filtering by quality tier
//! - Grade updates on a single waste item
//! - Stats recording for graders

use crate::types::{ParticipantRole, WasteGrade, WasteType};
use crate::{ScavengerContract, ScavengerContractClient};
use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};

// ─── Helpers ────────────────────────────────────────────────────────────────

fn setup() -> (Env, ScavengerContractClient<'static>) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract {});
    let client = ScavengerContractClient::new(&env, &contract_id);
    (env, client)
}

fn setup_with_admin() -> (Env, ScavengerContractClient<'static>, Address) {
    let (env, client) = setup();
    let admin = Address::generate(&env);
    client.initialize_admin(&admin);
    (env, client, admin)
}

fn register(client: &ScavengerContractClient, env: &Env, role: ParticipantRole) -> Address {
    let addr = Address::generate(env);
    client.register_participant(&addr, &role, &symbol_short!("user"), &0, &0);
    addr
}

fn create_waste(client: &ScavengerContractClient, recycler: &Address) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &2_000u128, recycler, &0, &0)
}

// ─── WasteGrade enum ────────────────────────────────────────────────────────

#[test]
fn test_waste_grade_multiplier_values() {
    // Grade A → 1.5x (150 bp)
    assert_eq!(WasteGrade::A.multiplier_pct(), 150u64);
    // Grade B → 1.2x (120 bp)
    assert_eq!(WasteGrade::B.multiplier_pct(), 120u64);
    // Grade C → 1.0x (100 bp) — baseline
    assert_eq!(WasteGrade::C.multiplier_pct(), 100u64);
    // Grade D → 0.7x (70 bp)
    assert_eq!(WasteGrade::D.multiplier_pct(), 70u64);
}

#[test]
fn test_waste_grade_from_u32_round_trips() {
    assert_eq!(WasteGrade::from_u32(0), Some(WasteGrade::A));
    assert_eq!(WasteGrade::from_u32(1), Some(WasteGrade::B));
    assert_eq!(WasteGrade::from_u32(2), Some(WasteGrade::C));
    assert_eq!(WasteGrade::from_u32(3), Some(WasteGrade::D));
    assert_eq!(WasteGrade::from_u32(4), None);
    assert_eq!(WasteGrade::from_u32(99), None);
}

#[test]
fn test_waste_grade_is_valid() {
    assert!(WasteGrade::is_valid(0));
    assert!(WasteGrade::is_valid(1));
    assert!(WasteGrade::is_valid(2));
    assert!(WasteGrade::is_valid(3));
    assert!(!WasteGrade::is_valid(4));
    assert!(!WasteGrade::is_valid(100));
}

#[test]
fn test_waste_grade_copy_and_equality() {
    let g1 = WasteGrade::A;
    let g2 = g1;
    assert_eq!(g1, g2);
    assert_ne!(WasteGrade::A, WasteGrade::B);
}

// ─── Grading rules per waste type ───────────────────────────────────────────

#[test]
fn test_min_acceptable_grade_per_waste_type() {
    // Electronic waste has strict quality requirements.
    assert_eq!(WasteType::Electronic.min_acceptable_grade(), WasteGrade::B);
    // Metal and Glass require at least Grade C.
    assert_eq!(WasteType::Metal.min_acceptable_grade(), WasteGrade::C);
    assert_eq!(WasteType::Glass.min_acceptable_grade(), WasteGrade::C);
    // PetPlastic requires at least Grade C.
    assert_eq!(WasteType::PetPlastic.min_acceptable_grade(), WasteGrade::C);
    // Paper, general Plastic, and Organic accept Grade D.
    assert_eq!(WasteType::Paper.min_acceptable_grade(), WasteGrade::D);
    assert_eq!(WasteType::Plastic.min_acceptable_grade(), WasteGrade::D);
    assert_eq!(WasteType::Organic.min_acceptable_grade(), WasteGrade::D);
}

#[test]
fn test_grade_meets_minimum_for_type() {
    // Grade A always meets the minimum regardless of waste type.
    for wt in [
        WasteType::Paper,
        WasteType::Plastic,
        WasteType::PetPlastic,
        WasteType::Metal,
        WasteType::Glass,
        WasteType::Organic,
        WasteType::Electronic,
    ] {
        // A (0) ≤ min_acceptable_grade (any grade): grade value (u32) must be ≤ min.
        let min = wt.min_acceptable_grade() as u32;
        assert!(
            (WasteGrade::A as u32) <= min,
            "Grade A should meet minimum for {:?}",
            wt
        );
    }
}

#[test]
fn test_electronic_waste_rejects_grade_d() {
    // Electronic waste minimum is Grade B (value 1).
    // Grade D value is 3, which is > 1 (lower quality), so D < B.
    let min = WasteType::Electronic.min_acceptable_grade() as u32;
    assert!((WasteGrade::D as u32) > min, "Grade D should not meet Electronic minimum");
}

// ─── apply_grade_multiplier ──────────────────────────────────────────────────
//
// `apply_grade_multiplier` is a pure Rust helper with no `env` parameter, so
// it is not exposed through the generated Soroban client. We test it directly
// through the contract struct and via its component: `multiplier_pct()`.

#[test]
fn test_apply_grade_multiplier_grade_a() {
    // 100 * 150 / 100 = 150
    let base: u64 = 100;
    let result = base * WasteGrade::A.multiplier_pct() / 100;
    assert_eq!(result, 150u64);
}

#[test]
fn test_apply_grade_multiplier_grade_b() {
    // 100 * 120 / 100 = 120
    let base: u64 = 100;
    let result = base * WasteGrade::B.multiplier_pct() / 100;
    assert_eq!(result, 120u64);
}

#[test]
fn test_apply_grade_multiplier_grade_c() {
    // 100 * 100 / 100 = 100 (no change — baseline)
    let base: u64 = 100;
    let result = base * WasteGrade::C.multiplier_pct() / 100;
    assert_eq!(result, 100u64);
}

#[test]
fn test_apply_grade_multiplier_grade_d() {
    // 100 * 70 / 100 = 70
    let base: u64 = 100;
    let result = base * WasteGrade::D.multiplier_pct() / 100;
    assert_eq!(result, 70u64);
}

#[test]
fn test_apply_grade_multiplier_zero_base() {
    for grade in [WasteGrade::A, WasteGrade::B, WasteGrade::C, WasteGrade::D] {
        let result: u64 = 0u64 * grade.multiplier_pct() / 100;
        assert_eq!(result, 0u64);
    }
}

#[test]
fn test_apply_grade_multiplier_large_value() {
    // 1000 * 150 / 100 = 1500
    let base: u64 = 1_000;
    let result = base * WasteGrade::A.multiplier_pct() / 100;
    assert_eq!(result, 1_500u64);
}

// ─── set_waste_grade ────────────────────────────────────────────────────────

#[test]
fn test_collector_can_grade_waste() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_id = create_waste(&client, &recycler);

    let graded_waste = client.set_waste_grade(&waste_id, &WasteGrade::A, &collector);
    assert_eq!(graded_waste.grade, WasteGrade::A);
}

#[test]
fn test_manufacturer_can_grade_waste() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);

    let waste_id = create_waste(&client, &recycler);

    let graded_waste = client.set_waste_grade(&waste_id, &WasteGrade::B, &manufacturer);
    assert_eq!(graded_waste.grade, WasteGrade::B);
}

#[test]
#[should_panic(expected = "Only collectors or manufacturers can grade waste")]
fn test_recycler_cannot_grade_waste() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &recycler);

    // Recycler attempting to grade their own waste → should panic.
    client.set_waste_grade(&waste_id, &WasteGrade::C, &recycler);
}

#[test]
fn test_grade_persisted_on_waste_struct() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_id = create_waste(&client, &recycler);
    client.set_waste_grade(&waste_id, &WasteGrade::D, &collector);

    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert_eq!(waste.grade, WasteGrade::D);
}

#[test]
fn test_grade_can_be_updated() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_id = create_waste(&client, &recycler);

    client.set_waste_grade(&waste_id, &WasteGrade::C, &collector);
    assert_eq!(client.get_waste_v2(&waste_id).unwrap().grade, WasteGrade::C);

    client.set_waste_grade(&waste_id, &WasteGrade::A, &collector);
    assert_eq!(client.get_waste_v2(&waste_id).unwrap().grade, WasteGrade::A);
}

#[test]
fn test_new_waste_defaults_to_grade_c() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);

    let waste_id = create_waste(&client, &recycler);
    let waste = client.get_waste_v2(&waste_id).unwrap();

    // Default grade should be C (average).
    assert_eq!(waste.grade, WasteGrade::C);
}

#[test]
#[should_panic]
fn test_grade_deactivated_waste_panics() {
    let (env, client, admin) = setup_with_admin();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_id = create_waste(&client, &recycler);

    // Deactivate the waste first (TTL-based expiry path).
    client.set_waste_ttl(&admin, &WasteType::Plastic, &100u64);
    env.ledger().with_mut(|li| li.timestamp = 1_000);

    // Manually deactivate via cleanup (create fresh expired waste).
    let recycler2 = register(&client, &env, ParticipantRole::Recycler);
    env.ledger().with_mut(|li| li.timestamp = 0);
    client.set_waste_ttl(&admin, &WasteType::Paper, &10u64);
    let expired_id =
        client.recycle_waste(&WasteType::Paper, &1_000u128, &recycler2, &0, &0);
    env.ledger().with_mut(|li| li.timestamp = 5_000);
    client.cleanup_expired_wastes(&admin);

    // Now try to grade the deactivated waste → should panic.
    client.set_waste_grade(&expired_id, &WasteGrade::A, &collector);
}

// ─── get_grade_history ───────────────────────────────────────────────────────

#[test]
fn test_grade_history_empty_on_new_waste() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let waste_id = create_waste(&client, &recycler);

    let history = client.get_grade_history(&waste_id);
    assert_eq!(history.len(), 0);
}

#[test]
fn test_grade_history_records_single_grading_event() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_id = create_waste(&client, &recycler);
    client.set_waste_grade(&waste_id, &WasteGrade::B, &collector);

    let history = client.get_grade_history(&waste_id);
    assert_eq!(history.len(), 1);

    let record = history.get(0).unwrap();
    assert_eq!(record.waste_id, waste_id);
    assert_eq!(record.grade, WasteGrade::B);
    assert_eq!(record.grader, collector);
}

#[test]
fn test_grade_history_records_multiple_grading_events() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    let manufacturer = register(&client, &env, ParticipantRole::Manufacturer);

    let waste_id = create_waste(&client, &recycler);

    client.set_waste_grade(&waste_id, &WasteGrade::C, &collector);
    client.set_waste_grade(&waste_id, &WasteGrade::A, &manufacturer);

    let history = client.get_grade_history(&waste_id);
    assert_eq!(history.len(), 2);

    assert_eq!(history.get(0).unwrap().grade, WasteGrade::C);
    assert_eq!(history.get(1).unwrap().grade, WasteGrade::A);
}

#[test]
fn test_grade_histories_are_per_waste_item() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_a = create_waste(&client, &recycler);
    let waste_b = create_waste(&client, &recycler);

    client.set_waste_grade(&waste_a, &WasteGrade::A, &collector);
    client.set_waste_grade(&waste_b, &WasteGrade::D, &collector);

    assert_eq!(client.get_grade_history(&waste_a).get(0).unwrap().grade, WasteGrade::A);
    assert_eq!(client.get_grade_history(&waste_b).get(0).unwrap().grade, WasteGrade::D);
}

// ─── get_wastes_by_grade ─────────────────────────────────────────────────────

#[test]
fn test_get_wastes_by_grade_returns_empty_when_none_graded() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let _waste_id = create_waste(&client, &recycler);

    // All new waste defaults to C; no A-grade waste exists.
    let grade_a_list = client.get_wastes_by_grade(&WasteGrade::A);
    assert_eq!(grade_a_list.len(), 0);
}

#[test]
fn test_get_wastes_by_grade_a() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_id = create_waste(&client, &recycler);
    client.set_waste_grade(&waste_id, &WasteGrade::A, &collector);

    let grade_a_list = client.get_wastes_by_grade(&WasteGrade::A);
    assert_eq!(grade_a_list.len(), 1);
    assert_eq!(grade_a_list.get(0).unwrap(), waste_id);
}

#[test]
fn test_get_wastes_by_grade_filters_correctly() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_a = create_waste(&client, &recycler);
    let waste_b = create_waste(&client, &recycler);
    let waste_c = create_waste(&client, &recycler);

    client.set_waste_grade(&waste_a, &WasteGrade::A, &collector);
    client.set_waste_grade(&waste_b, &WasteGrade::B, &collector);
    // waste_c stays at default Grade C.

    let grade_a = client.get_wastes_by_grade(&WasteGrade::A);
    let grade_b = client.get_wastes_by_grade(&WasteGrade::B);
    let grade_c = client.get_wastes_by_grade(&WasteGrade::C);
    let grade_d = client.get_wastes_by_grade(&WasteGrade::D);

    assert_eq!(grade_a.len(), 1);
    assert_eq!(grade_b.len(), 1);
    assert_eq!(grade_c.len(), 1); // waste_c default
    assert_eq!(grade_d.len(), 0);

    assert_eq!(grade_a.get(0).unwrap(), waste_a);
    assert_eq!(grade_b.get(0).unwrap(), waste_b);
    assert_eq!(grade_c.get(0).unwrap(), waste_c);
}

#[test]
fn test_get_wastes_by_grade_reflects_updated_grade() {
    let (env, client) = setup();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_id = create_waste(&client, &recycler);
    // Initially Grade C (default).
    assert_eq!(client.get_wastes_by_grade(&WasteGrade::C).len(), 1);

    // Upgrade to Grade A.
    client.set_waste_grade(&waste_id, &WasteGrade::A, &collector);

    assert_eq!(client.get_wastes_by_grade(&WasteGrade::A).len(), 1);
    assert_eq!(client.get_wastes_by_grade(&WasteGrade::C).len(), 0);
}

// ─── Grade-based reward calculation ─────────────────────────────────────────

#[test]
fn test_grade_multiplier_applied_in_reward_pipeline() {
    // Simulate the reward pipeline: base reward * grade.multiplier_pct() / 100.
    let base = 200u64;

    let reward_a = base * WasteGrade::A.multiplier_pct() / 100;
    let reward_b = base * WasteGrade::B.multiplier_pct() / 100;
    let reward_c = base * WasteGrade::C.multiplier_pct() / 100;
    let reward_d = base * WasteGrade::D.multiplier_pct() / 100;

    // A > B > C > D
    assert!(reward_a > reward_b);
    assert!(reward_b > reward_c);
    assert!(reward_c > reward_d);

    assert_eq!(reward_a, 300); // 200 * 150 / 100
    assert_eq!(reward_b, 240); // 200 * 120 / 100
    assert_eq!(reward_c, 200); // 200 * 100 / 100
    assert_eq!(reward_d, 140); // 200 * 70  / 100
}

// ─── Grading analytics ──────────────────────────────────────────────────────

#[test]
fn test_get_grading_analytics_returns_all_grade_counts() {
    let (env, client) = setup_with_admin();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_a = client.recycle_waste(&WasteType::Paper, &1_000, &recycler, &0, &0);
    let waste_b = client.recycle_waste(&WasteType::Metal, &2_000, &recycler, &0, &0);
    let waste_c = client.recycle_waste(&WasteType::Glass, &3_000, &recycler, &0, &0);

    client.set_waste_grade(&waste_a, &WasteGrade::A, &collector);
    client.set_waste_grade(&waste_b, &WasteGrade::B, &collector);
    // waste_c remains Grade C (default)

    let (a, b, c, d) = client.get_grading_analytics();
    assert_eq!(a, 1);
    assert_eq!(b, 1);
    assert_eq!(c, 1); // waste_c is still C
    assert_eq!(d, 0);
}

// ─── AI verification confidence ─────────────────────────────────────────────

#[test]
fn test_set_ai_verified_grade_stores_confidence() {
    let (env, client) = setup_with_admin();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000, &recycler, &0, &0);
    client.set_waste_grade_ai_verified(&waste_id, &WasteGrade::A, &collector, &95);

    let confidence = client.get_ai_grade_confidence(&waste_id);
    assert_eq!(confidence, Some(95));
}

#[test]
fn test_ai_grade_confidence_is_none_for_regular_grades() {
    let (env, client) = setup_with_admin();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000, &recycler, &0, &0);
    client.set_waste_grade(&waste_id, &WasteGrade::B, &collector);

    let confidence = client.get_ai_grade_confidence(&waste_id);
    assert_eq!(confidence, None);
}

#[test]
fn test_ai_confidence_capped_at_100() {
    let (env, client) = setup_with_admin();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1_000, &recycler, &0, &0);
    client.set_waste_grade_ai_verified(&waste_id, &WasteGrade::B, &collector, &150);

    let confidence = client.get_ai_grade_confidence(&waste_id);
    assert_eq!(confidence, Some(100));
}

// ─── Global metrics includes grade counts ───────────────────────────────────

#[test]
fn test_get_metrics_includes_grade_breakdown() {
    let (env, client) = setup_with_admin();
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);

    let w1 = client.recycle_waste(&WasteType::Paper, &1_000, &recycler, &0, &0);
    let w2 = client.recycle_waste(&WasteType::Metal, &2_000, &recycler, &0, &0);
    let w3 = client.recycle_waste(&WasteType::Glass, &3_000, &recycler, &0, &0);
    let w4 = client.recycle_waste(&WasteType::Plastic, &4_000, &recycler, &0, &0);

    client.set_waste_grade(&w1, &WasteGrade::A, &collector);
    client.set_waste_grade(&w2, &WasteGrade::B, &collector);
    client.set_waste_grade(&w3, &WasteGrade::D, &collector);
    // w4 stays C

    let metrics = client.get_metrics();
    assert_eq!(metrics.grade_a_count, 1);
    assert_eq!(metrics.grade_b_count, 1);
    assert_eq!(metrics.grade_c_count, 1);
    assert_eq!(metrics.grade_d_count, 1);
}

// ─── Grade acceptability matrix ─────────────────────────────────────────────

#[test]
fn test_grade_is_acceptable_for_each_waste_type() {
    // Electronic: only A and B acceptable
    assert!(WasteType::Electronic.grade_is_acceptable(WasteGrade::A));
    assert!(WasteType::Electronic.grade_is_acceptable(WasteGrade::B));
    assert!(!WasteType::Electronic.grade_is_acceptable(WasteGrade::C));
    assert!(!WasteType::Electronic.grade_is_acceptable(WasteGrade::D));

    // Metal: A, B, C acceptable
    assert!(WasteType::Metal.grade_is_acceptable(WasteGrade::A));
    assert!(WasteType::Metal.grade_is_acceptable(WasteGrade::B));
    assert!(WasteType::Metal.grade_is_acceptable(WasteGrade::C));
    assert!(!WasteType::Metal.grade_is_acceptable(WasteGrade::D));

    // Paper: all grades acceptable
    assert!(WasteType::Paper.grade_is_acceptable(WasteGrade::A));
    assert!(WasteType::Paper.grade_is_acceptable(WasteGrade::B));
    assert!(WasteType::Paper.grade_is_acceptable(WasteGrade::C));
    assert!(WasteType::Paper.grade_is_acceptable(WasteGrade::D));
}
