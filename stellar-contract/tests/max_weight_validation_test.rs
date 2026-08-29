#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

const MAX_WASTE_WEIGHT: u128 = 1_000_000_000;

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    env.mock_all_auths();
    let client = ScavengerContractClient::new(env, &env.register_contract(None, ScavengerContract));
    let recycler = Address::generate(env);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("r"), &0, &0);
    (client, recycler)
}

// ── recycle_waste ────────────────────────────────────────────────────────────

#[test]
fn test_recycle_waste_at_max_weight_succeeds() {
    let env = Env::default();
    let (client, recycler) = setup(&env);
    client.recycle_waste(&WasteType::Plastic, &MAX_WASTE_WEIGHT, &recycler, &0, &0);
}

#[test]
#[should_panic(expected = "Waste weight exceeds maximum allowed")]
fn test_recycle_waste_above_max_weight_rejected() {
    let env = Env::default();
    let (client, recycler) = setup(&env);
    client.recycle_waste(&WasteType::Plastic, &(MAX_WASTE_WEIGHT + 1), &recycler, &0, &0);
}

#[test]
fn test_recycle_waste_below_max_weight_succeeds() {
    let env = Env::default();
    let (client, recycler) = setup(&env);
    client.recycle_waste(&WasteType::Plastic, &(MAX_WASTE_WEIGHT - 1), &recycler, &0, &0);
}

// ── submit_material ──────────────────────────────────────────────────────────

#[test]
fn test_submit_material_at_max_weight_succeeds() {
    let env = Env::default();
    let (client, recycler) = setup(&env);
    let weight = MAX_WASTE_WEIGHT as u64;
    client.submit_material(&WasteType::Plastic, &weight, &recycler, &String::from_str(&env, ""));
}

#[test]
#[should_panic(expected = "Waste weight exceeds maximum allowed")]
fn test_submit_material_above_max_weight_rejected() {
    let env = Env::default();
    let (client, recycler) = setup(&env);
    let weight = (MAX_WASTE_WEIGHT + 1) as u64;
    client.submit_material(&WasteType::Plastic, &weight, &recycler, &String::from_str(&env, ""));
}
