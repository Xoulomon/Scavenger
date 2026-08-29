#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let token = env.register_stellar_asset_contract_v2(admin.clone()).address();
    let charity = Address::generate(env);
    env.mock_all_auths();
    client.initialize_admin(&admin);
    client.set_token_address(&admin, &token);
    client.set_charity_contract(&admin, &charity);
    client.set_percentages(&admin, &10, &20);
    (client, admin, token)
}

// ── Edge case 1: zero-weight waste yields zero reward ────────────────────────
#[test]
fn test_zero_weight_waste_yields_zero_reward() {
    let env = Env::default();
    let (client, _admin, token) = setup(&env);

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

    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &100, &500);

    // weight < 1000 g → weight_kg = 0 → total_reward = 0
    let material = client.submit_material(&WasteType::Plastic, &999, &recycler, &String::from_str(&env, ""));
    client.verify_material(&material.id, &recycler);

    let total = client.distribute_rewards(&material.id, &incentive.id, &manufacturer);
    assert_eq!(total, 0);

    let updated = client.get_incentive_by_id(&incentive.id).unwrap();
    assert_eq!(updated.remaining_budget, 500);
    assert!(updated.active);
}

// ── Edge case 2: exact budget match deactivates incentive ────────────────────
#[test]
fn test_exact_budget_match_deactivates_incentive() {
    let env = Env::default();
    let (client, _admin, token) = setup(&env);

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

    // 10 pts/kg, budget exactly 50 → one 5 kg submission exhausts it
    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &50);

    let material = client.submit_material(&WasteType::Plastic, &5_000, &recycler, &String::from_str(&env, ""));
    client.verify_material(&material.id, &recycler);

    let total = client.distribute_rewards(&material.id, &incentive.id, &manufacturer);
    assert_eq!(total, 50);

    let updated = client.get_incentive_by_id(&incentive.id).unwrap();
    assert_eq!(updated.remaining_budget, 0);
    assert!(!updated.active, "Incentive should be deactivated when budget hits zero");
}

#[test]
#[should_panic(expected = "Incentive not active")]
fn test_exact_budget_match_blocks_further_distribution() {
    let env = Env::default();
    let (client, _admin, token) = setup(&env);

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

    let incentive = client.create_incentive(&manufacturer, &WasteType::Plastic, &10, &50);

    let m1 = client.submit_material(&WasteType::Plastic, &5_000, &recycler, &String::from_str(&env, ""));
    client.verify_material(&m1.id, &recycler);
    client.distribute_rewards(&m1.id, &incentive.id, &manufacturer);

    let m2 = client.submit_material(&WasteType::Plastic, &5_000, &recycler, &String::from_str(&env, ""));
    client.verify_material(&m2.id, &recycler);
    client.distribute_rewards(&m2.id, &incentive.id, &manufacturer);
}

// ── Edge case 3: transfer to self is rejected ────────────────────────────────
#[test]
#[should_panic(expected = "Self-transfer is not allowed")]
fn test_transfer_to_self_is_rejected() {
    let env = Env::default();
    let (client, _admin, _token) = setup(&env);

    let recycler = Address::generate(&env);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("Rec"), &0, &0);

    let material = client.submit_material(&WasteType::Plastic, &5_000, &recycler, &String::from_str(&env, ""));
    client.transfer_waste(&material.id, &recycler, &recycler, &String::from_str(&env, ""));
}
