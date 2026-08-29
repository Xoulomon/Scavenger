#![cfg(test)]
// Boundary tests for checked arithmetic added to close overflow gaps (issue #926).
// Each test drives the public contract API to the edge of u32/u64 range and asserts
// a clear "Overflow in ..." panic instead of a silent wraparound.

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    env.mock_all_auths();
    let client = ScavengerContractClient::new(env, &env.register_contract(None, ScavengerContract));
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}

// ── set_percentages family: u32 sum must not silently wrap ──────────────────

#[test]
#[should_panic(expected = "Overflow in percentage sum")]
fn test_set_percentages_overflows_at_u32_max() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.set_percentages(&admin, &u32::MAX, &10);
}

#[test]
#[should_panic(expected = "Overflow in percentage sum")]
fn test_set_collector_percentage_overflows_at_u32_max() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    // Default owner_percentage is 50; pushing collector to u32::MAX must overflow, not wrap under 100.
    client.set_collector_percentage(&admin, &u32::MAX);
}

#[test]
#[should_panic(expected = "Overflow in percentage sum")]
fn test_set_owner_percentage_overflows_at_u32_max() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.set_owner_percentage(&admin, &u32::MAX);
}

#[test]
fn test_set_percentages_at_valid_boundary_succeeds() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    client.set_percentages(&admin, &60, &40);
    assert_eq!(client.get_collector_percentage(), Some(60));
    assert_eq!(client.get_owner_percentage(), Some(40));
}

// ── calculate_incentive_reward: weight_kg * reward_points must not wrap ─────

#[test]
#[should_panic(expected = "Overflow in reward calculation")]
fn test_calculate_incentive_reward_overflows_at_extreme_reward_points() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let manufacturer = Address::generate(&env);
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &0,
        &0,
    );

    let incentive = client.create_incentive(&manufacturer, &WasteType::Metal, &u64::MAX, &u64::MAX);
    // 5000g -> 5kg; 5 * u64::MAX overflows u64.
    client.calculate_incentive_reward(&incentive.id, &5_000);
}

#[test]
fn test_calculate_incentive_reward_at_realistic_scale_succeeds() {
    let env = Env::default();
    let (client, _admin) = setup(&env);
    let manufacturer = Address::generate(&env);
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &0,
        &0,
    );

    let incentive = client.create_incentive(&manufacturer, &WasteType::Metal, &1_000, &u64::MAX);
    assert_eq!(client.calculate_incentive_reward(&incentive.id, &5_000), 5_000);
}

// ── distribute_rewards: total_reward budget check must not wrap through u64 ─

#[test]
#[should_panic(expected = "Insufficient incentive budget")]
fn test_distribute_rewards_rejects_reward_exceeding_u64_budget_without_wrapping() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
    client.set_token_address(&admin, &token);

    let manufacturer = Address::generate(&env);
    let recycler = Address::generate(&env);
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &0,
        &0,
    );
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &0, &0);

    // reward_points * weight_kg (5,000 kg) comfortably exceeds u64::MAX while staying inside
    // i128. Before the fix, `(total_reward as u64) <= remaining_budget` silently truncated
    // total_reward and could wrongly pass the budget check; now the comparison stays in i128.
    let incentive = client.create_incentive(&manufacturer, &WasteType::Metal, &u64::MAX, &u64::MAX);

    let material = client.submit_material(&WasteType::Metal, &5_000_000, &recycler, &String::from_str(&env, ""));
    client.verify_material(&material.id, &recycler);

    client.distribute_rewards(&material.id, &incentive.id, &manufacturer);
}

// ── update_incentive: budget bookkeeping stays consistent at boundaries ─────

#[test]
fn test_update_incentive_budget_reduction_below_used_deactivates() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
    client.set_token_address(&admin, &token);

    let manufacturer = Address::generate(&env);
    let recycler = Address::generate(&env);
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("Mfr"),
        &0,
        &0,
    );
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &0, &0);
    soroban_sdk::token::StellarAssetClient::new(&env, &token).mint(&manufacturer, &1_000_000);

    let incentive = client.create_incentive(&manufacturer, &WasteType::Metal, &10, &100);

    let material = client.submit_material(&WasteType::Metal, &5_000, &recycler, &String::from_str(&env, ""));
    client.verify_material(&material.id, &recycler);
    client.distribute_rewards(&material.id, &incentive.id, &manufacturer); // uses 50 of 100

    // Reducing total budget below what's already used should zero remaining_budget and deactivate,
    // via checked_sub rather than an unchecked subtraction underflowing.
    let updated = client.update_incentive(&incentive.id, &10, &10);
    assert_eq!(updated.remaining_budget, 0);
    assert!(!updated.active);
}
