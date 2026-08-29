#![cfg(test)]

use soroban_sdk::{testutils::Address as _, vec, Address, Env, Vec};
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

fn register_waste(client: &ScavengerContractClient, owner: &Address, weight: u128) -> u128 {
    client.recycle_waste(&WasteType::Plastic, &weight, owner, &0, &0)
}

// ── Happy-path tests ──────────────────────────────────────────────────────────

#[test]
fn test_split_into_two_equal_parts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = register_waste(&client, &owner, 1000);
    let weights = vec![&env, 500u128, 500u128];

    let child_ids = client.split_waste(&waste_id, &owner, &weights);

    assert_eq!(child_ids.len(), 2);

    // Parent must be deactivated
    let parent = client.get_waste_v2(&waste_id).unwrap();
    assert!(!parent.is_active);

    // Children must be active with correct weights
    let c1 = client.get_waste_v2(&child_ids.get(0).unwrap()).unwrap();
    let c2 = client.get_waste_v2(&child_ids.get(1).unwrap()).unwrap();
    assert!(c1.is_active);
    assert!(c2.is_active);
    assert_eq!(c1.weight, 500);
    assert_eq!(c2.weight, 500);
}

#[test]
fn test_split_into_unequal_parts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = register_waste(&client, &owner, 1000);
    let weights = vec![&env, 300u128, 700u128];

    let child_ids = client.split_waste(&waste_id, &owner, &weights);

    assert_eq!(child_ids.len(), 2);
    let c1 = client.get_waste_v2(&child_ids.get(0).unwrap()).unwrap();
    let c2 = client.get_waste_v2(&child_ids.get(1).unwrap()).unwrap();
    assert_eq!(c1.weight, 300);
    assert_eq!(c2.weight, 700);
}

#[test]
fn test_children_inherit_waste_type_and_location() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = client.recycle_waste(&WasteType::Metal, &2000u128, &owner, &10_000_000i128, &20_000_000i128);

    let weights = vec![&env, 1000u128, 1000u128];
    let child_ids = client.split_waste(&waste_id, &owner, &weights);

    for i in 0..child_ids.len() {
        let child = client.get_waste_v2(&child_ids.get(i).unwrap()).unwrap();
        assert_eq!(child.waste_type, WasteType::Metal);
        assert_eq!(child.latitude, 10_000_000);
        assert_eq!(child.longitude, 20_000_000);
        assert_eq!(child.current_owner, owner);
    }
}

#[test]
fn test_children_appear_in_owner_waste_list() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = register_waste(&client, &owner, 900);
    let weights = vec![&env, 300u128, 300u128, 300u128];

    let child_ids = client.split_waste(&waste_id, &owner, &weights);

    let owner_wastes = client.get_participant_wastes_v2(&owner);

    // Parent should be gone, all 3 children should be present
    assert!(!owner_wastes.contains(&waste_id));
    for i in 0..child_ids.len() {
        assert!(owner_wastes.contains(&child_ids.get(i).unwrap()));
    }
}

#[test]
fn test_parent_removed_from_owner_waste_list() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = register_waste(&client, &owner, 500);
    let weights = vec![&env, 250u128, 250u128];

    client.split_waste(&waste_id, &owner, &weights);

    let owner_wastes = client.get_participant_wastes_v2(&owner);
    assert!(!owner_wastes.contains(&waste_id));
}

#[test]
fn test_transfer_history_copied_to_children() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    // Register a second participant and transfer to them first to build history
    let collector = Address::generate(&env);
    client.register_participant(
        &collector,
        &ParticipantRole::Collector,
        &soroban_sdk::symbol_short!("col"),
        &0,
        &0,
    );

    let waste_id = register_waste(&client, &owner, 1000);
    // Transfer: Recycler -> Collector
    client.transfer_waste_v2(&waste_id, &owner, &collector, &0, &0);

    // Now split as collector
    let weights = vec![&env, 600u128, 400u128];
    let child_ids = client.split_waste(&waste_id, &collector, &weights);

    // Each child should have the same transfer history as the parent
    let parent_history = client.get_waste_transfer_history_v2(&waste_id);
    for i in 0..child_ids.len() {
        let child_history = client.get_waste_transfer_history_v2(&child_ids.get(i).unwrap());
        assert_eq!(child_history.len(), parent_history.len());
    }
}

