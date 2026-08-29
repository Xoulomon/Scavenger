#![cfg(test)]

use soroban_sdk::{testutils::Address as _, vec, Address, Env};
use stellar_scavngr_contract::{Error, ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient, Address, Address) {
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    client.initialize_admin(&admin);

    let owner = Address::generate(env);
    client.register_participant(
        &owner,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("owner"),
        &0,
        &0,
    );

    (client, admin, owner)
}

fn make_waste(
    client: &ScavengerContractClient,
    owner: &Address,
    waste_type: WasteType,
    weight: u128,
    lat: i128,
    lon: i128,
) -> u128 {
    client.recycle_waste(&waste_type, &weight, owner, &lat, &lon)
}

// ── Happy-path tests ──────────────────────────────────────────────────────────

#[test]
fn test_merge_two_wastes() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let id1 = make_waste(&client, &owner, WasteType::Plastic, 500, 0, 0);
    let id2 = make_waste(&client, &owner, WasteType::Plastic, 300, 0, 0);

    let merged_id = client.merge_wastes(&vec![&env, id1, id2], &owner);

    let merged = client.get_waste_v2(&merged_id).unwrap();
    assert_eq!(merged.weight, 800);
    assert_eq!(merged.waste_type, WasteType::Plastic);
    assert!(merged.is_active);
    assert_eq!(merged.current_owner, owner);
}

#[test]
fn test_sources_are_deactivated_after_merge() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let id1 = make_waste(&client, &owner, WasteType::Metal, 400, 0, 0);
    let id2 = make_waste(&client, &owner, WasteType::Metal, 600, 0, 0);

    client.merge_wastes(&vec![&env, id1, id2], &owner);

    assert!(!client.get_waste_v2(&id1).unwrap().is_active);
    assert!(!client.get_waste_v2(&id2).unwrap().is_active);
}

#[test]
fn test_merged_weight_equals_sum() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let id1 = make_waste(&client, &owner, WasteType::Glass, 100, 0, 0);
    let id2 = make_waste(&client, &owner, WasteType::Glass, 200, 0, 0);
    let id3 = make_waste(&client, &owner, WasteType::Glass, 300, 0, 0);

    let merged_id = client.merge_wastes(&vec![&env, id1, id2, id3], &owner);

    assert_eq!(client.get_waste_v2(&merged_id).unwrap().weight, 600);
}

#[test]
fn test_merged_waste_in_owner_list() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let id1 = make_waste(&client, &owner, WasteType::Paper, 500, 0, 0);
    let id2 = make_waste(&client, &owner, WasteType::Paper, 500, 0, 0);

    let merged_id = client.merge_wastes(&vec![&env, id1, id2], &owner);

    let owner_wastes = client.get_participant_wastes_v2(&owner);
    assert!(owner_wastes.contains(&merged_id));
    assert!(!owner_wastes.contains(&id1));
    assert!(!owner_wastes.contains(&id2));
}

#[test]
fn test_merged_inherits_location() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let id1 = make_waste(&client, &owner, WasteType::Metal, 300, 10_000_000, 20_000_000);
    let id2 = make_waste(&client, &owner, WasteType::Metal, 700, 10_000_000, 20_000_000);

    let merged_id = client.merge_wastes(&vec![&env, id1, id2], &owner);

    let merged = client.get_waste_v2(&merged_id).unwrap();
    assert_eq!(merged.latitude, 10_000_000);
    assert_eq!(merged.longitude, 20_000_000);
}

