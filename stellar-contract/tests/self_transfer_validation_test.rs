#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env, String};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address, Address, Address) {
    env.mock_all_auths();
    let client = ScavengerContractClient::new(env, &env.register_contract(None, ScavengerContract));
    let recycler = Address::generate(env);
    let collector = Address::generate(env);
    let manufacturer = Address::generate(env);
    client.register_participant(&recycler, &ParticipantRole::Recycler, &symbol_short!("r"), &0, &0);
    client.register_participant(&collector, &ParticipantRole::Collector, &symbol_short!("c"), &0, &0);
    client.register_participant(
        &manufacturer,
        &ParticipantRole::Manufacturer,
        &symbol_short!("m"),
        &0,
        &0,
    );
    (client, recycler, collector, manufacturer)
}

// ── transfer_waste (v1) ──────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Self-transfer is not allowed")]
fn test_transfer_waste_self_transfer_rejected() {
    let env = Env::default();
    let (client, recycler, _, _) = setup(&env);
    let material = client.submit_material(&WasteType::Plastic, &1000, &recycler, &String::from_str(&env, ""));
    client.transfer_waste(&material.id, &recycler, &recycler, &String::from_str(&env, ""));
}

#[test]
fn test_transfer_waste_different_addresses_succeeds() {
    let env = Env::default();
    let (client, recycler, collector, _) = setup(&env);
    let material = client.submit_material(&WasteType::Plastic, &1000, &recycler, &String::from_str(&env, ""));
    client.transfer_waste(&material.id, &recycler, &collector, &String::from_str(&env, ""));
}

// ── transfer_waste_v2 ────────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Self-transfer is not allowed")]
fn test_transfer_waste_v2_self_transfer_rejected() {
    let env = Env::default();
    let (client, recycler, _, _) = setup(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    client.transfer_waste_v2(&waste_id, &recycler, &recycler, &0, &0);
}

#[test]
fn test_transfer_waste_v2_different_addresses_succeeds() {
    let env = Env::default();
    let (client, recycler, collector, _) = setup(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    client.transfer_waste_v2(&waste_id, &recycler, &collector, &0, &0);
}

// ── batch_transfer_waste ─────────────────────────────────────────────────────

#[test]
#[should_panic(expected = "Self-transfer is not allowed")]
fn test_batch_transfer_self_transfer_rejected() {
    let env = Env::default();
    let (client, recycler, _, _) = setup(&env);
    let waste_id = client.recycle_waste(&WasteType::Plastic, &1000, &recycler, &0, &0);
    let ids = soroban_sdk::vec![&env, waste_id];
    client.batch_transfer_waste(&ids, &recycler, &0, &0);
}
