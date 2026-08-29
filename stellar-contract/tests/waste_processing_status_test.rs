#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{
    ParticipantRole, ProcessingStatus, ScavengerContract, ScavengerContractClient, WasteType,
};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    let id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &id);
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}

fn register_recycler(env: &Env, client: &ScavengerContractClient<'_>) -> Address {
    let addr = Address::generate(env);
    client.register_participant(
        &addr,
        &ParticipantRole::Recycler,
        &symbol_short!("recycler"),
        &10_000_000,
        &20_000_000,
    );
    addr
}

fn submit_waste(client: &ScavengerContractClient<'_>, owner: &Address) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &1_000, owner, &10_000_000, &20_000_000)
}

// ── 1. New waste starts with Collected status ──────────────────────────────
#[test]
fn test_new_waste_has_collected_status() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let owner = register_recycler(&env, &client);

    let waste_id = submit_waste(&client, &owner);
    let waste = client.get_waste_v2(&waste_id).unwrap();

    assert_eq!(waste.processing_status, ProcessingStatus::Collected);
}

// ── 2. New waste has one entry in processing_history ──────────────────────
#[test]
fn test_new_waste_history_has_one_entry() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let owner = register_recycler(&env, &client);

    let waste_id = submit_waste(&client, &owner);
    let waste = client.get_waste_v2(&waste_id).unwrap();

    assert_eq!(waste.processing_history.len(), 1);
    assert_eq!(
        waste.processing_history.get(0).unwrap().status,
        ProcessingStatus::Collected
    );
}

// ── 3. Owner can advance status forward ───────────────────────────────────
#[test]
fn test_owner_can_advance_status() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let owner = register_recycler(&env, &client);

    let waste_id = submit_waste(&client, &owner);
    let updated = client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Sorted);

    assert_eq!(updated.processing_status, ProcessingStatus::Sorted);
}

// ── 4. History grows with each status update ──────────────────────────────
#[test]
fn test_history_grows_on_update() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let owner = register_recycler(&env, &client);

    let waste_id = submit_waste(&client, &owner);
    client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Sorted);
    let waste = client.get_waste_v2(&waste_id).unwrap();

    assert_eq!(waste.processing_history.len(), 2);
    assert_eq!(
        waste.processing_history.get(1).unwrap().status,
        ProcessingStatus::Sorted
    );
}

// ── 5. Full forward progression works ─────────────────────────────────────
#[test]
fn test_full_forward_progression() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let owner = register_recycler(&env, &client);

    let waste_id = submit_waste(&client, &owner);
    client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Sorted);
    client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Processed);
    client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Recycled);
    let final_waste = client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Manufactured);

    assert_eq!(final_waste.processing_status, ProcessingStatus::Manufactured);
    assert_eq!(final_waste.processing_history.len(), 5);
}

// ── 6. Backwards status update is rejected ────────────────────────────────
#[test]
#[should_panic(expected = "Status must progress forward")]
fn test_backwards_status_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let owner = register_recycler(&env, &client);

    let waste_id = submit_waste(&client, &owner);
    client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Sorted);
    // Try to go back to Collected
    client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Collected);
}

// ── 7. Same status update is rejected ─────────────────────────────────────
#[test]
#[should_panic(expected = "Status must progress forward")]
fn test_same_status_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let owner = register_recycler(&env, &client);

    let waste_id = submit_waste(&client, &owner);
    client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Collected);
}

// ── 8. Non-owner cannot update status ─────────────────────────────────────
#[test]
#[should_panic(expected = "Only current owner can update processing status")]
fn test_non_owner_cannot_update_status() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let owner = register_recycler(&env, &client);
    let other = register_recycler(&env, &client);

    let waste_id = submit_waste(&client, &owner);
    client.update_processing_status(&waste_id, &other, &ProcessingStatus::Sorted);
}

// ── 9. Update on non-existent waste panics ────────────────────────────────
#[test]
#[should_panic(expected = "Waste not found")]
fn test_update_nonexistent_waste_panics() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let owner = register_recycler(&env, &client);

    client.update_processing_status(&9999u128, &owner, &ProcessingStatus::Sorted);
}

// ── 10. get_wastes_by_status returns correct IDs ──────────────────────────
#[test]
fn test_get_wastes_by_status_returns_matching() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let owner = register_recycler(&env, &client);

    let id1 = submit_waste(&client, &owner);
    let id2 = submit_waste(&client, &owner);
    // Advance id2 to Sorted
    client.update_processing_status(&id2, &owner, &ProcessingStatus::Sorted);

    let collected = client.get_wastes_by_status(&ProcessingStatus::Collected);
    let sorted = client.get_wastes_by_status(&ProcessingStatus::Sorted);

    assert!(collected.contains(&id1));
    assert!(!collected.contains(&id2));
    assert!(sorted.contains(&id2));
    assert!(!sorted.contains(&id1));
}

// ── 11. get_wastes_by_status returns empty when none match ────────────────
#[test]
fn test_get_wastes_by_status_empty_when_none_match() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let owner = register_recycler(&env, &client);

    submit_waste(&client, &owner);

    let manufactured = client.get_wastes_by_status(&ProcessingStatus::Manufactured);
    assert_eq!(manufactured.len(), 0);
}

// ── 12. History records correct updater address ───────────────────────────
#[test]
fn test_history_records_correct_updater() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _) = setup(&env);
    let owner = register_recycler(&env, &client);

    let waste_id = submit_waste(&client, &owner);
    client.update_processing_status(&waste_id, &owner, &ProcessingStatus::Sorted);

    let waste = client.get_waste_v2(&waste_id).unwrap();
    let record = waste.processing_history.get(1).unwrap();

    assert_eq!(record.updated_by, owner);
    assert_eq!(record.status, ProcessingStatus::Sorted);
}