#[test]
fn test_split_max_10_parts() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = register_waste(&client, &owner, 1000);
    let weights = vec![
        &env, 100u128, 100u128, 100u128, 100u128, 100u128, 100u128, 100u128, 100u128, 100u128, 100u128,
    ];

    let child_ids = client.split_waste(&waste_id, &owner, &weights);
    assert_eq!(child_ids.len(), 10);
}

// ── Error-path tests ──────────────────────────────────────────────────────────

#[test]
fn test_split_waste_not_found() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let weights = vec![&env, 500u128, 500u128];
    let result = client.try_split_waste(&9999u128, &owner, &weights);
    assert_eq!(result, Err(Ok(Error::WasteNotFound)));
}

#[test]
fn test_split_not_owner() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = register_waste(&client, &owner, 1000);

    let other = Address::generate(&env);
    client.register_participant(
        &other,
        &ParticipantRole::Recycler,
        &soroban_sdk::symbol_short!("other"),
        &0,
        &0,
    );

    let weights = vec![&env, 500u128, 500u128];
    let result = client.try_split_waste(&waste_id, &other, &weights);
    assert_eq!(result, Err(Ok(Error::NotWasteOwner)));
}

#[test]
fn test_split_deactivated_waste() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let waste_id = register_waste(&client, &owner, 1000);
    client.deactivate_waste(&waste_id, &admin);

    let weights = vec![&env, 500u128, 500u128];
    let result = client.try_split_waste(&waste_id, &owner, &weights);
    assert_eq!(result, Err(Ok(Error::WasteDeactivated)));
}

#[test]
fn test_split_too_few_weights() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = register_waste(&client, &owner, 1000);
    let weights = vec![&env, 1000u128]; // only 1 weight

    let result = client.try_split_waste(&waste_id, &owner, &weights);
    assert_eq!(result, Err(Ok(Error::TooFewSplits)));
}

#[test]
fn test_split_too_many_weights() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = register_waste(&client, &owner, 1100);
    // 11 weights
    let weights = vec![
        &env, 100u128, 100u128, 100u128, 100u128, 100u128, 100u128, 100u128, 100u128, 100u128, 100u128, 100u128,
    ];

    let result = client.try_split_waste(&waste_id, &owner, &weights);
    assert_eq!(result, Err(Ok(Error::TooManySplits)));
}

#[test]
fn test_split_weight_mismatch() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = register_waste(&client, &owner, 1000);
    let weights = vec![&env, 400u128, 400u128]; // sums to 800, not 1000

    let result = client.try_split_waste(&waste_id, &owner, &weights);
    assert_eq!(result, Err(Ok(Error::WeightMismatch)));
}

#[test]
fn test_split_weight_exceeds_original() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _admin, owner) = setup(&env);

    let waste_id = register_waste(&client, &owner, 1000);
    let weights = vec![&env, 600u128, 600u128]; // sums to 1200, not 1000

    let result = client.try_split_waste(&waste_id, &owner, &weights);
    assert_eq!(result, Err(Ok(Error::WeightMismatch)));
}

#[test]
fn test_split_children_are_independent() {
    // Verify that deactivating one child does not affect the other
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, owner) = setup(&env);

    let waste_id = register_waste(&client, &owner, 1000);
    let weights = vec![&env, 500u128, 500u128];
    let child_ids = client.split_waste(&waste_id, &owner, &weights);

    let c1_id = child_ids.get(0).unwrap();
    let c2_id = child_ids.get(1).unwrap();

    client.deactivate_waste(&c1_id, &admin);

    let c1 = client.get_waste_v2(&c1_id).unwrap();
    let c2 = client.get_waste_v2(&c2_id).unwrap();
    assert!(!c1.is_active);
    assert!(c2.is_active);
}
