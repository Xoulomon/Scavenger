#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{
    calculate_carbon_credits, Material, ParticipantRole, RecyclingStats, ScavengerContract, ScavengerContractClient,
    WasteType,
};

fn setup(env: &Env) -> (ScavengerContractClient, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let recycler = Address::generate(env);
    let name = symbol_short!("test");
    client.initialize_admin(&admin);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &name, &0, &0);
    (client, admin, recycler)
}

// ── Unit tests for calculate_carbon_credits ──────────────────────────────────

#[test]
fn test_carbon_credits_plastic() {
    // 1000g * 2.5 = 2500 gCO2e
    assert_eq!(calculate_carbon_credits(WasteType::Plastic, 1000), 2500);
}

#[test]
fn test_carbon_credits_pet_plastic() {
    // 1000g * 2.5 = 2500 gCO2e
    assert_eq!(calculate_carbon_credits(WasteType::PetPlastic, 1000), 2500);
}

#[test]
fn test_carbon_credits_paper() {
    // 1000g * 1.8 = 1800 gCO2e
    assert_eq!(calculate_carbon_credits(WasteType::Paper, 1000), 1800);
}

#[test]
fn test_carbon_credits_metal() {
    // 1000g * 3.2 = 3200 gCO2e
    assert_eq!(calculate_carbon_credits(WasteType::Metal, 1000), 3200);
}

#[test]
fn test_carbon_credits_glass() {
    // 1000g * 0.8 = 800 gCO2e
    assert_eq!(calculate_carbon_credits(WasteType::Glass, 1000), 800);
}

#[test]
fn test_carbon_credits_organic() {
    // 1000g * 0.5 = 500 gCO2e
    assert_eq!(calculate_carbon_credits(WasteType::Organic, 1000), 500);
}

#[test]
fn test_carbon_credits_electronic() {
    // 1000g * 4.0 = 4000 gCO2e
    assert_eq!(calculate_carbon_credits(WasteType::Electronic, 1000), 4000);
}

#[test]
fn test_carbon_credits_zero_weight() {
    assert_eq!(calculate_carbon_credits(WasteType::Metal, 0), 0);
}

#[test]
fn test_carbon_credits_scales_with_weight() {
    let base = calculate_carbon_credits(WasteType::Plastic, 1000);
    assert_eq!(calculate_carbon_credits(WasteType::Plastic, 5000), base * 5);
}

// ── Contract-level query tests ────────────────────────────────────────────────

#[test]
fn test_calculate_carbon_credits_contract_fn() {
    let env = Env::default();
    let (client, _, _) = setup(&env);
    // 2000g plastic: 2000 * 2500 / 1000 = 5000
    assert_eq!(client.calculate_carbon_credits(&WasteType::Plastic, &2000), 5000);
}

#[test]
fn test_get_total_carbon_credits_starts_at_zero() {
    let env = Env::default();
    let (client, _, _) = setup(&env);
    assert_eq!(client.get_total_carbon_credits(), 0);
}

#[test]
fn test_get_participant_carbon_credits_no_activity() {
    let env = Env::default();
    let (client, _, recycler) = setup(&env);
    assert_eq!(client.get_participant_carbon_credits(&recycler), 0);
}

#[test]
fn test_carbon_credits_accumulate_on_verification() {
    let env = Env::default();
    let (client, _, recycler) = setup(&env);

    let desc = String::from_str(&env, "test");
    // Submit and verify a 1000g plastic material
    let mat = client.submit_material(&WasteType::Plastic, &1000, &recycler, &desc);
    client.verify_material(&mat.id, &recycler);

    // 1000g * 2.5 = 2500 gCO2e
    assert_eq!(client.get_participant_carbon_credits(&recycler), 2500);
    assert_eq!(client.get_total_carbon_credits(), 2500);
}

#[test]
fn test_carbon_credits_multiple_verifications() {
    let env = Env::default();
    let (client, _, recycler) = setup(&env);

    let desc = String::from_str(&env, "test");
    let m1 = client.submit_material(&WasteType::Metal, &1000, &recycler, &desc);
    let m2 = client.submit_material(&WasteType::Paper, &1000, &recycler, &desc);
    client.verify_material(&m1.id, &recycler);
    client.verify_material(&m2.id, &recycler);

    // Metal: 3200 + Paper: 1800 = 5000
    assert_eq!(client.get_participant_carbon_credits(&recycler), 5000);
    assert_eq!(client.get_total_carbon_credits(), 5000);
}

#[test]
fn test_get_metrics_includes_carbon_credits() {
    let env = Env::default();
    let (client, _, recycler) = setup(&env);

    let desc = String::from_str(&env, "test");
    let mat = client.submit_material(&WasteType::Electronic, &1000, &recycler, &desc);
    client.verify_material(&mat.id, &recycler);

    let metrics = client.get_metrics();
    // 1000g * 4.0 = 4000 gCO2e
    assert_eq!(metrics.total_carbon_credits, 4000);
}

#[test]
fn test_carbon_credits_not_earned_without_verification() {
    let env = Env::default();
    let (client, _, recycler) = setup(&env);

    let desc = String::from_str(&env, "test");
    client.submit_material(&WasteType::Metal, &5000, &recycler, &desc);

    // No verification → no credits
    assert_eq!(client.get_participant_carbon_credits(&recycler), 0);
    assert_eq!(client.get_total_carbon_credits(), 0);
}

// ── RecyclingStats unit test ──────────────────────────────────────────────────

#[test]
fn test_recycling_stats_carbon_credits_field() {
    let env = Env::default();
    let participant = Address::generate(&env);
    let desc = String::from_str(&env, "test");

    let mut stats = RecyclingStats::new(participant.clone());
    assert_eq!(stats.carbon_credits_earned, 0);

    let mut material = Material::new(1, WasteType::Organic, 2000, participant, 0, desc);
    material.verify();
    stats.record_verification(&material);

    // 2000g * 0.5 = 1000 gCO2e
    assert_eq!(stats.carbon_credits_earned, 1000);
}
