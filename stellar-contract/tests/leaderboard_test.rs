#![cfg(test)]

use soroban_sdk::{symbol_short, testutils::Address as _, Address, Env};
use stellar_scavngr_contract::{ParticipantRole, ScavengerContract, ScavengerContractClient, WasteType};

fn setup(env: &Env) -> (ScavengerContractClient<'_>, Address) {
    env.mock_all_auths();
    let contract_id = env.register_contract(None, ScavengerContract);
    let client = ScavengerContractClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize_admin(&admin);
    (client, admin)
}

fn register(client: &ScavengerContractClient<'_>, env: &Env, role: ParticipantRole) -> Address {
    let addr = Address::generate(env);
    client.register_participant(&addr, &role, &symbol_short!("user"), &1_000_000, &2_000_000);
    addr
}

#[test]
fn test_get_top_recyclers_empty() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let top = client.get_top_recyclers(&10u32);
    assert_eq!(top.len(), 0);
}

#[test]
fn test_get_top_recyclers_ordered() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let r1 = register(&client, &env, ParticipantRole::Recycler);
    let r2 = register(&client, &env, ParticipantRole::Recycler);
    // r1 gets more waste
    client.recycle_waste(&WasteType::Plastic, &10_000u128, &r1, &1_000_000, &2_000_000);
    client.recycle_waste(&WasteType::Plastic, &5_000u128, &r2, &1_000_000, &2_000_000);
    let top = client.get_top_recyclers(&10u32);
    assert_eq!(top.len(), 2);
    assert_eq!(top.get(0).unwrap().participant, r1);
    assert_eq!(top.get(0).unwrap().rank, 1);
    assert_eq!(top.get(1).unwrap().rank, 2);
}

#[test]
fn test_get_top_collectors_only_collectors() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let recycler = register(&client, &env, ParticipantRole::Recycler);
    let collector = register(&client, &env, ParticipantRole::Collector);
    client.recycle_waste(&WasteType::Plastic, &10_000u128, &recycler, &1_000_000, &2_000_000);
    client.recycle_waste(&WasteType::Plastic, &5_000u128, &collector, &1_000_000, &2_000_000);
    let top = client.get_top_collectors(&10u32);
    // Only collector should appear
    assert_eq!(top.len(), 1);
    assert_eq!(top.get(0).unwrap().participant, collector);
}

#[test]
fn test_get_top_earners_ordered() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let r1 = register(&client, &env, ParticipantRole::Recycler);
    let r2 = register(&client, &env, ParticipantRole::Recycler);
    client.reward_tokens(&admin, &r1, &500i128, &1u64);
    client.reward_tokens(&admin, &r2, &200i128, &2u64);
    let top = client.get_top_earners(&10u32);
    assert!(top.len() >= 2);
    assert_eq!(top.get(0).unwrap().participant, r1);
}

#[test]
fn test_get_top_verifiers() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let r1 = register(&client, &env, ParticipantRole::Recycler);
    // Submit and verify a material to build stats
    let mat_id = client.submit_material(&r1, &WasteType::Plastic, &5_000u64, &1_000_000, &2_000_000);
    client.verify_material(&mat_id, &r1);
    let top = client.get_top_verifiers(&10u32);
    assert!(top.len() >= 1);
}

#[test]
fn test_get_top_recyclers_limit_respected() {
    let env = Env::default();
    let (client, _) = setup(&env);
    for _ in 0..5 {
        let r = register(&client, &env, ParticipantRole::Recycler);
        client.recycle_waste(&WasteType::Plastic, &1_000u128, &r, &1_000_000, &2_000_000);
    }
    let top = client.get_top_recyclers(&3u32);
    assert_eq!(top.len(), 3);
}

#[test]
fn test_get_participant_rank_weight() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let r1 = register(&client, &env, ParticipantRole::Recycler);
    let r2 = register(&client, &env, ParticipantRole::Recycler);
    client.recycle_waste(&WasteType::Plastic, &10_000u128, &r1, &1_000_000, &2_000_000);
    client.recycle_waste(&WasteType::Plastic, &5_000u128, &r2, &1_000_000, &2_000_000);
    let rank1 = client.get_participant_rank(&r1, &symbol_short!("weight"));
    let rank2 = client.get_participant_rank(&r2, &symbol_short!("weight"));
    assert_eq!(rank1, 1);
    assert_eq!(rank2, 2);
}

#[test]
fn test_get_participant_rank_tokens() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    let r1 = register(&client, &env, ParticipantRole::Recycler);
    let r2 = register(&client, &env, ParticipantRole::Recycler);
    client.reward_tokens(&admin, &r1, &1000i128, &1u64);
    client.reward_tokens(&admin, &r2, &500i128, &2u64);
    let rank1 = client.get_participant_rank(&r1, &symbol_short!("tokens"));
    let rank2 = client.get_participant_rank(&r2, &symbol_short!("tokens"));
    assert_eq!(rank1, 1);
    assert_eq!(rank2, 2);
}

#[test]
fn test_get_top_earners_limit_100() {
    let env = Env::default();
    let (client, admin) = setup(&env);
    for i in 0..5 {
        let r = register(&client, &env, ParticipantRole::Recycler);
        client.reward_tokens(&admin, &r, &(100 + i as i128), &(i as u64));
    }
    // limit > participants returns all
    let top = client.get_top_earners(&100u32);
    assert_eq!(top.len(), 5);
}

#[test]
fn test_leaderboard_rank_starts_at_one() {
    let env = Env::default();
    let (client, _) = setup(&env);
    let r = register(&client, &env, ParticipantRole::Recycler);
    client.recycle_waste(&WasteType::Plastic, &1_000u128, &r, &1_000_000, &2_000_000);
    let top = client.get_top_recyclers(&10u32);
    assert_eq!(top.get(0).unwrap().rank, 1);
}
