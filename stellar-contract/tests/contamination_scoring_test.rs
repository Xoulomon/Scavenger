#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteGrade, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient, Address, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let collector = Address::generate(env);
    let name = symbol_short!("test");
    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &0, &0);
    client.register_participant(&collector, &ParticipantRole::Collector, &name, &0, &0);
    (client, admin, recycler, collector)
}

fn reason(env: &Env, s: &str) -> String {
    String::from_str(env, s)
}

// ── get_contamination_score ───────────────────────────────────────────────────

#[test]
fn test_score_zero_when_not_contaminated() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    assert_eq!(client.get_contamination_score(&waste_id), 0);
}

#[test]
fn test_score_equals_contamination_level_for_non_grade_d() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Metal, &2000, &recycler, &0, &0);
    client.mark_contaminated(&waste_id, &recycler, &40, &reason(&env, "mixed"));

    // Grade C by default — no penalty
    assert_eq!(client.get_contamination_score(&waste_id), 40);
}

#[test]
fn test_score_adds_penalty_for_grade_d() {
    let env = Env::default();
    let (client, admin, recycler, collector) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    // Set grade to D
    client.set_waste_grade(&waste_id, &WasteGrade::D, &collector);
    client.mark_contaminated(&waste_id, &recycler, &50, &reason(&env, "dirty"));

    // Grade D adds 10 points: 50 + 10 = 60
    assert_eq!(client.get_contamination_score(&waste_id), 60);
    let _ = admin; // suppress unused warning
}

#[test]
fn test_score_capped_at_100() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Glass, &500, &recycler, &0, &0);
    client.set_waste_grade(&waste_id, &WasteGrade::D, &collector);
    client.mark_contaminated(&waste_id, &recycler, &95, &reason(&env, "very dirty"));

    // 95 + 10 would be 105, but capped at 100
    assert_eq!(client.get_contamination_score(&waste_id), 100);
}

#[test]
fn test_score_full_contamination_no_penalty() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Paper, &500, &recycler, &0, &0);
    client.mark_contaminated(&waste_id, &recycler, &100, &reason(&env, "fully contaminated"));

    assert_eq!(client.get_contamination_score(&waste_id), 100);
}

// ── report_contamination ──────────────────────────────────────────────────────

#[test]
fn test_report_contamination_stores_report() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    let report = client.report_contamination(&waste_id, &collector, &30, &reason(&env, "slight contamination"));

    assert_eq!(report.waste_id, waste_id);
    assert_eq!(report.reporter, collector);
    assert_eq!(report.level, 30);
}

#[test]
fn test_report_contamination_returns_report_list() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Metal, &2000, &recycler, &0, &0);
    client.report_contamination(&waste_id, &collector, &20, &reason(&env, "first"));
    client.report_contamination(&waste_id, &recycler, &40, &reason(&env, "second"));

    let reports = client.get_contamination_reports(&waste_id);
    assert_eq!(reports.len(), 2);
}

#[test]
fn test_three_reports_auto_marks_contaminated() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);

    let name = symbol_short!("r3");
    let reporter3 = Address::generate(&env);
    client.register_participant(&reporter3, &ParticipantRole::Recycler, &name, &0, &0);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &3000, &recycler, &0, &0);

    // 3 reports with levels 20, 60, 40 → sorted → 20, 40, 60 → median = 40
    client.report_contamination(&waste_id, &recycler, &20, &reason(&env, "low"));
    client.report_contamination(&waste_id, &collector, &60, &reason(&env, "high"));
    client.report_contamination(&waste_id, &reporter3, &40, &reason(&env, "mid"));

    let waste = client.get_waste_v2(&waste_id).unwrap();
    assert!(waste.is_contaminated);
    assert_eq!(waste.contamination_level, 40);
}

#[test]
fn test_two_reports_do_not_auto_mark() {
    let env = Env::default();
    let (client, _, recycler, collector) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Glass, &1000, &recycler, &0, &0);
    client.report_contamination(&waste_id, &recycler, &50, &reason(&env, "a"));
    client.report_contamination(&waste_id, &collector, &70, &reason(&env, "b"));

    let waste = client.get_waste_v2(&waste_id).unwrap();
    // 2 reports — not enough to auto-mark
    assert!(!waste.is_contaminated);
}

#[test]
fn test_get_contamination_reports_empty_initially() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Organic, &1000, &recycler, &0, &0);
    assert_eq!(client.get_contamination_reports(&waste_id).len(), 0);
}

#[test]
#[should_panic(expected = "Contamination level must be 0-100")]
fn test_report_contamination_level_over_100_panics() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    client.report_contamination(&waste_id, &recycler, &101, &reason(&env, "bad"));
}

#[test]
#[should_panic(expected = "Reporter not registered")]
fn test_report_contamination_unregistered_reporter_panics() {
    let env = Env::default();
    let (client, _, recycler, _) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    let unregistered = Address::generate(&env);
    client.report_contamination(&waste_id, &unregistered, &30, &reason(&env, "bad"));
}

#[test]
#[should_panic(expected = "Waste not found")]
fn test_report_contamination_nonexistent_waste_panics() {
    let env = Env::default();
    let (client, _, _, collector) = setup(&env);

    client.report_contamination(&9999, &collector, &20, &reason(&env, "ghost"));
}
