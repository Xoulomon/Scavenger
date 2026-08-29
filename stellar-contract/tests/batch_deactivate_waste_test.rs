#![cfg(test)]
use soroban_sdk::{testutils::Address as _, Address, Env, Vec};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient, Address, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    let owner = Address::generate(env);
    client.initialize_admin(&admin);
    client.register_participant(
        &owner,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("owner"),
        &0,
        &0,
    );
    (client, admin, owner)
}

fn register_waste(client: &ScavengerContractClient, owner: &Address) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &1000, owner, &0, &0)
}

// ── Test 1: deactivates all valid IDs and returns correct count ───────────────

#[test]
fn test_batch_deactivate_deactivates_all_and_returns_count() {
    let env = Env::default();
    let (client, admin, owner) = setup(&env);

    let id1 = register_waste(&client, &owner);
    let id2 = register_waste(&client, &owner);
    let id3 = register_waste(&client, &owner);

    let mut ids = Vec::new(&env);
    ids.push_back(id1);
    ids.push_back(id2);
    ids.push_back(id3);

    let count = client.batch_deactivate_waste(&ids, &admin);
    assert_eq!(count, 3);

    assert!(!client.get_waste_v2(&id1).unwrap().is_active);
    assert!(!client.get_waste_v2(&id2).unwrap().is_active);
    assert!(!client.get_waste_v2(&id3).unwrap().is_active);
}

// ── Test 2: non-existent and already-deactivated IDs are skipped gracefully ──

#[test]
fn test_batch_deactivate_skips_nonexistent_and_already_deactivated() {
    let env = Env::default();
    let (client, admin, owner) = setup(&env);

    let id1 = register_waste(&client, &owner);
    let id2 = register_waste(&client, &owner);

    // Pre-deactivate id2
    client.deactivate_waste(&id2, &admin);

    let mut ids = Vec::new(&env);
    ids.push_back(id1);
    ids.push_back(id2); // already deactivated — should be skipped
    ids.push_back(9999u128); // non-existent — should be skipped

    let count = client.batch_deactivate_waste(&ids, &admin);
    assert_eq!(count, 1); // only id1 was newly deactivated

    assert!(!client.get_waste_v2(&id1).unwrap().is_active);
    assert!(!client.get_waste_v2(&id2).unwrap().is_active); // still deactivated
}

// ── Test 3: empty batch returns 0 ────────────────────────────────────────────

#[test]
fn test_batch_deactivate_empty_returns_zero() {
    let env = Env::default();
    let (client, admin, _owner) = setup(&env);

    let ids: Vec<u128> = Vec::new(&env);
    let count = client.batch_deactivate_waste(&ids, &admin);
    assert_eq!(count, 0);
}

// ── Test 4: non-admin caller is rejected ─────────────────────────────────────

#[test]
#[should_panic(expected = "Caller is not the contract admin")]
fn test_batch_deactivate_rejects_non_admin() {
    let env = Env::default();
    let (client, _admin, owner) = setup(&env);

    let id1 = register_waste(&client, &owner);
    let mut ids = Vec::new(&env);
    ids.push_back(id1);

    let non_admin = Address::generate(&env);
    client.batch_deactivate_waste(&ids, &non_admin);
}

// ── Test 5: partial batch — mix of valid, already-deactivated, nonexistent ───

#[test]
fn test_batch_deactivate_partial_success() {
    let env = Env::default();
    let (client, admin, owner) = setup(&env);

    let id1 = register_waste(&client, &owner);
    let id2 = register_waste(&client, &owner);
    let id3 = register_waste(&client, &owner);

    // Deactivate id1 upfront
    client.deactivate_waste(&id1, &admin);

    let mut ids = Vec::new(&env);
    ids.push_back(id1); // already deactivated
    ids.push_back(id2); // active → should deactivate
    ids.push_back(8888u128); // non-existent
    ids.push_back(id3); // active → should deactivate

    let count = client.batch_deactivate_waste(&ids, &admin);
    assert_eq!(count, 2);

    assert!(!client.get_waste_v2(&id2).unwrap().is_active);
    assert!(!client.get_waste_v2(&id3).unwrap().is_active);
}