#[test]
fn test_transfer_histories_aggregated() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    // Build a collector to create transfer history on id1
    let collector = Address::generate(&env);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("col"),
        &0,
        &0,
    );

    let id1 = make_waste(&client, &owner, WasteType::Plastic, 500, 0, 0);
    // Transfer id1: Recycler -> Collector, then back (not possible via route, so just check history length)
    // Instead, create id1 under collector directly
    let id1_col = make_waste(&client, &collector, WasteType::Plastic, 500, 0, 0);
    // Transfer id1_col to owner (Collector -> Recycler is invalid route; use owner as collector)
    // Simplest: just verify histories are concatenated
    let id2 = make_waste(&client, &owner, WasteType::Plastic, 300, 0, 0);

    // Transfer id1 to collector (Recycler -> Collector is valid)
    client.transfer_waste_v2(&id1, &owner, &collector, &0, &0);

    // Now collector merges id1_col and the transferred id1
    let merged_id = client.merge_wastes(&vec![&env, id1_col, id1], &collector);

    let h1: soroban_sdk::Vec<_> = client.get_waste_transfer_history_v2(&id1_col);
    let h2: soroban_sdk::Vec<_> = client.get_waste_transfer_history_v2(&id1);
    let hm: soroban_sdk::Vec<_> = client.get_waste_transfer_history_v2(&merged_id);

    assert_eq!(hm.len(), h1.len() + h2.len());
    let _ = id2; // unused but registered
}

#[test]
fn test_merge_max_20_wastes() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let mut ids = soroban_sdk::Vec::new(&env);
    for _ in 0..20 {
        ids.push_back(make_waste(&client, &owner, WasteType::Glass, 50, 0, 0));
    }

    let merged_id = client.merge_wastes(&ids, &owner);
    assert_eq!(client.get_waste_v2(&merged_id).unwrap().weight, 1000);
}

// ── Error-path tests ──────────────────────────────────────────────────────────

#[test]
fn test_merge_too_few_wastes() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let id1 = make_waste(&client, &owner, WasteType::Plastic, 500, 0, 0);
    let result = client.try_merge_wastes(&vec![&env, id1], &owner);
    assert_eq!(result, Err(Ok(Error::TooFewWastes)));
}

#[test]
fn test_merge_too_many_wastes() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let mut ids = soroban_sdk::Vec::new(&env);
    for _ in 0..21 {
        ids.push_back(make_waste(&client, &owner, WasteType::Plastic, 50, 0, 0));
    }

    let result = client.try_merge_wastes(&ids, &owner);
    assert_eq!(result, Err(Ok(Error::TooManyWastes)));
}

#[test]
fn test_merge_waste_not_found() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let id1 = make_waste(&client, &owner, WasteType::Plastic, 500, 0, 0);
    let result = client.try_merge_wastes(&vec![&env, id1, 9999u128], &owner);
    assert_eq!(result, Err(Ok(Error::WasteNotFound)));
}

#[test]
fn test_merge_not_owner() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let other = Address::generate(&env);
    client.register_participant(
        &other,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("other"),
        &0,
        &0,
    );

    let id1 = make_waste(&client, &owner, WasteType::Plastic, 500, 0, 0);
    let id2 = make_waste(&client, &owner, WasteType::Plastic, 500, 0, 0);

    let result = client.try_merge_wastes(&vec![&env, id1, id2], &other);
    assert_eq!(result, Err(Ok(Error::NotWasteOwner)));
}

#[test]
fn test_merge_deactivated_waste() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let id1 = make_waste(&client, &owner, WasteType::Plastic, 500, 0, 0);
    let id2 = make_waste(&client, &owner, WasteType::Plastic, 500, 0, 0);
    client.deactivate_waste(&id1, &admin);

    let result = client.try_merge_wastes(&vec![&env, id1, id2], &owner);
    assert_eq!(result, Err(Ok(Error::WasteDeactivated)));
}

#[test]
fn test_merge_type_mismatch() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let id1 = make_waste(&client, &owner, WasteType::Plastic, 500, 0, 0);
    let id2 = make_waste(&client, &owner, WasteType::Metal, 500, 0, 0);

    let result = client.try_merge_wastes(&vec![&env, id1, id2], &owner);
    assert_eq!(result, Err(Ok(Error::WasteTypeMismatchMerge)));
}

#[test]
fn test_merge_location_mismatch() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let id1 = make_waste(&client, &owner, WasteType::Glass, 500, 10_000_000, 20_000_000);
    let id2 = make_waste(&client, &owner, WasteType::Glass, 500, 30_000_000, 40_000_000);

    let result = client.try_merge_wastes(&vec![&env, id1, id2], &owner);
    assert_eq!(result, Err(Ok(Error::LocationMismatch)));
}
